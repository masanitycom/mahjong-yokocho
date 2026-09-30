// 運営（SaaS 管理者）用の API。/api/admin から呼ばれる。
// 認証は環境変数 ADMIN_PASSWORD。ローカル検証モードで未設定なら "dev"。
import { createHash, timingSafeEqual, randomInt } from 'node:crypto';
import { store, isDev } from './store.js';
import { ApiError } from './ops.js';
import { UMA3, UMA4 } from '../scoring.js';

const bad = m => new ApiError(400, m);
const DAY = 86400e3, JST = 9 * 3600e3;

export function adminPasswordConfigured() { return !!process.env.ADMIN_PASSWORD || isDev; }
export function checkAdmin(key) {
  const pass = process.env.ADMIN_PASSWORD || (isDev ? 'dev' : '');
  if (!pass || !key) return false;
  const a = createHash('sha256').update(String(key)).digest();
  const b = createHash('sha256').update(pass).digest();
  return timingSafeEqual(a, b);
}

/* ---------- 集計の部品 ---------- */
const dayKey = t => { const d = new Date(new Date(t).getTime() + JST); return d.toISOString().slice(0, 10); };
const monthKey = t => dayKey(t).slice(0, 7);
const humans = g => (g.players || []).filter(p => !p.cpu && p.userId);
function periodRange(period) {
  const now = Date.now();
  if (!period || period === 'all') return { from: 0, to: Infinity, label: '通算' };
  if (/^days:\d+$/.test(period)) { const n = Number(period.slice(5)); return { from: now - n * DAY, to: Infinity, label: `直近${n}日` }; }
  if (/^month:\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.slice(6).split('-').map(Number);
    return { from: Date.UTC(y, m - 1, 1) - JST, to: Date.UTC(y, m, 1) - JST, label: `${y}年${m}月` };
  }
  return { from: 0, to: Infinity, label: '通算' };
}
const inRange = (g, r) => { const t = new Date(g.ended_at).getTime(); return t >= r.from && t < r.to; };
function ruleSummary(rules) {
  const r = rules || {};
  const umaMap = r.sanma ? UMA3 : UMA4;
  const uma = 'ウマ' + (umaMap[r.uma] ? umaMap[r.uma].label : (r.uma || '標準'));
  return {
    mode: r.sanma ? '3人打ち' : '4人打ち',
    length: r.length === 'hanchan' ? '半荘' : '東風',
    uma: String(uma), oka: r.oka !== false,
    options: [r.aka !== false ? '赤あり' : '赤なし', r.kuitan !== false ? '喰いタンあり' : '喰いタンなし', r.yakitori ? '焼き鳥' : '', r.wareme ? '割れ目' : ''].filter(Boolean),
    name: r.name || '', batsu: r.batsu || ''
  };
}
function ruleStats(games) {
  const n = games.length || 1;
  const count = (f) => Math.round(games.filter(f).length / n * 100);
  const uma = {};
  games.forEach(g => { const s = ruleSummary(g.rules); const k = `${s.mode}・${s.uma}`; uma[k] = (uma[k] || 0) + 1; });
  return {
    total: games.length,
    sanma: count(g => g.rules && g.rules.sanma),
    hanchan: count(g => g.rules && g.rules.length === 'hanchan'),
    aka: count(g => !g.rules || g.rules.aka !== false),
    yakitori: count(g => g.rules && g.rules.yakitori),
    wareme: count(g => g.rules && g.rules.wareme),
    uma: Object.entries(uma).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k, count: v }))
  };
}
function playerRanking(rows) {
  const by = {};
  for (const r of rows) {
    const a = by[r.user_id] || (by[r.user_id] = { userId: r.user_id, games: 0, pt: 0, rankSum: 0, tops: 0, lasts: 0, wins: 0, dealIns: 0, hands: 0, best: 0, last: null });
    const mode = Number(r.mode || 4);
    a.games++; a.pt += Number(r.pt); a.rankSum += r.rank; a.tops += r.rank === 1 ? 1 : 0; a.lasts += r.rank === mode ? 1 : 0;
    a.wins += r.wins || 0; a.dealIns += r.deal_ins || 0; a.hands += r.hands || 0;
    a.best = Math.max(a.best, r.best_total || 0);
    if (!a.last || r.ended_at > a.last) a.last = r.ended_at;
  }
  return Object.values(by).map(a => ({
    userId: a.userId, games: a.games, pt: Math.round(a.pt * 10) / 10, avgRank: Math.round(a.rankSum / a.games * 100) / 100,
    topRate: Math.round(a.tops / a.games * 100), lastRate: Math.round(a.lasts / a.games * 100),
    winRate: a.hands ? Math.round(a.wins / a.hands * 1000) / 10 : 0, dealInRate: a.hands ? Math.round(a.dealIns / a.hands * 1000) / 10 : 0,
    best: a.best || null, last: a.last
  })).sort((x, y) => y.pt - x.pt);
}
async function nameMap(ids) {
  const list = await store.profiles([...new Set(ids.filter(Boolean))]);
  const m = {}; list.forEach(p => { m[p.id] = { name: p.name, avatar: p.avatar }; });
  return m;
}
function gameRow(g, groups, names) {
  const res = (g.results || []).slice().sort((a, b) => a.rank - b.rank);
  return {
    id: g.id, endedAt: g.ended_at, startedAt: g.started_at, organizer: g.organizer || null,
    organizerName: g.organizer && names[g.organizer] ? names[g.organizer].name : null,
    group: g.group_id && groups[g.group_id] ? groups[g.group_id].name : null,
    rules: ruleSummary(g.rules), endReason: g.end_reason,
    results: res.map(r => { const p = (g.players || [])[r.seat] || {}; return { name: p.name, cpu: !!p.cpu, userId: p.userId || null, rank: r.rank, score: r.score, pt: r.pt }; })
  };
}

