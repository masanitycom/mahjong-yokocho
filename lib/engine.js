const MJ = (function () {
'use strict';

/* ===== 牌の基本 ===== */
// 牌ID 0..135, 種類 t = id>>2 (0-8 萬, 9-17 筒, 18-26 索, 27-30 東南西北, 31-33 白發中)
const HONOR = '東南西北白發中';
const SUITS = ['萬', '筒', '索'];
const tt = id => id >> 2;
const isRed = id => id === 16 || id === 52 || id === 88;
const isHonor = t => t >= 27;
const isTermHonor = t => t >= 27 || t % 9 === 0 || t % 9 === 8;
const isSimple = t => !isTermHonor(t);
const isDragon = t => t >= 31;
function tileName(t) { return t < 27 ? (t % 9 + 1) + SUITS[Math.floor(t / 9)] : HONOR[t - 27]; }
function doraOf(ind, sanma) {
  if (sanma && ind === 0) return 8;
  if (sanma && ind === 8) return 0;
  if (ind < 27) return ind % 9 === 8 ? ind - 8 : ind + 1;
  if (ind <= 30) return ind === 30 ? 27 : ind + 1;
  return ind === 33 ? 31 : ind + 1;
}
function countsOf(ids) { const c = new Array(34).fill(0); for (const id of ids) c[id >> 2]++; return c; }

/* ===== 向聴数 ===== */
const suitMemo = new Map();
function suitOpts(c, off) {
  let key = 0;
  for (let i = 0; i < 9; i++) key = key * 5 + c[off + i];
  let r = suitMemo.get(key);
  if (r) return r;
  const a = c.slice(off, off + 9), res = [], seen = new Set();
  (function rec(i, m, t) {
    while (i < 9 && a[i] === 0) i++;
    if (i >= 9) { const k = m * 16 + t; if (!seen.has(k)) { seen.add(k); res.push([m, t]); } return; }
    if (a[i] >= 3) { a[i] -= 3; rec(i, m + 1, t); a[i] += 3; }
    if (i <= 6 && a[i + 1] && a[i + 2]) { a[i]--; a[i + 1]--; a[i + 2]--; rec(i, m + 1, t); a[i]++; a[i + 1]++; a[i + 2]++; }
    if (a[i] >= 2) { a[i] -= 2; rec(i, m, t + 1); a[i] += 2; }
    if (i <= 7 && a[i + 1]) { a[i]--; a[i + 1]--; rec(i, m, t + 1); a[i]++; a[i + 1]++; }
    if (i <= 6 && a[i + 2]) { a[i]--; a[i + 2]--; rec(i, m, t + 1); a[i]++; a[i + 2]++; }
    a[i]--; rec(i, m, t); a[i]++;
  })(0, 0, 0);
  r = res.filter(x => !res.some(y => y !== x && y[0] >= x[0] && y[1] >= x[1] && (y[0] > x[0] || y[1] > x[1])));
  suitMemo.set(key, r);
  return r;
}
function normalRaw(c, called) {
  let hm = 0, ht = 0;
  for (let i = 27; i < 34; i++) { if (c[i] >= 3) hm++; else if (c[i] === 2) ht++; }
  const s0 = suitOpts(c, 0), s1 = suitOpts(c, 9), s2 = suitOpts(c, 18);
  let best = 8;
  for (const a of s0) for (const b of s1) for (const d of s2) {
    let M = called + a[0] + b[0] + d[0] + hm;
    const T = a[1] + b[1] + d[1] + ht;
    if (M > 4) M = 4;
    const v = 8 - 2 * M - Math.min(T, 4 - M);
    if (v < best) best = v;
  }
  return best;
}
function normalShanten(c, called) {
  let best = normalRaw(c, called);
  for (let t = 0; t < 34; t++) if (c[t] >= 2) {
    c[t] -= 2;
    const v = normalRaw(c, called) - 1;
    c[t] += 2;
    if (v < best) best = v;
  }
  return best;
}
function chiitoiShanten(c) {
  let pairs = 0, kinds = 0;
  for (let t = 0; t < 34; t++) { if (c[t] >= 1) kinds++; if (c[t] >= 2) pairs++; }
  return 6 - pairs + Math.max(0, 7 - kinds);
}
const YAOCHU = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
function kokushiShanten(c) {
  let kinds = 0, pair = 0;
  for (const t of YAOCHU) { if (c[t]) kinds++; if (c[t] >= 2) pair = 1; }
  return 13 - kinds - pair;
}
function shanten(c, called) {
  let s = normalShanten(c, called);
  if (called === 0) { s = Math.min(s, chiitoiShanten(c), kokushiShanten(c)); }
  return s;
}
function waitsOf(c, called) {
  const w = [];
  for (let t = 0; t < 34; t++) {
    if (c[t] >= 4) continue;
    c[t]++;
    if (shanten(c, called) === -1) w.push(t);
    c[t]--;
  }
  return w;
}

/* ===== 和了形の分解 ===== */
function decompSets(c, i, sets, out) {
  while (i < 34 && !c[i]) i++;
  if (i >= 34) { out.push(sets.slice()); return; }
  if (c[i] >= 3) { c[i] -= 3; sets.push({ k: 'kou', t: i }); decompSets(c, i, sets, out); sets.pop(); c[i] += 3; }
  if (i < 27 && i % 9 <= 6 && c[i + 1] && c[i + 2]) {
    c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ k: 'shun', t: i });
    decompSets(c, i, sets, out);
    sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
  }
}
function decompositions(c) {
  const out = [];
  for (let p = 0; p < 34; p++) if (c[p] >= 2) {
    c[p] -= 2;
    const r = [];
    decompSets(c, 0, [], r);
    c[p] += 2;
    for (const s of r) out.push({ pair: p, sets: s });
  }
  return out;
}

/* ===== 役・符・点数 ===== */
const ceil100 = x => Math.ceil(x / 100) * 100;
function limitName(han, fu, ym) {
  if (ym) return ym >= 2 ? (ym === 2 ? 'ダブル役満' : ym + '倍役満') : '役満';
  if (han >= 13) return '数え役満';
  if (han >= 11) return '三倍満';
  if (han >= 8) return '倍満';
  if (han >= 6) return '跳満';
  if (han >= 5 || fu * Math.pow(2, han + 2) >= 2000) return '満貫';
  return '';
}
function basePoints(han, fu, ym) {
  if (ym) return 8000 * ym;
  if (han >= 13) return 8000;
  if (han >= 11) return 6000;
  if (han >= 8) return 4000;
  if (han >= 6) return 3000;
  if (han >= 5) return 2000;
  return Math.min(2000, fu * Math.pow(2, han + 2));
}

