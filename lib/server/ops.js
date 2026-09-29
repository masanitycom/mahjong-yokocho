// API の中身。route.js から op 名で呼ばれる。
import { store } from './store.js';
import { isAvatarKey } from '../avatars.js';
import { createHash, randomBytes } from 'node:crypto';
// 席の引き継ぎ用の合言葉。本人の端末にだけ渡し、サーバーにはハッシュだけ残す
const newClaim = () => randomBytes(18).toString('base64url');
const hashClaim = t => createHash('sha256').update(String(t || '')).digest('base64url');
import { advance, submit } from './replay.js';
import { scoring, UMA3, UMA4 } from '../scoring.js';

export class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = m => new ApiError(400, m);
const forbidden = m => new ApiError(403, m || 'この操作はできません');
const notFound = m => new ApiError(404, m || '見つかりません');

const STYLES = ['attack', 'balance', 'defense'];
const CPU_NAMES = ['テツ', 'ミサキ', 'ゲン', 'サヨ', 'リュウ', 'ハナ'];
const DEFAULT_RULES = { length: 'tonpuu', aka: true, kuitan: true, yakitori: false, wareme: false, timer: true, batsu: '' };
const rankGain = (rank, len, sanma) => sanma ? (len === 'hanchan' ? [90, 5, -50] : [50, 0, -30])[rank - 1] : (len === 'hanchan' ? [90, 35, -15, -50] : [50, 20, -10, -30])[rank - 1];
const VOICE_IDS = ['zunda','metan','ryusei','takehiro','kotaro','sora','tsumugi','no7'];
const cleanVoice = v => VOICE_IDS.includes(v) ? v : null;
const seatCount = rules => rules && rules.sanma ? 3 : 4;
const needRp = lv => 100 + lv * 40;

function cleanText(s, max) { return String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max); }
function cleanName(s, fallback) { s = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10); return s || fallback; }
function cleanAvatar(a) {
  if (a === null) return null;
  if (typeof a !== 'string') return undefined;
  if (isAvatarKey(a)) return a;
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(a) || a.length > 60000) throw bad('写真のサイズが大きすぎます');
  return a;
}
function cleanRules(r) {
  r = r || {};
  return {
    sanma: !!r.sanma,
    length: r.length === 'hanchan' ? 'hanchan' : 'tonpuu',
    aka: r.aka !== false, kuitan: r.kuitan !== false, yakitori: !!r.yakitori, wareme: !!r.wareme,
    timer: r.timer !== false, batsu: cleanText(r.batsu, 40), name: cleanText(r.name, 16) || randomTableName(),
    ...(() => { const sc = scoring({ sanma: !!r.sanma, uma: (r.sanma ? UMA3 : UMA4)[r.uma] ? r.uma : undefined, oka: r.oka });
      return { uma: sc.umaKey, oka: sc.oka, startScore: sc.startScore, returnScore: sc.returnScore, umaValues: sc.uma }; })()
  };
}
const TABLE_NAMES = ['負けたら奢り卓', '役満祈願卓', 'ハコ下注意卓', '今夜は帰さない卓', '親っかぶり卓', '金曜の夜卓', '一発逆転卓', '赤5の奪い合い卓', '終電までに終わる卓', 'リーチ一発ツモ卓', '裏ドラ頼み卓', 'ベタオリ禁止卓', '焼き鳥回避卓', '点棒の貸し借り卓', '横丁の奥の卓', '常連だけの卓'];
const randomTableName = () => TABLE_NAMES[Math.floor(Math.random() * TABLE_NAMES.length)];
const code4 = () => String(Math.floor(1000 + Math.random() * 9000));
const code6 = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };

/* ---------------- プロフィール ---------------- */
async function me(u) {
  const profile = await store.ensureProfile(u.id);
  const groups = await store.myGroups(u.id);
  const rows = await store.myTotals(u.id);
  const t = { games: rows.length, ranks: [0, 0, 0, 0], pt: 0, wins: 0, dealIns: 0, hands: 0, riichis: 0, best: null };
  for (const r of rows) {
    t.ranks[r.rank - 1]++; t.pt += Number(r.pt); t.wins += r.wins; t.dealIns += r.deal_ins; t.hands += r.hands; t.riichis += r.riichis;
    if (r.best_total && (!t.best || r.best_total > t.best.total)) t.best = { total: r.best_total, label: r.best_label };
  }
  t.pt = Math.round(t.pt * 10) / 10;
  return { profile, groups, stats: t, account: { anonymous: u.anonymous, email: u.email } };
}
async function updateProfile(u, a) {
  await store.ensureProfile(u.id);
  const patch = {};
  if ('name' in a) patch.name = cleanName(a.name, 'ななし');
  if ('avatar' in a) { const av = cleanAvatar(a.avatar); if (av !== undefined) patch.avatar = av; }
  return { profile: await store.updateProfile(u.id, patch) };
}

