import MJ from '../lib/engine.js';
const N = +process.argv[2] || 4, G = +process.argv[3] || 60;
let hands = 0, wins = 0, draws = 0, err = 0; const yk = {}; const t0 = Date.now();
for (let gi = 0; gi < G; gi++) {
  const players = Array.from({ length: N }, (_, i) => ({ name: 'P' + i, style: ['attack','balance','defense'][i % 3] }));
  const g = new MJ.Game({ rng: MJ.mulberry32(gi + 11), rules: { sanma: N === 3, length: gi % 2 ? 'hanchan' : 'tonpuu', wareme: gi % 3 === 0 }, players,
    hooks: { handEnd: async (g, r) => { hands++; const total = N === 3 ? 105000 : 100000; const sum = g.P.reduce((a, p) => a + p.score, 0) + g.kyotaku * 1000; if (sum !== total) { console.log('SUM', sum, r.kind); err++; }
      if (r.kind === 'win') { wins++; r.res.yaku.forEach(y => yk[y.name] = (yk[y.name] || 0) + 1); } else draws++; } } });
  try { await g.run(); const s = g.final.reduce((a, f) => a + f.pt, 0); if (Math.abs(s) > 0.3) console.log('pt sum', s); if (g.final.length !== N) throw new Error('final len'); }
  catch (e) { console.log('ERR', gi, e.stack); err++; break; }
}
console.log({ N, games: G, hands, wins, draws, err, ms: Date.now() - t0 });
console.log(Object.entries(yk).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + ':' + v).join(' '));