/*
 ctx = { hand:[ids 閉じた手牌 +和了牌], melds:[{type,tiles,t}], winTile:id, tsumo, seatWind, roundWind,
         riichi(0/1/2), ippatsu, haitei, houtei, rinshan, chankan, tenhou, chiihou,
         doraInd:[t], uraInd:[t], rules:{aka,kuitan}, dealer:bool }
*/
function evaluate(ctx) {
  const rules = ctx.rules || {};
  const c = countsOf(ctx.hand);
  const called = ctx.melds.length;
  const menzen = ctx.melds.every(m => m.type === 'ankan');
  const wt = tt(ctx.winTile);
  const allIds = ctx.hand.slice();
  for (const m of ctx.melds) allIds.push(...m.tiles);
  const allT = allIds.map(tt);
  const shapes = [];

  if (called === 0 && chiitoiShanten(c) === -1) shapes.push({ kind: 'chiitoi' });
  if (called === 0 && kokushiShanten(c) === -1) shapes.push({ kind: 'kokushi', juusan: c[wt] === 2 });
  if (normalShanten(c, called) === -1) {
    const meldSets = ctx.melds.map(m => ({
      k: m.type === 'chi' ? 'shun' : (m.type === 'pon' ? 'kou' : 'kan'),
      t: m.t, open: m.type !== 'ankan', meld: true
    }));
    for (const d of decompositions(c)) {
      const places = [];
      if (d.pair === wt) places.push({ idx: -1, wait: 'tanki' });
      d.sets.forEach((s, i) => {
        if (s.k === 'kou' && s.t === wt) places.push({ idx: i, wait: 'shanpon' });
        if (s.k === 'shun' && wt >= s.t && wt <= s.t + 2) {
          let w;
          if (wt === s.t + 1) w = 'kanchan';
          else if (wt === s.t) w = (s.t % 9 === 6) ? 'penchan' : 'ryanmen';
          else w = (s.t % 9 === 0) ? 'penchan' : 'ryanmen';
          places.push({ idx: i, wait: w });
        }
      });
      for (const pl of places) {
        const sets = d.sets.map((s, i) => ({
          k: s.k, t: s.t, open: s.k === 'kou' && i === pl.idx && !ctx.tsumo, meld: false
        })).concat(meldSets);
        shapes.push({ kind: 'normal', pair: d.pair, sets, wait: pl.wait });
      }
    }
  }
  if (!shapes.length) return null;

  // ドラ
  let dora = 0, aka = 0, ura = 0;
  const sm = !!ctx.sanma, kita = ctx.kita || 0;
  const doraT = (ctx.doraInd || []).map(t => doraOf(t, sm)), uraT = (ctx.uraInd || []).map(t => doraOf(t, sm));
  const doraTiles = allT.concat(Array(kita).fill(30));
  for (const t of doraTiles) { for (const d of doraT) if (d === t) dora++; }
  if (ctx.riichi) for (const t of doraTiles) { for (const d of uraT) if (d === t) ura++; }
  if (rules.aka !== false) for (const id of allIds) if (isRed(id)) aka++;

  let best = null;
  for (const sh of shapes) {
    const r = scoreShape(ctx, sh, c, allT, menzen, rules);
    if (!r) continue;
    if (!r.yakuman) {
      if (dora) r.yaku.push({ name: 'ドラ', han: dora });
      if (kita) r.yaku.push({ name: '抜きドラ', han: kita });
      if (aka) r.yaku.push({ name: '赤ドラ', han: aka });
      if (ura) r.yaku.push({ name: '裏ドラ', han: ura });
      r.han += dora + aka + ura + kita;
    }
    r.base = basePoints(r.han, r.fu, r.yakuman);
    r.limit = limitName(r.han, r.fu, r.yakuman);
    r.dora = dora; r.aka = aka; r.ura = ura; r.kita = kita;
    if (ctx.tsumo) {
      if (ctx.dealer) { r.payAll = ceil100(r.base * 2); r.total = r.payAll * 3; }
      else { r.payDealer = ceil100(r.base * 2); r.payOther = ceil100(r.base); r.total = r.payDealer + r.payOther * 2; }
    } else {
      r.ron = ceil100(r.base * (ctx.dealer ? 6 : 4)); r.total = r.ron;
    }
    if (!best || r.total > best.total || (r.total === best.total && r.han > best.han)) best = r;
  }
  return best;
}