/* ---------------- グループ ---------------- */
async function createGroup(u, a) {
  await store.ensureProfile(u.id);
  const name = cleanName(a.name, '');
  if (!name) throw bad('グループ名を入れてください');
  let g = null;
  for (let i = 0; i < 10 && !g; i++) {
    try { g = await store.createGroup({ name, code: code6(), owner: u.id }); } catch (e) { if (!/duplicate|unique/.test(e.message)) throw e; }
  }
  await store.addMember(g.id, u.id, 'owner');
  return { group: g };
}
async function joinGroup(u, a) {
  await store.ensureProfile(u.id);
  const g = await store.groupByCode(String(a.code || '').toUpperCase().trim());
  if (!g) throw notFound('招待コードが見つかりません');
  await store.addMember(g.id, u.id, 'member');
  return { group: g };
}
async function leaveGroup(u, a) {
  const g = await store.group(a.id);
  if (!g) throw notFound();
  if (g.owner === u.id) throw bad('作成者は抜けられません');
  await store.removeMember(g.id, u.id);
  return { ok: true };
}
// 期間の計算は日本時間で行う
const JST = 9 * 3600e3;
const monthKey = t => { const d = new Date(new Date(t).getTime() + JST); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const monthRange = key => { const [y, m] = key.split('-').map(Number); return [Date.UTC(y, m - 1, 1) - JST, Date.UTC(y, m, 1) - JST]; };
function aggregate(rows) {
  const by = {};
  for (const r of rows) {
    const mode = Number(r.mode || 4), k = r.user_id + ':' + mode;
    const a = by[k] || (by[k] = { user_id: r.user_id, mode, games: 0, total_pt: 0, rs: 0, tops: 0, lasts: 0, wins: 0, deal_ins: 0, hands: 0, best_total: null });
    a.games++; a.total_pt = Math.round((a.total_pt + Number(r.pt)) * 10) / 10; a.rs += r.rank;
    a.tops += r.rank === 1 ? 1 : 0; a.lasts += r.rank === mode ? 1 : 0;
    a.wins += r.wins || 0; a.deal_ins += r.deal_ins || 0; a.hands += r.hands || 0;
    if (r.best_total && (!a.best_total || r.best_total > a.best_total)) a.best_total = r.best_total;
  }
  return Object.values(by).map(a => Object.assign(a, { avg_rank: Math.round(a.rs / a.games * 100) / 100 }));
}
function periodsOf(g, rows) {
  const now = Date.now();
  const months = new Set([monthKey(now)]);
  rows.forEach(r => months.add(monthKey(r.ended_at)));
  const seasons = (g.seasons || []).slice().sort((a, b) => a.start - b.start).map((s, i, arr) => ({ id: s.id, name: s.name, start: s.start, end: arr[i + 1] ? arr[i + 1].start : null }));
  return { months: [...months].sort().reverse(), seasons: seasons.reverse(), current: monthKey(now) };
}
async function getGroup(u, a) {
  const g = await store.group(a.id);
  if (!g || !(await store.isMember(g.id, u.id))) throw notFound('グループが見つかりません');
  const [members, rows, games] = await Promise.all([store.groupMembers(g.id), store.groupPlayerRows(g.id), store.groupGames(g.id, 30)]);
  const periods = periodsOf(g, rows);
  let period = String(a.period || 'month:' + periods.current);
  let from = -Infinity, to = Infinity, label = '通算';
  if (period.startsWith('month:')) {
    const key = period.slice(6);
    if (!/^\d{4}-\d{2}$/.test(key)) period = 'month:' + periods.current;
    [from, to] = monthRange(period.slice(6));
    const [y, m] = period.slice(6).split('-');
    label = `${Number(y)}年${Number(m)}月`;
  } else if (period.startsWith('season:')) {
    const s = periods.seasons.find(x => x.id === period.slice(7));
    if (s) { from = s.start; to = s.end || Infinity; label = s.name; } else period = 'all';
  } else period = 'all';
  const inRange = rows.filter(r => { const t = new Date(r.ended_at).getTime(); return t >= from && t < to; });
  return { group: g, members, ranking: aggregate(inRange), games, isOwner: g.owner === u.id, periods, period, periodLabel: label };
}
async function startSeason(u, a) {
  const g = await store.group(a.id);
  if (!g || g.owner !== u.id) throw forbidden('グループの作成者だけがシーズンを区切れます');
  const seasons = (g.seasons || []).slice();
  const name = cleanText(a.name, 16) || `第${seasons.length + 1}期`;
  const s = { id: crypto.randomUUID().slice(0, 8), name, start: Date.now() };
  seasons.push(s);
  try { await store.setSeasons(g.id, seasons); }
  catch (e) { if (e.status === 400) throw bad(e.message); throw e; }
  return { season: s };
}
async function getGame(u, a) {
  const game = await store.game(a.id);
  if (!game) throw notFound();
  const ok = (game.group_id && await store.isMember(game.group_id, u.id)) || await store.gameParticipant(game.id, u.id);
  if (!ok) throw notFound();
  return { game };
}

/* ---------------- 卓 ---------------- */
function roomInfo(room, u, profiles) {
  const pmap = {}; (profiles || []).forEach(p => { pmap[p.id] = p; });
  const mySeat = room.seats.findIndex(s => s.userId === u.id);
  return {
    id: room.id, code: room.code, status: room.status, groupId: room.group_id, rules: room.rules,
    isHost: room.host === u.id, mySeat, version: room.version, gameId: room.game_id || null,
    chat: mySeat >= 0 ? (room.chat || []) : [],
    seats: room.seats.slice(0, seatCount(room.rules)).map((s, i) => ({
      seat: i, cpu: !!s.cpu, style: s.style || 'balance', occupied: !!(s.userId || s.cpu), isMe: s.userId === u.id,
      isHost: s.userId && s.userId === room.host,
      name: s.userId ? (pmap[s.userId] && pmap[s.userId].name || s.name) : s.cpu ? s.name : null,
      avatar: s.userId && pmap[s.userId] ? pmap[s.userId].avatar : null,
      lv: s.userId && pmap[s.userId] ? pmap[s.userId].lv : null,
      voice: s.voice || null
    }))
  };
}
async function loadRoom(code) {
  const room = await store.roomByCode(String(code || '').trim());
  if (!room) throw notFound('その番号の卓はありません');
  return room;
}
async function roomPayload(room, u) {
  const ids = room.seats.map(s => s.userId).filter(Boolean);
  const profiles = await store.profiles(ids);
  const info = roomInfo(room, u, profiles);
  let view = null;
  if (room.views && info.mySeat >= 0 && room.views[info.mySeat]) view = room.views[info.mySeat];
  let groupName = null;
  if (room.group_id) { const g = await store.group(room.group_id); groupName = g && g.name; }
  return { room: Object.assign(info, { groupName }), view, now: Date.now() };
}
/** 部屋の更新を楽観ロックで行う。fn(room) が patch を返す */
async function mutate(code, fn) {
  for (let i = 0; i < 6; i++) {
    const room = await loadRoom(code);
    const patch = await fn(room);
    if (!patch) return room;
    const saved = await store.updateRoom(room.id, room.version, patch);
    if (saved) { await store.notify(saved.id, { v: saved.version }); return saved; }
  }
  throw new ApiError(409, '混み合っています。もう一度お試しください');
}

async function createRoom(u, a) {
  await store.ensureProfile(u.id);
  await store.closeStaleRooms();
  let groupId = null;
  if (a.groupId) {
    if (!(await store.isMember(a.groupId, u.id))) throw forbidden('グループのメンバーではありません');
    groupId = a.groupId;
  }
  const prof = await store.getProfile(u.id);
  const claim = newClaim();
  const seats = [{ userId: u.id, name: prof.name, voice: cleanVoice(a.voice), claim: hashClaim(claim) }, { userId: null }, { userId: null }, { userId: null }];
  let room = null;
  for (let i = 0; i < 30 && !room; i++) {
    room = await store.createRoom({ code: code4(), group_id: groupId, host: u.id, status: 'lobby', rules: cleanRules(Object.assign({}, DEFAULT_RULES, a.rules)), seats });
  }
  if (!room) throw new ApiError(503, '卓が満席です。少し待ってからお試しください');
  return Object.assign(await roomPayload(room, u), { claim });
}
async function joinRoom(u, a) {
  await store.ensureProfile(u.id);
  const prof = await store.getProfile(u.id);
  let claim = null;
  const saved = await mutate(a.code, room => {
    if (room.seats.some(s => s.userId === u.id)) return null;
    if (room.status !== 'lobby') throw bad('この卓はもう始まっています');
    const i = room.seats.slice(0, seatCount(room.rules)).findIndex(s => !s.userId && !s.cpu);
    if (i < 0) throw bad('満席です');
    claim = newClaim();
    const seats = room.seats.slice(); seats[i] = { userId: u.id, name: prof.name, voice: cleanVoice(a.voice), claim: hashClaim(claim) };
    return { seats };
  });
  if (saved.group_id) await store.addMember(saved.group_id, u.id, 'member');
  return Object.assign(await roomPayload(saved, u), claim ? { claim } : {});
}
async function getRoom(u, a) {
  const room = await loadRoom(a.code);
  return roomPayload(room, u);
}
async function seatOp(u, a) {
  const saved = await mutate(a.code, room => {
    if (room.host !== u.id) throw forbidden('ホストだけが席を変更できます');
    if (room.status !== 'lobby') throw bad('対局中は変更できません');
    const i = Number(a.seat);
    if (!(i >= 0 && i < seatCount(room.rules)) || room.seats[i].userId === room.host) throw bad('その席は変更できません');
    const seats = room.seats.slice();
    if (a.op === 'cpu') {
      const used = seats.filter(s => s.cpu).map(s => s.name);
      seats[i] = { userId: null, cpu: true, name: CPU_NAMES.find(n => !used.includes(n)) || 'CPU', style: STYLES.includes(a.style) ? a.style : 'balance' };
    } else if (a.op === 'style' && seats[i].cpu) {
      seats[i] = Object.assign({}, seats[i], { style: STYLES.includes(a.style) ? a.style : 'balance' });
    } else seats[i] = { userId: null };
    return { seats };
  });
  return roomPayload(saved, u);
}
async function setRules(u, a) {
  const saved = await mutate(a.code, room => {
    if (room.host !== u.id) throw forbidden('ホストだけがルールを変更できます');
    if (room.status !== 'lobby') throw bad('対局中は変更できません');
    return { rules: cleanRules(a.rules) };
  });
  return roomPayload(saved, u);
}
async function leaveRoom(u, a) {
  await mutate(a.code, room => {
    const i = room.seats.findIndex(s => s.userId === u.id);
    if (i < 0) return null;
    if (room.host === u.id && room.status === 'lobby') return { status: 'closed' };
    if (room.status !== 'lobby') return null;
    const seats = room.seats.slice(); seats[i] = { userId: null };
    return { seats };
  });
  return { ok: true };
}

async function startGame(u, a) {
  const saved = await mutate(a.code, async room => {
    if (room.host !== u.id) throw forbidden('ホストだけが開始できます');
    if (room.status === 'playing') return null;
    const profiles = await store.profiles(room.seats.map(s => s.userId).filter(Boolean));
    const pmap = {}; profiles.forEach(p => { pmap[p.id] = p; });
    const used = room.seats.filter(s => s.cpu).map(s => s.name);
    const n = seatCount(room.rules);
    if (room.seats.slice(n).some(s => s.userId)) throw bad('3人打ちでは4番目の席は使えません。その人に一度退出してもらってください');
    const seats = room.seats.slice(0, n).map(s => {
      if (s.userId || s.cpu) return s;
      const name = CPU_NAMES.find(n => !used.includes(n)) || 'CPU'; used.push(name);
      return { userId: null, cpu: true, name, style: 'balance' };
    });
    const players = seats.map(s => s.userId ? { name: (pmap[s.userId] && pmap[s.userId].name) || s.name, human: true, userId: s.userId } : { name: s.name, human: false, style: s.style || 'balance' });
    const game = { seed: Math.floor(Math.random() * 2 ** 31), rules: room.rules, players, log: {}, prompts: {}, eventCount: 0, startedAt: new Date().toISOString() };
    const r = await advance(game);
    return { seats: seats.concat(room.seats.slice(n).map(() => ({ userId: null }))), status: 'playing', game, views: r.views, game_id: null };
  });
  return roomPayload(saved, u);
}

async function finalize(room, game, r) {
  const results = r.final.map(f => ({ seat: f.seat, rank: f.rank, score: f.score, pt: f.pt, yakitori: !!f.yakitori }));
  const hands = r.records.map(x => x.kind === 'win'
    ? { kind: 'win', round: x.round, honba: x.honba, winner: x.winner, from: x.from, tsumo: x.tsumo, total: x.res.total, han: x.res.han, fu: x.res.fu, limit: x.res.limit || '', yakuman: x.res.yakuman, yaku: x.res.yaku.map(y => y.name), deltas: x.deltas }
    : { kind: 'draw', round: x.round, honba: x.honba, reason: x.reason, tenpai: x.tenpai, deltas: x.deltas });
  const players = game.players.map((p, i) => ({ seat: i, userId: p.userId || null, name: p.name, cpu: !p.human }));
  const rows = [];
  for (const res of results) {
    const p = game.players[res.seat];
    if (!p.human || !p.userId) continue;
    const st = r.players[res.seat];
    rows.push({
      user_id: p.userId, group_id: room.group_id, mode: game.players.length, seat: res.seat, rank: res.rank, score: res.score, pt: res.pt,
      wins: st.wins, deal_ins: st.dealIns, riichis: st.riichis, hands: st.hands,
      best_total: st.bestHand ? st.bestHand.total : null, best_label: st.bestHand ? `${st.bestHand.limit || ''} ${st.bestHand.yaku}`.trim().slice(0, 80) : null
    });
  }
  const gameId = await store.insertGame({ room_id: room.id, group_id: room.group_id, rules: game.rules, players, results, hands, end_reason: r.endReason, started_at: game.startedAt }, rows);
  // 段位
  const rankChanges = {};
  for (const row of rows) {
    const prof = await store.getProfile(row.user_id);
    if (!prof) continue;
    let lv = prof.lv, rp = prof.rp;
    const gain = rankGain(row.rank, game.rules.length, game.players.length === 3);
    let change = '';
    if (lv < 15) {
      rp += gain;
      if (rp >= needRp(lv)) { rp -= needRp(lv); lv++; change = 'up'; }
      else if (rp < 0) { if (lv >= 3) { lv--; rp = Math.floor(needRp(lv) / 2); change = 'down'; } else rp = 0; }
    }
    await store.updateProfile(row.user_id, { lv, rp });
    rankChanges[row.user_id] = { gain, lv, rp, change, before: prof.lv };
  }
  return { gameId, rankChanges };
}

async function progress(u, code, fn) {
  let payload = null;
  const saved = await mutate(code, async room => {
    if (room.status !== 'playing' || !room.game) return null;
    const game = JSON.parse(JSON.stringify(room.game));
    const before = JSON.stringify(game.log);
    const ok = await fn(room, game);
    if (ok === false) return null;
    const r = await advance(game);
    if (JSON.stringify(game.log) === before && ok !== true) return null;
    const patch = { game, views: r.views };
    if (r.done) {
      const fin = await finalize(room, game, r);
      patch.status = 'finished'; patch.game_id = fin.gameId;
      for (const s of Object.keys(r.views)) {
        const pl = game.players[s];
        r.views[s].rank = fin.rankChanges[pl.userId] || null;
        r.views[s].gameId = fin.gameId;
      }
    }
    return patch;
  });
  payload = await roomPayload(saved, u);
  return payload;
}
async function act(u, a) {
  return progress(u, a.code, async (room, game) => {
    const seat = room.seats.findIndex(s => s.userId === u.id);
    if (seat < 0) throw forbidden('この卓のプレイヤーではありません');
    const ok = await submit(game, seat, String(a.key), a.action);
    return ok ? true : false;
  });
}
async function tick(u, a) {
  return progress(u, a.code, async () => undefined);
}
async function stamp(u, a) {
  const room = await loadRoom(a.code);
  const seat = room.seats.findIndex(s => s.userId === u.id);
  if (seat < 0) throw forbidden();
  const text = String(a.text || '').slice(0, 12);
  await store.notify(room.id, { stamp: { seat, text } });
  return { ok: true };
}
/** 端末の読み込み直しなどで別人扱いになったとき、合言葉で自分の席に戻る */
async function reclaim(u, a) {
  await store.ensureProfile(u.id);
  const h = hashClaim(a.token);
  let seatName = null;
  const saved = await mutate(a.code, room => {
    const i = room.seats.findIndex(s => s.claim && s.claim === h);
    if (i < 0) throw notFound('席の引き継ぎ情報が見つかりません');
    if (room.seats[i].userId === u.id) return null;
    const old = room.seats[i].userId;
    seatName = room.seats[i].name;
    const seats = room.seats.map((s, k) => k === i ? Object.assign({}, s, { userId: u.id }) : (s.userId === u.id ? { userId: null } : s));
    const patch = { seats };
    if (room.host === old) patch.host = u.id;
    if (room.game && room.game.players && room.game.players[i]) {
      const game = JSON.parse(JSON.stringify(room.game));
      game.players[i].userId = u.id;
      patch.game = game;
    }
    return patch;
  });
  const prof = await store.getProfile(u.id);
  if (seatName && (!prof.name || prof.name === 'ななし')) await store.updateProfile(u.id, { name: seatName });
  if (saved.group_id) await store.addMember(saved.group_id, u.id, 'member');
  return roomPayload(saved, u);
}
async function setVoice(u, a) {
  const voice = cleanVoice(a.voice); if (!voice) throw bad('その声はありません');
  const saved = await mutate(a.code, room => {
    const i = room.seats.findIndex(s => s.userId === u.id);
    if (i < 0 || room.seats[i].voice === voice) return null;
    const seats = room.seats.slice(); seats[i] = Object.assign({}, seats[i], { voice });
    return { seats };
  });
  return roomPayload(saved, u);
}
/* ---------- 通話（P2P）: 接続の合図を中継し、TURN の認証情報を配る ---------- */
const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
let turnCache = { at: 0, servers: null };
async function rtcIce(u, a) {
  const room = await loadRoom(a.code);
  if (room.seats.findIndex(s => s.userId === u.id) < 0) throw forbidden();
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID, token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return { iceServers: STUN, turn: false };
  if (turnCache.servers && Date.now() - turnCache.at < 6 * 3600e3) return { iceServers: turnCache.servers, turn: true };
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: 86400 })
    });
    if (!res.ok) throw new Error('TURN ' + res.status);
    const j = await res.json();
    const list = Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
    // ブラウザが嫌うポート53のURLは除く
    const servers = list.map(x => Object.assign({}, x, { urls: [].concat(x.urls).filter(u => !/:53(\?|$)/.test(u)) }));
    turnCache = { at: Date.now(), servers };
    return { iceServers: servers, turn: true };
  } catch (e) {
    console.error('turn', e.message);
    return { iceServers: STUN, turn: false };
  }
}
async function rtc(u, a) {
  const room = await loadRoom(a.code);
  const from = room.seats.findIndex(s => s.userId === u.id);
  if (from < 0) throw forbidden();
  const kind = ['hello', 'offer', 'answer', 'bye', 'state'].includes(a.kind) ? a.kind : null;
  if (!kind) throw bad('不明な合図です');
  const to = Number.isInteger(a.to) && a.to >= 0 && a.to < 4 ? a.to : -1;
  const sdp = typeof a.sdp === 'string' ? a.sdp.slice(0, 20000) : null;
  await store.notify(room.id, { rtc: { from, to, kind, sdp, muted: !!a.muted, n: String(a.n || '').slice(0, 40) } });
  return { ok: true };
}
async function chat(u, a) {
  const room = await loadRoom(a.code);
  const seat = room.seats.findIndex(s => s.userId === u.id);
  if (seat < 0) throw forbidden('この卓のプレイヤーではありません');
  const text = cleanText(a.text, 60);
  if (!text) throw bad('メッセージが空です');
  const prof = await store.getProfile(u.id);
  const msg = { id: crypto.randomUUID(), seat, name: (prof && prof.name) || room.seats[seat].name || '?', text, t: Date.now() };
  await store.appendChat(room.id, msg);
  await store.notify(room.id, { chat: msg });
  return { msg };
}
async function rematch(u, a) {
  const saved = await mutate(a.code, room => {
    if (room.host !== u.id) throw forbidden('ホストだけが再戦を始められます');
    if (room.status !== 'finished') return null;
    return { status: 'lobby', game: null, views: null, game_id: null };
  });
  return roomPayload(saved, u);
}

export const OPS = {
  me, updateProfile, createGroup, joinGroup, leaveGroup, getGroup, getGame,
  createRoom, joinRoom, getRoom, seatOp, setRules, leaveRoom, startGame, act, tick, stamp, chat, setVoice, rematch, startSeason, rtcIce, rtc, reclaim
};
