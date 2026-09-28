import { advance, submit } from '../lib/server/replay.js';
const game = { seed: 12345, rules: { length: 'tonpuu', aka: true, kuitan: true, timer: true },
  players: [{name:'A',human:true},{name:'B',human:false,style:'attack'},{name:'C',human:true},{name:'D',human:false}],
  log: {}, prompts: {}, eventCount: 0 };
let steps = 0, t0 = Date.now(), maxMs = 0, maxView = 0;
while (true) {
  const s0 = Date.now();
  const r = await advance(game, { applyTimeouts: false });
  maxMs = Math.max(maxMs, Date.now() - s0);
  for (const v of Object.values(r.views)) maxView = Math.max(maxView, JSON.stringify(v).length);
  // leak check: other hands hidden while active
  for (const [seat, v] of Object.entries(r.views)) {
    if (v.h && v.h.active) for (let i = 1; i < 4; i++) if (v.h.hands[i].some(x => x !== -1)) throw new Error('LEAK seat ' + seat);
  }
  if (r.done) { console.log('done', r.endReason, r.final.map(f => f.seat + ':' + f.score + '(' + f.pt + ')').join(' '), 'records', r.records.length); break; }
  const p = r.pending[0];
  let a = p.kind === 'react' ? { type: 'pass' } : p.kind === 'next' ? { type: 'next' } : { type: 'timeout' };
  if (p.kind === 'self') { const v = r.views[p.seat]; if (v.prompt.opts.canTsumo) a = { type: 'tsumo' }; }
  if (p.kind === 'react') { const v = r.views[p.seat]; if (v.prompt.opts.ron) a = { type: 'ron' }; }
  const ok = await submit(game, p.seat, p.key, a);
  if (!ok) throw new Error('submit failed');
  steps++;
}
console.log({ steps, totalMs: Date.now() - t0, maxAdvanceMs: maxMs, maxViewBytes: maxView, logSize: JSON.stringify(game.log).length });
// timeout path
const g2 = { seed: 7, rules: { length: 'tonpuu', timer: true }, players: [{name:'A',human:true},{name:'B'},{name:'C'},{name:'D'}], log: {}, prompts: {}, eventCount: 0 };
let r2 = await advance(g2, { now: 0 });
let n = 0; while (!r2.done && n < 2000) { r2 = await advance(g2, { now: (++n) * 60000 }); }
console.log('timeout-driven game done:', r2.done, 'advances', n, r2.endReason);