function scoreShape(ctx, sh, c, allT, menzen, rules) {
  const yaku = [], ym = [];
  const add = (name, han) => yaku.push({ name, han });
  const addY = (name, mult) => ym.push({ name, han: 13 * mult, mult });
  const tsumo = ctx.tsumo, sw = ctx.seatWind, rw = ctx.roundWind;
  const allHonor = allT.every(isHonor);
  const allTermHonor = allT.every(isTermHonor);
  const allTerm = allT.every(t => !isHonor(t) && isTermHonor(t));
  const suitSet = new Set(allT.filter(t => t < 27).map(t => Math.floor(t / 9)));
  const hasHonor = allT.some(isHonor);
  const GREEN = [19, 20, 21, 23, 25, 32];

  // 役満 (形によらない)
  if (ctx.tenhou) addY('天和', 1);
  if (ctx.chiihou) addY('地和', 1);
  if (allHonor) addY('字一色', 1);
  if (allTerm) addY('清老頭', 1);
  if (allT.every(t => GREEN.includes(t))) addY('緑一色', 1);

  if (sh.kind === 'kokushi') {
    addY(sh.juusan ? '国士無双十三面' : '国士無双', sh.juusan ? 2 : 1);
  }
  let fu = 0;
  if (sh.kind === 'normal') {
    const sets = sh.sets;
    const kous = sets.filter(s => s.k !== 'shun');
    const shuns = sets.filter(s => s.k === 'shun');
    const anko = kous.filter(s => !s.open).length;
    const kans = sets.filter(s => s.k === 'kan').length;
    const dragonK = kous.filter(s => isDragon(s.t)).length;
    const windK = kous.filter(s => s.t >= 27 && s.t <= 30).length;
    if (anko === 4) addY(sh.wait === 'tanki' ? '四暗刻単騎' : '四暗刻', sh.wait === 'tanki' ? 2 : 1);
    if (dragonK === 3) addY('大三元', 1);
    if (windK === 4) addY('大四喜', 2);
    else if (windK === 3 && sh.pair >= 27 && sh.pair <= 30) addY('小四喜', 1);
    if (kans === 4) addY('四槓子', 1);
    if (menzen && suitSet.size === 1 && !hasHonor) {
      const s = [...suitSet][0] * 9, k = c.slice(s, s + 9);
      const need = [3, 1, 1, 1, 1, 1, 1, 1, 3];
      if (k.every((v, i) => v >= need[i])) {
        const extra = k.findIndex((v, i) => v > need[i]);
        addY(extra === (tt(ctx.winTile) - s) ? '純正九蓮宝燈' : '九蓮宝燈', extra === (tt(ctx.winTile) - s) ? 2 : 1);
      }
    }
    if (!ym.length) {
      // 通常役
      const yakuhaiT = t => (isDragon(t) ? 1 : 0) + (t === sw ? 1 : 0) + (t === rw ? 1 : 0);
      const pinfu = menzen && shuns.length === 4 && yakuhaiT(sh.pair) === 0 && sh.wait === 'ryanmen';
      if (ctx.riichi === 2) add('ダブル立直', 2); else if (ctx.riichi) add('立直', 1);
      if (ctx.riichi && ctx.ippatsu) add('一発', 1);
      if (menzen && tsumo) add('門前清自摸和', 1);
      if (pinfu) add('平和', 1);
      if (allT.every(isSimple) && (menzen || rules.kuitan !== false)) add('断么九', 1);
      if (menzen) {
        const cnt = {};
        for (const s of shuns) cnt[s.t] = (cnt[s.t] || 0) + 1;
        let pairs = 0;
        for (const k in cnt) pairs += Math.floor(cnt[k] / 2);
        if (pairs === 2) add('二盃口', 3); else if (pairs === 1) add('一盃口', 1);
      }
      for (const s of kous) {
        if (s.t === 31) add('役牌 白', 1);
        if (s.t === 32) add('役牌 發', 1);
        if (s.t === 33) add('役牌 中', 1);
        if (s.t === sw) add('自風 ' + HONOR[sw - 27], 1);
        if (s.t === rw) add('場風 ' + HONOR[rw - 27], 1);
      }
      if (ctx.haitei) add('海底摸月', 1);
      if (ctx.houtei) add('河底撈魚', 1);
      if (ctx.rinshan) add('嶺上開花', 1);
      if (ctx.chankan) add('槍槓', 1);
      const o = menzen ? 0 : 1;
      for (let n = 0; n < 7; n++) {
        if ([0, 9, 18].every(b => shuns.some(s => s.t === b + n))) { add('三色同順', 2 - o); break; }
      }
      for (let n = 0; n < 9; n++) {
        if ([0, 9, 18].every(b => kous.some(s => s.t === b + n))) { add('三色同刻', 2); break; }
      }
      for (const b of [0, 9, 18]) {
        if ([0, 3, 6].every(n => shuns.some(s => s.t === b + n))) { add('一気通貫', 2 - o); break; }
      }
      const blockTH = s => s.k === 'shun' ? (s.t % 9 === 0 || s.t % 9 === 6) : isTermHonor(s.t);
      if (shuns.length && sets.every(blockTH) && isTermHonor(sh.pair)) {
        if (hasHonor) add('混全帯么九', 2 - o); else add('純全帯么九', 3 - o);
      }
      if (kous.length === 4) add('対々和', 2);
      if (anko === 3) add('三暗刻', 2);
      if (kans === 3) add('三槓子', 2);
      if (dragonK === 2 && isDragon(sh.pair)) add('小三元', 2);
      if (allTermHonor) add('混老頭', 2);
      if (suitSet.size === 1) { if (hasHonor) add('混一色', 3 - o); else add('清一色', 6 - o); }

      // 符
      if (pinfu && tsumo) fu = 20;
      else {
        fu = 20;
        if (menzen && !tsumo) fu += 10;
        if (tsumo) fu += 2;
        for (const s of sets) {
          if (s.k === 'shun') continue;
          let f = s.k === 'kan' ? 8 : 2;
          if (!s.open) f *= 2;
          if (isTermHonor(s.t)) f *= 2;
          fu += f;
        }
        const pv = (isDragon(sh.pair) ? 2 : 0) + (sh.pair === sw ? 2 : 0) + (sh.pair === rw ? 2 : 0);
        fu += pv;
        if (sh.wait === 'kanchan' || sh.wait === 'penchan' || sh.wait === 'tanki') fu += 2;
        if (!menzen && fu === 20) fu = 30;
        fu = Math.ceil(fu / 10) * 10;
      }
    }
  }
  if (sh.kind === 'chiitoi' && !ym.length) {
    if (ctx.riichi === 2) add('ダブル立直', 2); else if (ctx.riichi) add('立直', 1);
    if (ctx.riichi && ctx.ippatsu) add('一発', 1);
    if (tsumo) add('門前清自摸和', 1);
    add('七対子', 2);
    if (allT.every(isSimple)) add('断么九', 1);
    if (allTermHonor) add('混老頭', 2);
    if (suitSet.size === 1) { if (hasHonor) add('混一色', 3); else add('清一色', 6); }
    if (ctx.haitei) add('海底摸月', 1);
    if (ctx.houtei) add('河底撈魚', 1);
    fu = 25;
  }
  if (ym.length) {
    const mult = ym.reduce((a, y) => a + y.mult, 0);
    return { yaku: ym.map(y => ({ name: y.name, han: y.mult > 1 ? 'W役満' : '役満' })), han: 13 * mult, fu: 0, yakuman: mult };
  }
  if (!yaku.length) return null;
  return { yaku, han: yaku.reduce((a, y) => a + y.han, 0), fu, yakuman: 0 };
}

/* ===== 乱数 ===== */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ===== 対局進行 ===== */
const WIND = '東南西北';
class Game {
  constructor(cfg) {
    const sanma = !!(cfg.rules && cfg.rules.sanma);
    this.rules = Object.assign({
      length: 'hanchan', aka: true, kuitan: true, yakitori: false, wareme: false,
      startScore: sanma ? 35000 : 25000, returnScore: sanma ? 40000 : 30000, uma: sanma ? [15, 0, -15] : [30, 10, -10, -30]
    }, cfg.rules || {});
    this.rules.sanma = sanma;
    if (sanma && this.rules.uma.length !== 3) this.rules.uma = [15, 0, -15];
    this.n = sanma ? 3 : 4;
    this.rng = cfg.rng || Math.random;
    this.hooks = Object.assign({ emit() {}, wait: () => Promise.resolve(), handEnd: () => Promise.resolve() }, cfg.hooks || {});
    this.P = cfg.players.map((p, i) => Object.assign({
      seat: i, score: this.rules.startScore, wins: 0, dealIns: 0, riichis: 0, hands: 0, bestHand: null
    }, p));
    this.round = 0; this.kyoku = 0; this.honba = 0; this.kyotaku = 0;
    this.over = false; this.handNo = 0; this.log = [];
  }
  get dealer() { return this.kyoku; }
  get N() { return this.n || (this.P ? this.P.length : 4); }
  seatWind(p) { const n = this.N; return 27 + ((p - this.dealer + n) % n); }
  get roundWind() { return 27 + this.round; }
  roundLabel() { return WIND[this.round] + (this.kyoku + 1) + '局'; }
  emit(type, data) { this.hooks.emit(type, Object.assign({ game: this }, data || {})); }
  wait(ms) { return this.hooks.wait(ms); }
  say(msg) { this.log.push(msg); if (this.log.length > 60) this.log.shift(); this.emit('log', { msg }); }

