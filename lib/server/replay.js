// サーバー側の対局進行。
// 対局は「シード + 人間の判断ログ」だけで決まる。毎回最初から再生し、
// 人間の判断待ちで止まったところが現在の局面になる。
import MJ from '../engine.js';

export const DEADLINE_MS = { self: 25000, react: 12000, next: 30000 };
export const DEADLINE_OFF_MS = { self: 10 * 60000, react: 10 * 60000, next: 60000 };

const settle = () => new Promise(r => setImmediate(r));

function rot(arr, seat) { return arr.map((_, i) => arr[(i + seat) % 4]); }
const rel = (x, seat) => (x === null || x === undefined || x < 0) ? x : (x - seat + 4) % 4;

/** 1回分の再生。止まった局面・判断待ち・イベントを返す */
async function runOnce({ seed, rules, players, log, captureFrom, captureSeats }) {
  let counter = 0, err = null, done = false;
  const pending = [];
  const events = [];
  const timelines = {};
  for (const s of captureSeats || []) timelines[s] = [];
  const take = (seat, kind, opts) => {
    const key = String(counter++);
    if (Object.prototype.hasOwnProperty.call(log, key)) return Promise.resolve(log[key]);
    pending.push({ key, seat, kind, opts });
    return new Promise(() => {});
  };
  const humans = players.map((p, i) => p.human ? i : -1).filter(i => i >= 0);
  let g;
  g = new MJ.Game({
    rng: MJ.mulberry32(seed),
    rules,
    players: players.map(p => ({ name: p.name, human: !!p.human, style: p.style || 'balance' })),
    hooks: {
      emit(type, d) {
        if (type === 'log' || type === 'start' || type === 'draw') return;
        const ev = serializeEvent(type, d);
        ev.seq = events.length;
        events.push(ev);
        if (ev.seq >= (captureFrom || 0)) {
          for (const s of captureSeats || []) timelines[s].push({ ev: relEvent(ev, s), state: stateFor(g, s) });
        }
      },
      wait: () => Promise.resolve(),
      handEnd: (game) => Promise.all(humans.map(s => take(s, 'next', { handNo: game.handNo }))),
      human: {
        self: (game, o) => take(o.seat, 'self', o),
        react: (game, o) => take(o.seat, 'react', o)
      }
    }
  });
  g.run().then(() => { done = true; }, e => { err = e; });
  for (let i = 0; i < 4; i++) await settle();
  if (err) throw err;
  return { g, pending, events, timelines, done };
}

function serializeEvent(type, d) {
  const e = { type };
  if ('seat' in d) e.seat = d.seat;
  if (type === 'discard') { e.id = d.id; e.riichi = !!d.riichi; }
  if (type === 'call') { e.kind = d.kind; e.label = d.label; }
  if (type === 'win' || type === 'ryuukyoku') e.result = serializeResult(d.result);
  if (type === 'end') { e.final = d.final; e.reason = d.reason; }
  return e;
}
function serializeResult(r) {
  if (!r) return null;
  const o = JSON.parse(JSON.stringify(r));
  return o;
}
function relResult(r, seat) {
  if (!r) return null;
  const o = Object.assign({}, r);
  if (o.deltas) o.deltas = rot(o.deltas, seat);
  if (o.tenpai) o.tenpai = rot(o.tenpai, seat);
  if ('winner' in o) o.winner = rel(o.winner, seat);
  if ('from' in o && o.from !== null) o.from = rel(o.from, seat);
  if ('wareme' in o) o.wareme = rel(o.wareme, seat);
  return o;
}
function relEvent(ev, seat) {
  const e = Object.assign({}, ev);
  if ('seat' in e) e.seat = rel(e.seat, seat);
  if (e.result) e.result = relResult(e.result, seat);
  if (e.final) e.final = e.final.map(f => Object.assign({}, f, { seat: rel(f.seat, seat) }));
  if (e.type === 'draw' && e.seat !== 0) delete e.id;
  return e;
}

/** 席 seat から見た局面（自分が常に0番） */
export function stateFor(g, seat) {
  const H = g.h;
  const P = rot(g.P, seat).map(p => ({
    name: p.name, score: p.score, style: p.style, human: !!p.human,
    wins: p.wins, dealIns: p.dealIns, riichis: p.riichis, hands: p.hands, bestHand: p.bestHand || null
  }));
  const st = {
    round: g.round, kyoku: g.kyoku, honba: g.honba, kyotaku: g.kyotaku, handNo: g.handNo,
    dealer: rel(g.dealer, seat), rules: g.rules, P
  };
  if (H) {
    const hands = rot(H.hands, seat).map((h, i) => (i === 0 || H.reveal) ? h.slice() : h.map(() => -1));
    const dead = H.dead.map((id, i) => {
      if (i >= 4 && i % 2 === 0 && (i - 4) / 2 < H.doraCount) return id;
      return -1;
    });
    st.h = {
      hands,
      melds: rot(H.melds, seat),
      river: rot(H.river, seat),
      riichi: rot(H.riichi, seat),
      ippatsu: [false, false, false, false],
      furitenTemp: [H.furitenTemp[seat], false, false, false],
      riichiFuriten: [H.riichiFuriten[seat], false, false, false],
      safeAfter: rot(H.safeAfter, seat).map(s => [...s]),
      firstGo: H.firstGo,
      turn: rel(H.turn, seat),
      drawnTile: H.drawnTile === null ? null : (H.turn === seat ? H.drawnTile : -1),
      reveal: H.reveal, active: H.active,
      wallCount: H.wall.length, doraCount: H.doraCount, dead, kans: H.kans, rinshanUsed: H.rinshanUsed,
      lastDiscard: H.lastDiscard ? { seat: rel(H.lastDiscard.seat, seat), id: H.lastDiscard.id } : null,
      wareme: rel(H.wareme, seat),
      result: relResult(serializeResult(H.result), seat)
    };
  }
  return st;
}

