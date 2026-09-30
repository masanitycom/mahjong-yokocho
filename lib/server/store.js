// データの置き場所。本番は Supabase（service_role）、ローカル検証はメモリ。
import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'node:events';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const isDev = !URL || !SERVICE;

/* ---------------- Supabase ---------------- */
class SupabaseStore {
  constructor() {
    this.db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  async userFromToken(token) {
    if (!token) return null;
    const { data, error } = await this.db.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return { id: data.user.id, email: data.user.email || null, anonymous: !!data.user.is_anonymous };
  }
  async getProfile(id) {
    const { data } = await this.db.from('profiles').select('*').eq('id', id).maybeSingle();
    return data;
  }
  async ensureProfile(id) {
    let p = await this.getProfile(id);
    if (!p) {
      const { data, error } = await this.db.from('profiles').insert({ id }).select().single();
      if (error && !/duplicate/.test(error.message)) throw error;
      p = data || await this.getProfile(id);
    }
    return p;
  }
  async updateProfile(id, patch) {
    const { data, error } = await this.db.from('profiles').update(Object.assign({}, patch, { updated_at: new Date().toISOString() })).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }
  async profiles(ids) {
    if (!ids.length) return [];
    const { data } = await this.db.from('profiles').select('id,name,avatar,lv,rp').in('id', ids);
    return data || [];
  }
  async createGroup(row) {
    const { data, error } = await this.db.from('groups').insert(row).select().single();
    if (error) throw error;
    return data;
  }
  async groupByCode(code) {
    const { data } = await this.db.from('groups').select('*').eq('code', code).maybeSingle();
    return data;
  }
  async group(id) {
    const { data } = await this.db.from('groups').select('*').eq('id', id).maybeSingle();
    return data;
  }
  async addMember(groupId, userId, role) {
    const { error } = await this.db.from('group_members').upsert({ group_id: groupId, user_id: userId, role: role || 'member' }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  async removeMember(groupId, userId) {
    await this.db.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId);
  }
  async isMember(groupId, userId) {
    const { data } = await this.db.from('group_members').select('user_id').eq('group_id', groupId).eq('user_id', userId).maybeSingle();
    return !!data;
  }
  async myGroups(userId) {
    const { data } = await this.db.from('group_members').select('role, groups(id,name,code,owner,created_at)').eq('user_id', userId);
    const groups = (data || []).map(r => Object.assign({ role: r.role }, r.groups)).filter(g => g.id);
    if (!groups.length) return [];
    const { data: mem } = await this.db.from('group_members').select('group_id').in('group_id', groups.map(g => g.id));
    const count = {};
    (mem || []).forEach(m => { count[m.group_id] = (count[m.group_id] || 0) + 1; });
    return groups.map(g => Object.assign(g, { memberCount: count[g.id] || 0 }));
  }
  async groupMembers(groupId) {
    const { data } = await this.db.from('group_members').select('role, joined_at, user_id, profiles(id,name,avatar,lv,rp)').eq('group_id', groupId);
    return (data || []).map(r => Object.assign({ role: r.role, joinedAt: r.joined_at }, r.profiles));
  }
  async groupPlayerRows(groupId) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.db.from('game_players').select('user_id,mode,rank,pt,wins,deal_ins,hands,best_total,ended_at').eq('group_id', groupId).order('ended_at').range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async setSeasons(groupId, seasons) {
    const { error } = await this.db.from('groups').update({ seasons }).eq('id', groupId);
    if (error) { if (/seasons/.test(error.message)) throw Object.assign(new Error('シーズン機能のSQL（0003_seasons.sql）がまだ実行されていません'), { status: 400 }); throw error; }
  }
  async groupGames(groupId, limit) {
    const { data } = await this.db.from('games').select('id,players,results,rules,end_reason,ended_at').eq('group_id', groupId).order('ended_at', { ascending: false }).limit(limit || 20);
    return data || [];
  }
  async myGames(userId, limit) {
    const { data } = await this.db.from('game_players').select('game_id,rank,score,pt,ended_at,group_id').eq('user_id', userId).order('ended_at', { ascending: false }).limit(limit || 20);
    return data || [];
  }
  async myTotals(userId) {
    const { data } = await this.db.from('game_players').select('rank,pt,wins,deal_ins,hands,riichis,best_total,best_label').eq('user_id', userId);
    return data || [];
  }
  async game(id) {
    const { data } = await this.db.from('games').select('*').eq('id', id).maybeSingle();
    return data;
  }
  async gameParticipant(gameId, userId) {
    const { data } = await this.db.from('game_players').select('user_id').eq('game_id', gameId).eq('user_id', userId).maybeSingle();
    return !!data;
  }
  async insertGame(game, players) {
    let { data, error } = await this.db.from('games').insert(game).select('id').single();
    if (error && /organizer/.test(error.message)) { const g2 = Object.assign({}, game); delete g2.organizer; ({ data, error } = await this.db.from('games').insert(g2).select('id').single()); }
    if (error) throw error;
    if (players.length) {
      const { error: e2 } = await this.db.from('game_players').insert(players.map(p => Object.assign({ game_id: data.id }, p)));
      if (e2) throw e2;
    }
    return data.id;
  }
  async roomByCode(code) {
    const { data } = await this.db.from('rooms').select('*').eq('code', code).in('status', ['lobby', 'playing', 'finished']).order('created_at', { ascending: false }).limit(1);
    return data && data[0] || null;
  }
  async createRoom(row) {
    let { data, error } = await this.db.from('rooms').insert(row).select().single();
    if (error && /organizer/.test(error.message)) { const r2 = Object.assign({}, row); delete r2.organizer; ({ data, error } = await this.db.from('rooms').insert(r2).select().single()); }
    if (error) { if (/duplicate|unique/.test(error.message)) return null; throw error; }
    return data;
  }
  async closeStaleRooms() {
    const cutoff = new Date(Date.now() - 12 * 3600e3).toISOString();
    await this.db.from('rooms').update({ status: 'closed' }).in('status', ['lobby', 'playing', 'finished']).lt('updated_at', cutoff);
  }
  /** 楽観ロック付き更新。version が一致したときだけ書く */
  async updateRoom(id, version, patch) {
    const row = Object.assign({}, patch, { version: version + 1, updated_at: new Date().toISOString() });
    const { data, error } = await this.db.from('rooms').update(row).eq('id', id).eq('version', version).select().maybeSingle();
    if (error) throw error;
    return data;
  }
  /** チャットを部屋に追記（最新50件）。chat 列がまだ無くても対局は止めない */
  async appendChat(roomId, msg) {
    try {
      const { data, error } = await this.db.from('rooms').select('chat').eq('id', roomId).single();
      if (error) throw error;
      const chat = (data.chat || []).concat([msg]).slice(-50);
      const { error: e2 } = await this.db.from('rooms').update({ chat }).eq('id', roomId);
      if (e2) throw e2;
      return true;
    } catch (e) { console.error('appendChat', e.message); return false; }
  }
  /* ---- 主催者コード・運営用 ---- */
  async codeByCode(code) {
    const { data } = await this.db.from('organizer_codes').select('*').eq('code', code).maybeSingle();
    return data;
  }
  async listCodes() {
    const { data, error } = await this.db.from('organizer_codes').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) throw error;
    return data || [];
  }
  async insertCodes(rows) {
    const { data, error } = await this.db.from('organizer_codes').insert(rows).select();
    if (error) throw error;
    return data;
  }
  async updateCode(id, patch) {
    const { error } = await this.db.from('organizer_codes').update(patch).eq('id', id);
    if (error) throw error;
  }
  /** 使用回数を1つ進める。ほかの人と同時に使われたら null */
  async claimCodeUse(id, uses) {
    const { data, error } = await this.db.from('organizer_codes').update({ uses: uses + 1 }).eq('id', id).eq('uses', uses).select().maybeSingle();
    if (error) throw error;
    return data;
  }
  async listOrganizers() {
    const { data, error } = await this.db.from('profiles').select('id,name,avatar,lv,created_at,organizer_status,organizer_since,organizer_code,organizer_note').not('organizer_status', 'is', null);
    if (error) throw error;
    return data || [];
  }
  async profilesByCode(codeId) {
    const { data } = await this.db.from('profiles').select('id,name,organizer_status,organizer_since').eq('organizer_code', codeId);
    return data || [];
  }
  async countProfiles() {
    const { count } = await this.db.from('profiles').select('id', { count: 'exact', head: true });
    return count || 0;
  }
  async adminGames({ organizer, since, limit } = {}) {
    const out = [];
    const max = limit || 5000;
    for (let from = 0; out.length < max; from += 1000) {
      let q = this.db.from('games').select('id,organizer,group_id,rules,players,results,end_reason,started_at,ended_at').order('ended_at', { ascending: false });
      if (organizer) q = q.eq('organizer', organizer);
      if (since) q = q.gte('ended_at', new Date(since).toISOString());
      const { data, error } = await q.range(from, Math.min(from + 999, max - 1));
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async playerRowsForGames(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await this.db.from('game_players').select('game_id,user_id,mode,rank,score,pt,wins,deal_ins,hands,best_total,ended_at').in('game_id', ids.slice(i, i + 200));
      if (error) throw error;
      out.push(...(data || []));
    }
    return out;
  }
  async groupsByOwners(ownerIds) {
    if (!ownerIds.length) return [];
    const { data } = await this.db.from('groups').select('id,name,code,owner,created_at').in('owner', ownerIds);
    const groups = data || [];
    if (!groups.length) return [];
    const { data: mem } = await this.db.from('group_members').select('group_id').in('group_id', groups.map(g => g.id));
    const count = {};
    (mem || []).forEach(m => { count[m.group_id] = (count[m.group_id] || 0) + 1; });
    return groups.map(g => Object.assign(g, { memberCount: count[g.id] || 0 }));
  }
  async groupsByIds(ids) {
    if (!ids.length) return [];
    const { data } = await this.db.from('groups').select('id,name,owner').in('id', ids);
    return data || [];
  }
  async notify(roomId, payload) {
    try {
      await fetch(`${URL}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
        body: JSON.stringify({ messages: [{ topic: `room-${roomId}`, event: 'u', payload }] })
      });
    } catch (e) { /* 通知に失敗してもクライアントは定期取得で追いつく */ }
  }
}

/* ---------------- メモリ（ローカル検証用） ---------------- */
const G = globalThis.__mjMem || (globalThis.__mjMem = {
  profiles: new Map(), groups: new Map(), members: [], rooms: new Map(), games: new Map(), gamePlayers: [], codes: new Map(), bus: new EventEmitter()
});
if (!G.codes) G.codes = new Map();
G.bus.setMaxListeners(200);
const uid = () => crypto.randomUUID();
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));

class MemoryStore {
  get bus() { return G.bus; }
  async userFromToken(token) { return token && /^[0-9a-f-]{36}$/.test(token) ? { id: token, email: null, anonymous: true } : null; }
  async getProfile(id) { return clone(G.profiles.get(id) || null); }
  async ensureProfile(id) {
    if (!G.profiles.has(id)) G.profiles.set(id, { id, name: 'ななし', avatar: null, lv: 0, rp: 0, organizer_status: null, created_at: new Date().toISOString() });
    return clone(G.profiles.get(id));
  }
  async updateProfile(id, patch) { const p = Object.assign(G.profiles.get(id), clone(patch)); return clone(p); }
  async profiles(ids) { return ids.map(i => G.profiles.get(i)).filter(Boolean).map(clone); }
  async createGroup(row) { const g = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row); G.groups.set(g.id, g); return clone(g); }
  async groupByCode(code) { for (const g of G.groups.values()) if (g.code === code) return clone(g); return null; }
  async group(id) { return clone(G.groups.get(id) || null); }
  async addMember(groupId, userId, role) { if (!G.members.some(m => m.group_id === groupId && m.user_id === userId)) G.members.push({ group_id: groupId, user_id: userId, role: role || 'member', joined_at: new Date().toISOString() }); }
  async removeMember(groupId, userId) { G.members = G.members.filter(m => !(m.group_id === groupId && m.user_id === userId)); }
  async isMember(groupId, userId) { return G.members.some(m => m.group_id === groupId && m.user_id === userId); }
  async myGroups(userId) {
    return G.members.filter(m => m.user_id === userId).map(m => Object.assign({ role: m.role, memberCount: G.members.filter(x => x.group_id === m.group_id).length }, clone(G.groups.get(m.group_id))));
  }
  async groupMembers(groupId) {
    return G.members.filter(m => m.group_id === groupId).map(m => Object.assign({ role: m.role, joinedAt: m.joined_at }, clone(G.profiles.get(m.user_id))));
  }
  async groupPlayerRows(groupId) { return G.gamePlayers.filter(x => x.group_id === groupId).map(clone); }
  async setSeasons(groupId, seasons) { const g = G.groups.get(groupId); if (g) g.seasons = clone(seasons); }
  async groupGames(groupId, limit) { return [...G.games.values()].filter(g => g.group_id === groupId).sort((a, b) => b.ended_at.localeCompare(a.ended_at)).slice(0, limit || 20).map(clone); }
  async myGames(userId, limit) { return G.gamePlayers.filter(r => r.user_id === userId).sort((a, b) => b.ended_at.localeCompare(a.ended_at)).slice(0, limit || 20).map(clone); }
  async myTotals(userId) { return G.gamePlayers.filter(r => r.user_id === userId).map(clone); }
  async game(id) { return clone(G.games.get(id) || null); }
  async gameParticipant(gameId, userId) { return G.gamePlayers.some(r => r.game_id === gameId && r.user_id === userId); }
  async insertGame(game, players) {
    const id = uid(); const ended = game.ended_at || new Date().toISOString();
    G.games.set(id, Object.assign({ id, ended_at: ended }, clone(game)));
    players.forEach(p => G.gamePlayers.push(Object.assign({ game_id: id, ended_at: ended }, clone(p))));
    return id;
  }
  async roomByCode(code) {
    const list = [...G.rooms.values()].filter(r => r.code === code && ['lobby', 'playing', 'finished'].includes(r.status));
    return clone(list.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null);
  }
  async createRoom(row) {
    if ([...G.rooms.values()].some(r => r.code === row.code && ['lobby', 'playing', 'finished'].includes(r.status))) return null;
    const r = Object.assign({ id: uid(), version: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, clone(row));
    G.rooms.set(r.id, r); return clone(r);
  }
  async closeStaleRooms() {}
  async updateRoom(id, version, patch) {
    const r = G.rooms.get(id); if (!r || r.version !== version) return null;
    Object.assign(r, clone(patch), { version: version + 1, updated_at: new Date().toISOString() });
    return clone(r);
  }
  async appendChat(roomId, msg) { const r = G.rooms.get(roomId); if (!r) return false; r.chat = (r.chat || []).concat([clone(msg)]).slice(-50); return true; }
  async codeByCode(code) { for (const c of G.codes.values()) if (c.code === code) return clone(c); return null; }
  async listCodes() { return [...G.codes.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(clone); }
  async insertCodes(rows) { return rows.map(r => { const c = Object.assign({ id: uid(), uses: 0, revoked: false, max_uses: 1, label: '', expires_at: null, created_at: new Date().toISOString() }, clone(r)); G.codes.set(c.id, c); return clone(c); }); }
  async updateCode(id, patch) { const c = G.codes.get(id); if (c) Object.assign(c, clone(patch)); }
  async claimCodeUse(id, uses) { const c = G.codes.get(id); if (!c || c.uses !== uses) return null; c.uses++; return clone(c); }
  async listOrganizers() { return [...G.profiles.values()].filter(p => p.organizer_status).map(clone); }
  async profilesByCode(codeId) { return [...G.profiles.values()].filter(p => p.organizer_code === codeId).map(clone); }
  async countProfiles() { return G.profiles.size; }
  async adminGames({ organizer, since, limit } = {}) {
    return [...G.games.values()].filter(g => (!organizer || g.organizer === organizer) && (!since || new Date(g.ended_at).getTime() >= since))
      .sort((a, b) => b.ended_at.localeCompare(a.ended_at)).slice(0, limit || 5000).map(clone);
  }
  async playerRowsForGames(ids) { const set = new Set(ids); return G.gamePlayers.filter(r => set.has(r.game_id)).map(clone); }
  async groupsByOwners(ownerIds) { const set = new Set(ownerIds); return [...G.groups.values()].filter(g => set.has(g.owner)).map(g => Object.assign(clone(g), { memberCount: G.members.filter(m => m.group_id === g.id).length })); }
  async groupsByIds(ids) { const set = new Set(ids); return [...G.groups.values()].filter(g => set.has(g.id)).map(clone); }
  async notify(roomId, payload) { G.bus.emit('room-' + roomId, payload); }
}

export const store = isDev ? new MemoryStore() : new SupabaseStore();