  async run() {
    this.emit('start');
    while (!this.over) {
      await this.playHand();
      this.checkEnd();
    }
    this.finish();
  }

  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* 可視牌（自分視点） */
  visibleCounts(p) {
    const H = this.h, v = new Array(34).fill(0);
    for (const id of H.hands[p]) v[tt(id)]++;
    for (let q = 0; q < this.N; q++) {
      for (const d of H.river[q]) if (!d.called) v[tt(d.id)]++;
      if (H.kita) v[30] += H.kita[q].length;
      for (const m of H.melds[q]) for (const id of m.tiles) v[tt(id)]++;
    }
    for (const t of this.doraInd()) v[t]++;
    return v;
  }
  doraInd() { const H = this.h; return [4, 6, 8, 10, 12].slice(0, H.doraCount).map(i => tt(H.dead[i])); }
  uraInd() { const H = this.h; return [5, 7, 9, 11, 13].slice(0, H.doraCount).map(i => tt(H.dead[i])); }
  handCounts(p) { return countsOf(this.h.hands[p]); }
  waits(p) { return waitsOf(this.handCounts(p), this.h.melds[p].length); }
  isMenzen(p) { return this.h.melds[p].every(m => m.type === 'ankan'); }
  isFuriten(p) {
    const H = this.h;
    if (H.furitenTemp[p] || H.riichiFuriten[p]) return true;
    const w = this.waits(p);
    return H.river[p].some(d => w.includes(tt(d.id)));
  }

  winCtx(p, winId, o) {
    const H = this.h;
    const hand = o.tsumo ? H.hands[p].slice() : H.hands[p].concat([winId]);
    return {
      hand, melds: H.melds[p], winTile: winId, tsumo: !!o.tsumo,
      seatWind: this.seatWind(p), roundWind: this.roundWind, riichi: H.riichi[p], ippatsu: H.ippatsu[p],
      haitei: o.tsumo && !o.rinshan && H.wall.length === 0, houtei: !o.tsumo && !o.chankan && H.wall.length === 0,
      rinshan: !!o.rinshan, chankan: !!o.chankan,
      tenhou: o.tsumo && p === this.dealer && H.firstGo && H.river[p].length === 0 && !o.rinshan,
      chiihou: o.tsumo && p !== this.dealer && H.firstGo && H.river[p].length === 0 && !o.rinshan,
      doraInd: this.doraInd(), uraInd: this.uraInd(), rules: this.rules, dealer: p === this.dealer,
      sanma: this.N === 3, kita: H.kita ? H.kita[p].length : 0
    };
  }

  async playHand() {
    const N = this.N;
    const all = [...Array(136).keys()].filter(id => N === 4 || !(tt(id) >= 1 && tt(id) <= 7));
    const deck = this.shuffle(all);
    const arr = f => Array.from({ length: N }, f);
    const H = this.h = {
      dead: deck.splice(deck.length - 14, 14), wall: deck, doraCount: 1, rinshanUsed: 0, kans: 0,
      hands: arr(() => []), melds: arr(() => []), river: arr(() => []), kita: arr(() => []),
      riichi: arr(() => 0), ippatsu: arr(() => false), furitenTemp: arr(() => false),
      riichiFuriten: arr(() => false), safeAfter: arr(() => new Set()),
      firstGo: true, turn: this.dealer, lastDraw: null, drawnTile: null, result: null, reveal: false,
      wareme: this.rules.wareme ? Math.floor(this.rng() * N) : -1, winners: [], active: true
    };
    this.handNo++;
    for (let r = 0; r < 13; r++) for (let k = 0; k < N; k++) H.hands[(this.dealer + k) % N].push(H.wall.shift());
    for (const h of H.hands) this.sortHand(h);
    this.P.forEach(p => p.hands++);
    this.say(`${this.roundLabel()} ${this.honba}本場 開始` + (H.wareme >= 0 ? ` / 割れ目: ${this.P[H.wareme].name}` : ''));
    this.emit('deal');
    await this.wait(500);

    let seat = this.dealer, source = 'wall', mustDiscard = null;
    while (true) {
      let drawn = null, rinshan = false;
      if (!mustDiscard) {
        if (source === 'wall') {
          if (!H.wall.length) { await this.ryuukyoku('荒牌流局'); return; }
          drawn = H.wall.shift();
        } else {
          if (H.rinshanUsed < 4) {
            drawn = H.dead[H.rinshanUsed]; // 嶺上牌: dead[0..3]
            H.wall.pop(); // 王牌を14枚に保つ代わりに海底を1枚手前にする
          } else drawn = H.wall.pop();
          H.rinshanUsed++;
          if (drawn === undefined) { await this.ryuukyoku('荒牌流局'); return; }
          rinshan = true;
        }
        H.hands[seat].push(drawn);
        H.drawnTile = drawn;
      } else H.drawnTile = null;
      H.turn = seat;
      this.emit('draw', { seat, drawn });

      // 自分の番の選択肢
      const opts = this.selfOptions(seat, drawn, rinshan, mustDiscard);
      const act = await this.decideSelf(seat, opts);
      if (act.type === 'tsumo') { await this.win(seat, null, opts.tsumoResult, drawn); return; }
      if (act.type === 'kyuushu') { await this.ryuukyoku('九種九牌', true); return; }
      if (act.type === 'kita') {
        const kid = H.hands[seat].find(x => tt(x) === 30);
        H.hands[seat].splice(H.hands[seat].indexOf(kid), 1);
        H.kita[seat].push(kid);
        H.firstGo = false;
        this.sortHand(H.hands[seat]);
        this.say(`${this.P[seat].name} 北抜き`);
        this.emit('call', { seat, kind: 'kita', label: 'キタ' });
        await this.wait(600);
        source = 'rinshan'; mustDiscard = null;
        continue;
      }
      if (act.type === 'ankan' || act.type === 'kakan') {
        const chankanWin = await this.doKan(seat, act.type, act.t);
        if (chankanWin) return;
        source = 'rinshan'; mustDiscard = null;
        continue;
      }
      // 打牌
      const riichiDecl = !!act.riichi;
      this.discard(seat, act.id, riichiDecl, act.id === drawn);
      await this.wait(riichiDecl ? 900 : 260);
      const reacted = await this.reactions(seat, act.id, riichiDecl);
      if (reacted === 'ron') return;
      if (riichiDecl && !H.riichi[seat]) {
        H.riichi[seat] = H.doubleCand ? 2 : 1;
        H.ippatsu[seat] = true;
        this.P[seat].score -= 1000; this.P[seat].riichis++;
        this.kyotaku++;
        this.emit('riichi-stick', { seat });
      }
      H.doubleCand = false;
      if (reacted && reacted.seat !== undefined) {
        seat = reacted.seat;
        if (reacted.type === 'minkan') { source = 'rinshan'; mustDiscard = null; }
        else { mustDiscard = reacted.forbid; }
        continue;
      }
      // 第一巡の終了判定
      if (H.firstGo && H.river.every(r => r.length >= 1)) H.firstGo = false;
      seat = (seat + 1) % N; source = 'wall'; mustDiscard = null;
    }
  }

