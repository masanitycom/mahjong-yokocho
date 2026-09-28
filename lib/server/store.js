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
  async groupRanking(groupId) {
    const { data } = await this.db.from('group_rankings').select('*').eq('group_id', groupId);
    return data || [];
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
    const { data, error } = await this.db.from('games').insert(game).select('id').single();
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
    const { data, error } = await this.db.from('rooms').insert(row).select().single();
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
  profiles: new Map(), groups: new Map(), members: [], rooms: new Map(), games: new Map(), gamePlayers: [], bus: new EventEmitter()
});
G.bus.setMaxListeners(200);
const uid = () => crypto.randomUUID();
const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));

class MemoryStore {
  get bus() { return G.bus; }
  async userFromToken(token) { return token && /^[0-9a-f-]{36}$/.test(token) ? { id: token, email: null, anonymous: true } : null; }
  async getProfile(id) { return clone(G.profiles.get(id) || null); }
  async ensureProfile(id) {
    if (!G.profiles.has(id)) G.profiles.set(id, { id, name: 'ななし', avatar: null, lv: 0, rp: 0, created_at: new Date().toISOString() });
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
  async groupRanking(groupId) {
    const by = {};
    for (const r of G.gamePlayers.filter(x => x.group_id === groupId)) {
      const k = r.user_id + ':' + (r.mode || 4);
      const a = by[k] || (by[k] = { group_id: groupId, user_id: r.user_id, mode: r.mode || 4, games: 0, total_pt: 0, rs: 0, tops: 0, lasts: 0, wins: 0, deal_ins: 0, hands: 0, best_total: null });
      a.games++; a.total_pt = Math.round((a.total_pt + Number(r.pt)) * 10) / 10; a.rs += r.rank; a.tops += r.rank === 1; a.lasts += r.rank === 4;
      a.wins += r.wins; a.deal_ins += r.deal_ins; a.hands += r.hands; a.best_total = Math.max(a.best_total || 0, r.best_total || 0) || null;
    }
    return Object.values(by).map(a => Object.assign(a, { avg_rank: Math.round(a.rs / a.games * 100) / 100 }));
  }
  async groupGames(groupId, limit) { return [...G.games.values()].filter(g => g.group_id === groupId).sort((a, b) => b.ended_at.localeCompare(a.ended_at)).slice(0, limit || 20).map(clone); }
  async myGames(userId, limit) { return G.gamePlayers.filter(r => r.user_id === userId).sort((a, b) => b.ended_at.localeCompare(a.ended_at)).slice(0, limit || 20).map(clone); }
  async myTotals(userId) { return G.gamePlayers.filter(r => r.user_id === userId).map(clone); }
  async game(id) { return clone(G.games.get(id) || null); }
  async gameParticipant(gameId, userId) { return G.gamePlayers.some(r => r.game_id === gameId && r.user_id === userId); }
  async insertGame(game, players) {
    const id = uid(); const ended = new Date().toISOString();
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
  async notify(roomId, payload) { G.bus.emit('room-' + roomId, payload); }
}

export const store = isDev ? new MemoryStore() : new SupabaseStore();