/* ---------- 操作 ---------- */
async function overview() {
  const [organizers, games, players] = await Promise.all([store.listOrganizers(), store.adminGames({ limit: 20000 }), store.countProfiles()]);
  const now = Date.now();
  const g30 = games.filter(g => now - new Date(g.ended_at).getTime() < 30 * DAY);
  const today = dayKey(now);
  const days = [];
  for (let i = 29; i >= 0; i--) days.push({ day: dayKey(now - i * DAY), games: 0 });
  const di = {}; days.forEach((d, i) => { di[d.day] = i; });
  g30.forEach(g => { const i = di[dayKey(g.ended_at)]; if (i !== undefined) days[i].games++; });
  const activePlayers = new Set(); g30.forEach(g => humans(g).forEach(p => activePlayers.add(p.userId)));
  const orgGames = {}; g30.forEach(g => { if (g.organizer) orgGames[g.organizer] = (orgGames[g.organizer] || 0) + 1; });
  const names = await nameMap(Object.keys(orgGames));
  return {
    kpi: {
      organizers: organizers.length, suspended: organizers.filter(o => o.organizer_status === 'suspended').length,
      activeOrganizers: Object.keys(orgGames).length,
      players, activePlayers: activePlayers.size,
      games: games.length, games30: g30.length, gamesToday: games.filter(g => dayKey(g.ended_at) === today).length
    },
    daily: days,
    rules: ruleStats(g30),
    topOrganizers: Object.entries(orgGames).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, name: names[id] ? names[id].name : '（不明）', games: n }))
  };
}
async function organizers() {
  const [list, games, codes] = await Promise.all([store.listOrganizers(), store.adminGames({ limit: 20000 }), store.listCodes()]);
  const groups = await store.groupsByOwners(list.map(o => o.id));
  const codeMap = {}; codes.forEach(c => { codeMap[c.id] = c; });
  const now = Date.now();
  const st = {};
  for (const g of games) {
    if (!g.organizer) continue;
    const s = st[g.organizer] || (st[g.organizer] = { games: 0, games30: 0, players: new Set(), last: null });
    s.games++; if (now - new Date(g.ended_at).getTime() < 30 * DAY) s.games30++;
    humans(g).forEach(p => s.players.add(p.userId));
    if (!s.last || g.ended_at > s.last) s.last = g.ended_at;
  }
  return {
    organizers: list.map(o => {
      const s = st[o.id] || { games: 0, games30: 0, players: new Set(), last: null };
      const c = o.organizer_code && codeMap[o.organizer_code];
      return {
        id: o.id, name: o.name, avatar: o.avatar, status: o.organizer_status, since: o.organizer_since, note: o.organizer_note || '',
        code: c ? { code: c.code, label: c.label } : null,
        groups: groups.filter(g => g.owner === o.id).length,
        games: s.games, games30: s.games30, players: s.players.size, lastGameAt: s.last
      };
    }).sort((a, b) => (b.games30 - a.games30) || (b.games - a.games))
  };
}
async function organizer(a) {
  const prof = await store.getProfile(a.id);
  if (!prof) throw new ApiError(404, '主催者が見つかりません');
  const range = periodRange(a.period);
  const [allGames, groups, codes] = await Promise.all([store.adminGames({ organizer: prof.id, limit: 20000 }), store.groupsByOwners([prof.id]), store.listCodes()]);
  const games = allGames.filter(g => inRange(g, range));
  const rows = await store.playerRowsForGames(games.map(g => g.id));
  const ranking = playerRanking(rows);
  const groupIds = [...new Set(allGames.map(g => g.group_id).filter(Boolean))];
  const gmap = {}; (await store.groupsByIds(groupIds)).forEach(g => { gmap[g.id] = g; });
  groups.forEach(g => { gmap[g.id] = g; });
  const names = await nameMap(ranking.map(r => r.userId).concat([prof.id]));
  ranking.forEach(r => { r.name = names[r.userId] ? names[r.userId].name : '（退会）'; r.avatar = names[r.userId] ? names[r.userId].avatar : null; });
  const months = {}; allGames.forEach(g => { const k = monthKey(g.ended_at); months[k] = (months[k] || 0) + 1; });
  const monthList = Object.keys(months).sort().reverse();
  const groupStats = groups.map(g => {
    const gg = games.filter(x => x.group_id === g.id);
    return { id: g.id, name: g.name, code: g.code, members: g.memberCount, games: gg.length, createdAt: g.created_at };
  });
  const c = prof.organizer_code && codes.find(x => x.id === prof.organizer_code);
  return {
    organizer: { id: prof.id, name: prof.name, avatar: prof.avatar, status: prof.organizer_status, since: prof.organizer_since, note: prof.organizer_note || '', createdAt: prof.created_at, code: c ? { code: c.code, label: c.label } : null },
    period: a.period || 'all', periodLabel: range.label,
    months: monthList.map(k => ({ key: k, games: months[k] })),
    kpi: { games: games.length, players: ranking.length, groups: groups.length, totalGames: allGames.length },
    rules: ruleStats(games),
    groups: groupStats,
    ranking,
    recent: games.slice(0, 50).map(g => gameRow(g, gmap, names))
  };
}
async function codes() {
  const [list, orgs] = await Promise.all([store.listCodes(), store.listOrganizers()]);
  return {
    codes: list.map(c => ({
      id: c.id, code: c.code, label: c.label, maxUses: c.max_uses, uses: c.uses, expiresAt: c.expires_at, revoked: c.revoked, createdAt: c.created_at,
      usedBy: orgs.filter(o => o.organizer_code === c.id).map(o => ({ id: o.id, name: o.name, since: o.organizer_since }))
    }))
  };
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { let s = ''; for (let i = 0; i < 8; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)]; return `YK-${s.slice(0, 4)}-${s.slice(4)}`; };
async function createCodes(a) {
  const count = Math.max(1, Math.min(50, Number(a.count) || 1));
  const maxUses = Math.max(1, Math.min(1000, Number(a.maxUses) || 1));
  const days = Number(a.days) || 0;
  const label = String(a.label || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
  const rows = Array.from({ length: count }, () => ({ code: newCode(), label, max_uses: maxUses, expires_at: days > 0 ? new Date(Date.now() + days * DAY).toISOString() : null }));
  return { codes: await store.insertCodes(rows) };
}
async function setCode(a) {
  if (!a.id) throw bad('コードを指定してください');
  const patch = {};
  if ('revoked' in a) patch.revoked = !!a.revoked;
  if ('label' in a) patch.label = String(a.label || '').slice(0, 40);
  await store.updateCode(a.id, patch);
  return { ok: true };
}
async function setOrganizer(a) {
  const prof = await store.getProfile(a.id);
  if (!prof) throw new ApiError(404, '見つかりません');
  const patch = {};
  if ('status' in a) {
    if (!['active', 'suspended', null].includes(a.status)) throw bad('状態が不正です');
    patch.organizer_status = a.status;
    if (a.status === 'active' && !prof.organizer_since) patch.organizer_since = new Date().toISOString();
  }
  if ('note' in a) patch.organizer_note = String(a.note || '').slice(0, 400);
  await store.updateProfile(prof.id, patch);
  return { ok: true };
}
async function games(a) {
  const range = periodRange(a.period || 'days:30');
  const list = (await store.adminGames({ organizer: a.organizer || undefined, since: range.from || undefined, limit: 20000 })).filter(g => inRange(g, range));
  const gmap = {}; (await store.groupsByIds([...new Set(list.map(g => g.group_id).filter(Boolean))])).forEach(g => { gmap[g.id] = g; });
  const names = await nameMap(list.map(g => g.organizer));
  return { periodLabel: range.label, games: list.map(g => gameRow(g, gmap, names)) };
}

export const ADMIN_OPS = { overview, organizers, organizer, codes, createCodes, setCode, setOrganizer, games };

/* ---------- ローカル検証用のデモデータ（メモリ保存のときだけ） ---------- */
if (isDev) ADMIN_OPS.seedDemo = async () => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const AV = ['ren', 'jin', 'kai', 'sora', 'aoi', 'shion', 'tsubasa', 'genro', 'shun', 'gou', 'ruka', 'ran', 'reika', 'kaede', 'yuki', 'arisa', 'kyoko', 'shiori'];
  const codes = await store.insertCodes([{ code: newCode(), label: '田中さん（駅前の雀荘）' }, { code: newCode(), label: '佐藤さん（会社の麻雀部）' }, { code: newCode(), label: '山本さん' }, { code: newCode(), label: '予備', max_uses: 5 }]);
  const orgs = [['田中 大輔', 0], ['佐藤 健', 1], ['山本 ゆかり', 2]];
  const names = ['まさ', 'けんじ', 'ひろし', 'たく', 'ゆうこ', 'りょう', 'なおき', 'しんご', 'あや', 'だいち', 'みか', 'こうへい', 'ゆうき', 'はると', 'さとし', 'まい', 'つよし', 'けい'];
  const people = [];
  for (const n of names) { const id = crypto.randomUUID(); await store.ensureProfile(id); await store.updateProfile(id, { name: n, avatar: 'a:' + pick(AV) }); people.push({ id, name: n }); }
  for (const [name, ci] of orgs) {
    const id = crypto.randomUUID(); await store.ensureProfile(id);
    await store.updateProfile(id, { name, avatar: 'a:' + pick(AV), organizer_status: 'active', organizer_since: new Date(Date.now() - rnd(40, 80) * DAY).toISOString(), organizer_code: codes[ci].id });
    await store.claimCodeUse(codes[ci].id, 0);
    const members = people.slice(ci * 5, ci * 5 + 8);
    const groups = [];
    for (const gname of ci === 1 ? ['会社の麻雀部'] : [`${name.split(' ')[0]}会`, '金曜の夜']) {
      const g = await store.createGroup({ name: gname, code: Math.random().toString(36).slice(2, 8).toUpperCase(), owner: id });
      await store.addMember(g.id, id, 'owner'); for (const m of members) await store.addMember(g.id, m.id, 'member');
      groups.push(g);
    }
    const n = ci === 0 ? 70 : ci === 1 ? 34 : 12;
    for (let k = 0; k < n; k++) {
      const sanma = Math.random() < (ci === 2 ? .6 : .15), N = sanma ? 3 : 4;
      const seats = [{ id, name }].concat(members.slice().sort(() => Math.random() - .5).slice(0, N - 1 - (Math.random() < .2 ? 1 : 0)));
      while (seats.length < N) seats.push({ id: null, name: pick(['テツ', 'ミサキ', 'ゲン']) });
      const scores = []; let left = (sanma ? 35000 : 25000) * N;
      for (let i = 0; i < N - 1; i++) { const s = Math.round(rnd(-8000, 50000) / 100) * 100; scores.push(s); left -= s; } scores.push(left);
      const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
      const uma = sanma ? [15, 0, -15] : [30, 10, -10, -30], ret = sanma ? 40000 : 30000;
      const results = order.map(([s, i], r) => ({ seat: i, rank: r + 1, score: s, pt: Math.round(((s - ret) / 1000 + uma[r] + (r === 0 ? (ret - (sanma ? 35000 : 25000)) * N / 1000 : 0)) * 10) / 10 }));
      const ended = new Date(Date.now() - Math.pow(Math.random(), 1.6) * 60 * DAY).toISOString();
      const g = pick(groups);
      const rules = { sanma, length: Math.random() < .3 ? 'hanchan' : 'tonpuu', aka: Math.random() < .9, kuitan: true, yakitori: Math.random() < .25, wareme: Math.random() < .1, uma: sanma ? '15' : pick(['10-30', '10-30', '10-20', '5-10']), oka: true, name: pick(['負けたら奢り卓', '金曜の夜卓', '役満祈願卓', '終電までに終わる卓']) };
      const players = seats.map((s, i) => ({ seat: i, userId: s.id, name: s.name, cpu: !s.id }));
      const rows = results.filter(r => seats[r.seat].id).map(r => ({ user_id: seats[r.seat].id, group_id: g.id, mode: N, seat: r.seat, rank: r.rank, score: r.score, pt: r.pt, wins: rnd(0, 4), deal_ins: rnd(0, 3), riichis: rnd(0, 3), hands: rnd(6, 12), best_total: pick([null, 3900, 7700, 8000, 12000, 18000, 32000]), best_label: null }));
      await store.insertGame({ room_id: null, group_id: g.id, organizer: id, rules, players, results, hands: [], end_reason: 'end', started_at: ended, ended_at: ended }, rows);
    }
  }
  // 最後の1人は停止中
  const list = await store.listOrganizers();
  const last = list.find(o => o.name === '山本 ゆかり'); if (last) await store.updateProfile(last.id, { organizer_status: 'suspended', organizer_note: '連絡が取れないため一時停止' });
  return { ok: true };
};