  sortHand(h) { h.sort((a, b) => a - b); }

  selfOptions(p, drawn, rinshan, mustDiscard) {
    const H = this.h, o = { seat: p, drawn, forbid: mustDiscard || [], riichiIds: [], ankan: [], kakan: [] };
    const hand = H.hands[p];
    if (drawn !== null) {
      const r = evaluate(this.winCtx(p, drawn, { tsumo: true, rinshan }));
      if (r) { o.canTsumo = true; o.tsumoResult = r; }
    }
    const c = countsOf(hand);
    if (drawn !== null && H.wall.length > 0 && H.kans < 4 && H.rinshanUsed < 8) {
      if (!H.riichi[p]) {
        for (let t = 0; t < 34; t++) if (c[t] === 4) o.ankan.push(t);
        for (const m of H.melds[p]) if (m.type === 'pon' && c[m.t] >= 1) o.kakan.push(m.t);
      }
    }
    if (!H.riichi[p] && this.isMenzen(p) && drawn !== null && this.P[p].score >= 1000 && H.wall.length >= 4) {
      const called = H.melds[p].length;
      const seen = new Set();
      for (const id of hand) {
        const t = tt(id); if (seen.has(t)) continue; seen.add(t);
        c[t]--;
        if (shanten(c, called) === 0) o.riichiIds.push(...hand.filter(x => tt(x) === t));
        c[t]++;
      }
    }
    if (drawn !== null && H.firstGo && H.river[p].length === 0 && !rinshan) {
      const kinds = YAOCHU.filter(t => c[t] > 0).length;
      if (kinds >= 9) o.kyuushu = kinds;
    }
    if (this.N === 3 && drawn !== null && H.wall.length > 0 && H.rinshanUsed < 8 && c[30] > 0) {
      if (!H.riichi[p] || tt(drawn) === 30) o.kita = true;
    }
    if (H.riichi[p]) o.locked = true; // ツモ切りのみ
    return o;
  }

  async decideSelf(p, opts) {
    const pl = this.P[p];
    if (pl.human) return Game.sanitizeSelf(this, p, opts, await this.hooks.human.self(this, opts));
    return AI.decideSelf(this, p, opts);
  }

  discard(p, id, riichi, tsumogiri) {
    const H = this.h;
    const i = H.hands[p].indexOf(id);
    H.hands[p].splice(i, 1);
    this.sortHand(H.hands[p]);
    if (riichi && H.firstGo && H.river[p].length === 0) H.doubleCand = true;
    H.river[p].push({ id, riichi, called: false, tsumogiri });
    if (H.ippatsu[p]) H.ippatsu[p] = false;
    H.furitenTemp[p] = false;
    for (let q = 0; q < this.N; q++) if (q !== p && H.riichi[q]) H.safeAfter[q].add(tt(id));
    H.lastDiscard = { seat: p, id };
    H.drawnTile = null;
    if (riichi) this.say(`${this.P[p].name} リーチ`);
    this.emit('discard', { seat: p, id, riichi });
  }

  async reactions(p, id, riichiDecl) {
    const H = this.h, t = tt(id);
    const opts = [];
    const N = this.N;
    for (let k = 1; k < N; k++) {
      const q = (p + k) % N;
      const o = { seat: q, from: p, id, t };
      const qw = this.waits(q);
      if (qw.includes(t)) {
        if (!this.isFuriten(q)) {
          const r = evaluate(this.winCtx(q, id, {}));
          if (r) o.ron = r;
        }
        o.inWait = true;
      }
      const c = this.handCounts(q);
      if (!H.riichi[q] && H.wall.length > 0) {
        if (c[t] >= 2) o.pon = true;
        if (c[t] >= 3 && H.kans < 4 && H.rinshanUsed < 8) o.kan = true;
        if (k === 1 && t < 27 && N === 4) {
          const n = t % 9, ch = [];
          if (n >= 2 && c[t - 2] && c[t - 1]) ch.push([t - 2, t - 1]);
          if (n >= 1 && n <= 7 && c[t - 1] && c[t + 1]) ch.push([t - 1, t + 1]);
          if (n <= 6 && c[t + 1] && c[t + 2]) ch.push([t + 1, t + 2]);
          if (ch.length) o.chi = ch;
        }
      }
      if (o.ron || o.pon || o.kan || o.chi || o.inWait) opts.push(o);
    }
    // 人間への問い合わせは同時に出す（オンライン対戦で待たせないため）
    const decisions = await Promise.all(opts.map(async o => {
      if (!(o.ron || o.pon || o.kan || o.chi)) return { o, d: { type: 'pass' } };
      const pl = this.P[o.seat];
      const d = pl.human ? Game.sanitizeReact(o, await this.hooks.human.react(this, o)) : AI.react(this, o.seat, o);
      return { o, d };
    }));
    // フリテン更新（見逃し）
    for (const { o, d } of decisions) {
      if (o.inWait && d.type !== 'ron') {
        if (H.riichi[o.seat]) H.riichiFuriten[o.seat] = true; else H.furitenTemp[o.seat] = true;
      }
    }
    const ron = decisions.find(x => x.d.type === 'ron');
    if (ron) {
      if (riichiDecl) { /* リーチ宣言牌でロン: 供託不成立 */ }
      await this.win(ron.o.seat, p, ron.o.ron, id);
      return 'ron';
    }
    const pk = decisions.find(x => x.d.type === 'pon' || x.d.type === 'kan');
    const chi = decisions.find(x => x.d.type === 'chi');
    const call = pk || chi;
    if (!call) return null;
    if (riichiDecl) {
      H.riichi[p] = H.doubleCand ? 2 : 1; H.ippatsu[p] = false;
      this.P[p].score -= 1000; this.P[p].riichis++; this.kyotaku++;
      H.doubleCand = false;
      this.emit('riichi-stick', { seat: p });
    }
    return await this.doCall(call.o, call.d);
  }