function relOpts(o, seat) {
  const c = JSON.parse(JSON.stringify(o));
  if ('seat' in c) c.seat = rel(c.seat, seat);
  if ('from' in c) c.from = rel(c.from, seat);
  return c;
}

function defaultAction(kind) {
  if (kind === 'react') return { type: 'pass' };
  if (kind === 'next') return { type: 'next' };
  return { type: 'timeout' };
}

/**
 * 対局を進める。
 * game: { seed, rules, players:[{name,human,style,userId}], log:{}, prompts:{key:{since}}, eventCount }
 * 期限切れの判断は既定の行動で埋め、止まるまで繰り返す。
 */
export async function advance(game, { now = Date.now(), applyTimeouts = true } = {}) {
  const humanSeats = game.players.map((p, i) => p.human ? i : -1).filter(i => i >= 0);
  const limits = game.rules.timer === false ? DEADLINE_OFF_MS : DEADLINE_MS;
  const prevCount = game.eventCount || 0;
  let res;
  for (let loop = 0; loop < 400; loop++) {
    res = await runOnce({ seed: game.seed, rules: game.rules, players: game.players, log: game.log, captureFrom: prevCount, captureSeats: humanSeats });
    let changed = false;
    const live = {};
    for (const p of res.pending) {
      live[p.key] = true;
      if (!game.prompts[p.key]) game.prompts[p.key] = { since: now, seat: p.seat, kind: p.kind };
      const since = game.prompts[p.key].since;
      if (applyTimeouts && now - since >= limits[p.kind]) { game.log[p.key] = defaultAction(p.kind); changed = true; }
    }
    for (const k of Object.keys(game.prompts)) if (!live[k] && !(k in game.log)) delete game.prompts[k];
    if (!changed) break;
  }
  const g = res.g;
  game.eventCount = res.events.length;
  const views = {};
  for (const s of humanSeats) {
    const mine = res.pending.filter(p => p.seat === s);
    const waiting = res.pending.map(p => ({ seat: rel(p.seat, s), kind: p.kind, deadline: game.prompts[p.key].since + limits[p.kind] }));
    views[s] = Object.assign(stateFor(g, s), {
      seat: s,
      prompt: mine.length ? { key: mine[0].key, kind: mine[0].kind, opts: relOpts(mine[0].opts, s), deadline: game.prompts[mine[0].key].since + limits[mine[0].kind] } : null,
      waiting,
      timeline: res.timelines[s] || [],
      timelineFrom: prevCount,
      eventCount: res.events.length,
      final: res.done && g.final ? g.final.map(f => Object.assign({}, f, { seat: rel(f.seat, s) })) : null,
      endReason: res.done ? g.endReason : null
    });
  }
  const records = res.events.filter(e => e.type === 'win' || e.type === 'ryuukyoku').map(e => e.result);
  return {
    views,
    done: res.done,
    final: res.done ? g.final : null,
    endReason: res.done ? g.endReason : null,
    players: g.P.map(p => ({ name: p.name, score: p.score, wins: p.wins, dealIns: p.dealIns, riichis: p.riichis, hands: p.hands, bestHand: p.bestHand || null })),
    records,
    pending: res.pending.map(p => ({ key: p.key, seat: p.seat, kind: p.kind }))
  };
}

/** 判断の送信。key が今その席の判断待ちであれば記録する */
export async function submit(game, seat, key, action) {
  const res = await runOnce({ seed: game.seed, rules: game.rules, players: game.players, log: game.log, captureFrom: Infinity, captureSeats: [] });
  const p = res.pending.find(x => x.key === key && x.seat === seat);
  if (!p) return false;
  game.log[key] = sanitizeWire(action);
  return true;
}
function sanitizeWire(a) {
  if (!a || typeof a !== 'object') return { type: 'pass' };
  const out = { type: String(a.type || '').slice(0, 12) };
  if (Number.isInteger(a.id)) out.id = a.id;
  if (Number.isInteger(a.t)) out.t = a.t;
  if (a.riichi) out.riichi = true;
  if (Array.isArray(a.chi) && a.chi.length === 2 && a.chi.every(Number.isInteger)) out.chi = a.chi.slice(0, 2);
  return out;
}