  takeFromHand(q, types) {
    const H = this.h, got = [];
    for (const t of types) {
      // 赤は優先して晒す（点数上の違いはない）
      const cand = H.hands[q].filter(x => tt(x) === t);
      const pick = cand.find(isRed) !== undefined ? cand.find(isRed) : cand[0];
      H.hands[q].splice(H.hands[q].indexOf(pick), 1);
      got.push(pick);
    }
    return got;
  }

  async doCall(o, d) {
    const H = this.h, q = o.seat, t = o.t;
    H.river[o.from][H.river[o.from].length - 1].called = true;
    H.firstGo = false;
    H.ippatsu = [false, false, false, false];
    let meld, forbid = [];
    let rel = (o.from - q + this.N) % this.N; // 1=下家 2=対面 3=上家
    if (this.N === 3 && rel === 2) rel = 3;
    if (d.type === 'pon') {
      meld = { type: 'pon', t, tiles: this.takeFromHand(q, [t, t]).concat([o.id]), from: rel, calledId: o.id };
      forbid = [t];
    } else if (d.type === 'kan') {
      meld = { type: 'minkan', t, tiles: this.takeFromHand(q, [t, t, t]).concat([o.id]), from: rel, calledId: o.id };
      H.kans++; H.doraCount++;
    } else {
      const pair = d.chi;
      meld = { type: 'chi', t: Math.min(t, pair[0], pair[1]), tiles: [o.id].concat(this.takeFromHand(q, pair)), from: rel, calledId: o.id };
      forbid = [t];
      const lo = Math.min(...pair), hi = Math.max(...pair);
      if (lo === t + 1 && t % 9 <= 5) forbid.push(t + 3);
      if (hi === t - 1 && t % 9 >= 3) forbid.push(t - 3);
    }
    H.melds[q].push(meld);
    const label = { pon: 'ポン', kan: 'カン', chi: 'チー' }[d.type];
    this.say(`${this.P[q].name} ${label}`);
    this.emit('call', { seat: q, kind: d.type, label });
    await this.wait(700);
    // 喰い替えで捨てる牌がなくなる場合は制限解除
    if (forbid.length && H.hands[q].every(x => forbid.includes(tt(x)))) forbid = [];
    return { seat: q, type: d.type === 'kan' ? 'minkan' : d.type, forbid };
  }

  async doKan(p, kind, t) {
    const H = this.h;
    if (kind === 'ankan') {
      const tiles = this.takeFromHand(p, [t, t, t, t]);
      H.melds[p].push({ type: 'ankan', t, tiles });
    } else {
      const m = H.melds[p].find(m => m.type === 'pon' && m.t === t);
      const [id] = this.takeFromHand(p, [t]);
      // 槍槓チェック
      for (let k = 1; k < this.N; k++) {
        const q = (p + k) % this.N;
        if (!this.waits(q).includes(t) || this.isFuriten(q)) continue;
        const r = evaluate(this.winCtx(q, id, { chankan: true }));
        if (!r) continue;
        const d = this.P[q].human ? await this.hooks.human.react(this, { seat: q, from: p, id, t, ron: r, chankan: true }) : { type: 'ron' };
        if (d.type === 'ron') {
          this.say(`${this.P[q].name} 槍槓！`);
          await this.win(q, p, r, id);
          return true;
        }
      }
      m.type = 'kakan'; m.tiles.push(id); m.addedId = id;
    }
    H.kans++; H.doraCount++;
    H.firstGo = false;
    H.ippatsu = [false, false, false, false];
    this.sortHand(H.hands[p]);
    this.say(`${this.P[p].name} カン`);
    this.emit('call', { seat: p, kind: 'kan', label: 'カン' });
    await this.wait(700);
    return false;
  }

  pay(from, to, amount, deltas) {
    const H = this.h;
    if (H.wareme >= 0 && (from === H.wareme || to === H.wareme)) amount *= 2;
    deltas[from] -= amount; deltas[to] += amount;
  }

  async win(w, from, res, winId) {
    const H = this.h, N = this.N, deltas = Array(N).fill(0);
    const tsumo = from === null;
    if (tsumo) {
      for (let q = 0; q < N; q++) if (q !== w) {
        const base = w === this.dealer ? res.payAll : (q === this.dealer ? res.payDealer : res.payOther);
        this.pay(q, w, base + 100 * this.honba, deltas);
      }
    } else {
      this.pay(from, w, res.ron + 300 * this.honba, deltas);
      this.P[from].dealIns++;
    }
    const stick = this.kyotaku * 1000;
    deltas[w] += stick; this.kyotaku = 0;
    for (let q = 0; q < N; q++) this.P[q].score += deltas[q];
    const pl = this.P[w];
    pl.wins++;
    if (!pl.bestHand || res.total > pl.bestHand.total) pl.bestHand = { total: res.total, limit: res.limit, yaku: res.yaku.map(y => y.name).join('・') };
    H.result = {
      round: this.roundLabel(), honba: this.honba,
      kind: 'win', winner: w, from, tsumo, res, winId, deltas, stick,
      hand: H.hands[w].slice(), melds: H.melds[w], kita: H.kita[w].slice(), doraInd: this.doraInd(), uraInd: H.riichi[w] ? this.uraInd() : [],
      wareme: H.wareme
    };
    H.reveal = true; H.active = false;
    this.say(`${pl.name} ${tsumo ? 'ツモ' : 'ロン'} ${res.limit || (res.han + '翻' + res.fu + '符')} ${res.total}点`);
    this.emit('win', { result: H.result });
    await this.hooks.handEnd(this, H.result);
    this.nextHand(w === this.dealer);
    this.lastResult = H.result;
  }

  async ryuukyoku(reason, abortive) {
    const H = this.h, N = this.N, deltas = Array(N).fill(0);
    const tenpai = Array.from({ length: N }, (_, p) => !abortive && this.waits(p).length > 0);
    const n = tenpai.filter(Boolean).length;
    const pool = (N - 1) * 1000;
    if (!abortive && n > 0 && n < N) {
      for (let p = 0; p < N; p++) deltas[p] = tenpai[p] ? pool / n : -pool / (N - n);
    }
    for (let q = 0; q < N; q++) this.P[q].score += deltas[q];
    H.result = { round: this.roundLabel(), honba: this.honba, kind: 'draw', reason, tenpai, deltas };
    H.reveal = true; H.active = false;
    this.say(reason + (abortive ? '' : ` (聴牌 ${n}人)`));
    this.emit('ryuukyoku', { result: H.result });
    await this.hooks.handEnd(this, H.result);
    this.honba++;
    const renchan = abortive || tenpai[this.dealer];
    if (!renchan) this.advance();
    this.lastRenchan = renchan;
    this.lastResult = H.result;
  }

  nextHand(dealerWon) {
    if (dealerWon) { this.honba++; this.lastRenchan = true; }
    else { this.honba = 0; this.advance(); this.lastRenchan = false; }
  }
  advance() { this.kyoku++; if (this.kyoku === this.N) { this.kyoku = 0; this.round++; } }

  checkEnd() {
    const last = this.rules.length === 'tonpuu' ? 0 : 1;
    const scores = this.P.map(p => p.score);
    if (scores.some(s => s < 0)) { this.over = true; this.endReason = '飛び終了'; return; }
    const top = Math.max(...scores);
    if (this.lastRenchan && this.round === last && this.kyoku === this.N - 1) {
      const d = this.dealer;
      if (scores[d] >= this.rules.returnScore && scores[d] === top && scores.filter(s => s === top).length === 1) {
        this.over = true; this.endReason = 'アガリ止め'; return;
      }
    }
    if (this.round > last) {
      if (top >= this.rules.returnScore) { this.over = true; this.endReason = '終局'; return; }
      if (this.round > last + 1 || this.round > 3) { this.over = true; this.endReason = '延長戦終了'; return; }
    }
  }

  finish() {
    if (this.kyotaku) {
      const topSeat = [...Array(this.N).keys()].sort((a, b) => this.P[b].score - this.P[a].score || a - b)[0];
      this.P[topSeat].score += this.kyotaku * 1000; this.kyotaku = 0;
    }
    const order = [...Array(this.N).keys()].sort((a, b) => this.P[b].score - this.P[a].score || a - b);
    const oka = (this.rules.returnScore - this.rules.startScore) * this.N / 1000;
    const res = order.map((p, rank) => {
      let pt = (this.P[p].score - this.rules.returnScore) / 1000 + this.rules.uma[rank] + (rank === 0 ? oka : 0);
      return { seat: p, rank: rank + 1, score: this.P[p].score, pt };
    });
    if (this.rules.yakitori) {
      const birds = res.filter(r => this.P[r.seat].wins === 0);
      const winners = res.filter(r => this.P[r.seat].wins > 0);
      if (birds.length && winners.length) {
        const pool = birds.length * 10;
        birds.forEach(r => { r.pt -= 10; r.yakitori = true; });
        winners.forEach(r => { r.pt += pool / winners.length; });
      }
    }
    res.forEach(r => { r.pt = Math.round(r.pt * 10) / 10; });
    this.final = res;
    this.emit('end', { final: res, reason: this.endReason });
  }
}

Game.sanitizeSelf = function (g, p, o, a) {
  const hand = g.h.hands[p];
  const fallback = () => {
    if (o.drawn !== null && hand.includes(o.drawn)) return { type: 'discard', id: o.drawn };
    const ok = hand.filter(x => !o.forbid.includes(tt(x)));
    return { type: 'discard', id: (ok.length ? ok : hand)[ok.length ? ok.length - 1 : hand.length - 1] };
  };
  if (!a || typeof a !== 'object') return fallback();
  if (a.type === 'tsumo') return o.canTsumo ? a : fallback();
  if (a.type === 'kyuushu') return o.kyuushu ? a : fallback();
  if (a.type === 'kita') return o.kita ? { type: 'kita' } : fallback();
  if (a.type === 'ankan') return o.ankan.includes(a.t) ? { type: 'ankan', t: a.t } : fallback();
  if (a.type === 'kakan') return o.kakan.includes(a.t) ? { type: 'kakan', t: a.t } : fallback();
  if (a.type === 'discard') {
    if (!hand.includes(a.id)) return fallback();
    if (o.locked && a.id !== o.drawn) return fallback();
    if (o.forbid.includes(tt(a.id))) return fallback();
    if (a.riichi) {
      if (!o.riichiIds.includes(a.id)) return { type: 'discard', id: a.id };
      return { type: 'discard', id: a.id, riichi: true };
    }
    return { type: 'discard', id: a.id };
  }
  return fallback();
};
Game.sanitizeReact = function (o, a) {
  if (!a || typeof a !== 'object') return { type: 'pass' };
  if (a.type === 'ron' && o.ron) return a;
  if (a.type === 'pon' && o.pon) return a;
  if (a.type === 'kan' && o.kan) return a;
  if (a.type === 'chi' && o.chi && Array.isArray(a.chi)) {
    const m = o.chi.find(c => c[0] === a.chi[0] && c[1] === a.chi[1]);
    if (m) return { type: 'chi', chi: m };
  }
  return { type: 'pass' };
};

/* ===== CPU思考 ===== */
const AI = {
  tileValue(g, p, t) {
    let v;
    if (t >= 27) {
      const yak = isDragon(t) || t === g.seatWind(p) || t === g.roundWind;
      v = yak ? 1.2 : 0;
    } else {
      const n = t % 9;
      v = (n === 0 || n === 8) ? 1 : (n === 1 || n === 7) ? 2 : 3;
    }
    for (const d of g.doraInd().map(t => doraOf(t, g.N === 3))) if (d === t) v += 4;
    return v;
  },
  ukeire(g, p, c, called, s, vis) {
    let n = 0;
    for (let t = 0; t < 34; t++) {
      if (g.N === 3 && t >= 1 && t <= 7) continue;
      const rem = 4 - vis[t];
      if (rem <= 0 || c[t] >= 4) continue;
      c[t]++;
      if (shanten(c, called) < s) n += rem;
      c[t]--;
    }
    return n;
  },
  danger(g, p, t) {
    const H = g.h;
    let total = 0;
    for (let q = 0; q < g.N; q++) {
      if (q === p || !H.riichi[q]) continue;
      const genbutsu = H.river[q].some(d => tt(d.id) === t) || H.safeAfter[q].has(t);
      if (genbutsu) continue;
      const vis = g.visibleCounts(p);
      let d;
      if (t >= 27) d = vis[t] >= 3 ? 1 : vis[t] === 2 ? 3 : 6;
      else {
        const n = t % 9, rt = new Set(H.river[q].map(x => tt(x.id)));
        const sujiLo = n >= 3 ? rt.has(t - 3) : true;
        const sujiHi = n <= 5 ? rt.has(t + 3) : true;
        const suji = (n <= 2 && rt.has(t + 3)) || (n >= 6 && rt.has(t - 3)) || (n >= 3 && n <= 5 && sujiLo && sujiHi);
        if (suji) d = (n === 0 || n === 8) ? 2 : 4;
        else d = (n === 0 || n === 8) ? 7 : (n === 1 || n === 7) ? 9 : 12;
      }
      if (g.doraInd().map(t => doraOf(t, g.N === 3)).includes(t)) d += 3;
      total += d;
    }
    return total;
  },
  analyze(g, p, forbid) {
    const H = g.h, hand = H.hands[p], c = countsOf(hand), called = H.melds[p].length;
    const vis = g.visibleCounts(p);
    const out = [], seen = new Set();
    for (const id of hand) {
      const t = tt(id);
      if (seen.has(t) || (forbid && forbid.includes(t))) continue;
      seen.add(t);
      c[t]--;
      const s = shanten(c, called);
      const uk = AI.ukeire(g, p, c, called, s, vis);
      c[t]++;
      out.push({ t, s, uk });
    }
    return out;
  },
  pickId(g, p, t, preferDrawn) {
    const hand = g.h.hands[p], cand = hand.filter(x => tt(x) === t);
    if (preferDrawn !== null && preferDrawn !== undefined && cand.includes(preferDrawn) && !isRed(preferDrawn)) return preferDrawn;
    return cand.find(x => !isRed(x)) !== undefined ? cand.find(x => !isRed(x)) : cand[0];
  },
  threat(g, p) { return g.h.riichi.some((r, q) => r && q !== p); },
  decideSelf(g, p, o) {
    const H = g.h, pl = g.P[p];
    if (o.canTsumo) return { type: 'tsumo' };
    if (o.kyuushu && o.kyuushu >= 10) return { type: 'kyuushu' };
    if (o.kita) return { type: 'kita' };
    if (o.locked) return { type: 'discard', id: o.drawn };
    const called = H.melds[p].length;
    const c = countsOf(H.hands[p]);
    const curS = shanten(c, called);
    for (const t of o.ankan) {
      c[t] -= 4;
      const s = shanten(c, called + 1);
      c[t] += 4;
      if (s <= curS - 0 && s >= 0) return { type: 'ankan', t };
    }
    if (o.kakan.length && !AI.threat(g, p)) return { type: 'kakan', t: o.kakan[0] };
    const list = AI.analyze(g, p, o.forbid);
    const style = pl.style || 'balance';
    const threat = AI.threat(g, p);
    const minS = Math.min(...list.map(x => x.s));
    const foldLine = style === 'attack' ? 2 : style === 'defense' ? 1 : 2;
    const folding = threat && (minS >= foldLine || (style === 'defense' && minS >= 1));
    let best;
    if (folding) {
      best = list.map(x => ({ ...x, dg: AI.danger(g, p, x.t) }))
        .sort((a, b) => a.dg - b.dg || a.s - b.s || b.uk - a.uk)[0];
    } else {
      best = list.map(x => ({
        ...x, score: -x.s * 1000 + x.uk * 2 - AI.tileValue(g, p, x.t) - (threat ? AI.danger(g, p, x.t) * 1.5 : 0)
      })).sort((a, b) => b.score - a.score)[0];
    }
    // リーチ判断
    if (o.riichiIds.length && best.s === 0 && !folding) {
      const rs = list.filter(x => x.s === 0 && o.riichiIds.some(id => tt(id) === x.t)).sort((a, b) => b.uk - a.uk);
      if (rs.length && rs[0].uk > 0) return { type: 'discard', id: AI.pickId(g, p, rs[0].t, o.drawn), riichi: true };
    }
    return { type: 'discard', id: AI.pickId(g, p, best.t, o.drawn) };
  },
  yakuPath(g, p, extraMeldT) {
    const H = g.h, rules = g.rules;
    const types = H.hands[p].map(tt);
    const meldT = [];
    for (const m of H.melds[p]) meldT.push(...m.tiles.map(tt));
    const isYakuhai = t => isDragon(t) || t === g.seatWind(p) || t === g.roundWind;
    if (H.melds[p].some(m => m.type !== 'chi' && isYakuhai(m.t))) return true;
    if (extraMeldT !== undefined && extraMeldT.pon && isYakuhai(extraMeldT.t)) return true;
    // 手の中に役牌の対子以上（後でポンできる）
    const c = countsOf(H.hands[p]);
    for (let t = 27; t < 34; t++) if (isYakuhai(t) && c[t] >= 2 && (!extraMeldT || extraMeldT.t !== t)) return true;
    const all = types.concat(meldT);
    if (rules.kuitan && all.every(isSimple)) return true;
    const suits = new Set(all.filter(t => t < 27).map(t => Math.floor(t / 9)));
    if (suits.size === 1) return true;
    return false;
  },
  react(g, p, o) {
    if (o.ron) return { type: 'ron' };
    const H = g.h, pl = g.P[p];
    if (AI.threat(g, p) && pl.style !== 'attack') return { type: 'pass' };
    const called = H.melds[p].length;
    const c = countsOf(H.hands[p]);
    const cur = shanten(c, called);
    const t = o.t;
    const isYakuhai = isDragon(t) || t === g.seatWind(p) || t === g.roundWind;
    const bestAfter = (rm) => {
      for (const x of rm) c[x]--;
      let b = 9;
      for (let k = 0; k < 34; k++) if (c[k]) { c[k]--; b = Math.min(b, shanten(c, called + 1)); c[k]++; }
      for (const x of rm) c[x]++;
      return b;
    };
    const menzen = g.isMenzen(p);
    if (o.pon) {
      const s = bestAfter([t, t]);
      if (isYakuhai && s <= cur) return { type: 'pon' };
      if (s < cur && (!menzen || cur >= 2) && AI.yakuPath(g, p, { pon: true, t })) {
        if (!menzen || isYakuhai || (g.rules.kuitan && isSimple(t))) return { type: 'pon' };
      }
    }
    if (o.chi) {
      for (const pr of o.chi) {
        const s = bestAfter(pr);
        if (s < cur && (!menzen || cur >= 2) && AI.yakuPath(g, p, { pon: false, t })) {
          if (!menzen || (g.rules.kuitan && isSimple(t) && isSimple(pr[0]) && isSimple(pr[1]))) return { type: 'chi', chi: pr };
        }
      }
    }
    return { type: 'pass' };
  }
};

return {
  tt, isRed, tileName, doraOf, countsOf, shanten, waitsOf, evaluate, Game, AI, mulberry32,
  isHonor, isTermHonor, isSimple, WIND, HONOR, YAOCHU
};
})();
export default MJ;

