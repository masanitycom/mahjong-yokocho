// 終局時のポイント計算の設定（ウマ・オカ）。サーバーと画面の両方で使う
export const UMA4 = {
  none: { label: 'なし', v: [0, 0, 0, 0] },
  '5-10': { label: '5-10', v: [10, 5, -5, -10] },
  '10-20': { label: '10-20', v: [20, 10, -10, -20] },
  '10-30': { label: '10-30（Mリーグ）', v: [30, 10, -10, -30] },
  '20-30': { label: '20-30', v: [30, 20, -20, -30] }
};
export const UMA3 = {
  none: { label: 'なし', v: [0, 0, 0] },
  '5': { label: '±5', v: [5, 0, -5] },
  '10': { label: '±10', v: [10, 0, -10] },
  '15': { label: '±15（標準）', v: [15, 0, -15] },
  '20': { label: '±20', v: [20, 0, -20] }
};
export const DEFAULT_UMA = { 4: '10-30', 3: '15' };
/** ルール設定から点数の数値を作る */
export function scoring(rules) {
  const sanma = !!(rules && rules.sanma);
  const table = sanma ? UMA3 : UMA4;
  const key = rules && table[rules.uma] ? rules.uma : DEFAULT_UMA[sanma ? 3 : 4];
  const start = sanma ? 35000 : 25000;
  const oka = !(rules && rules.oka === false);
  return { umaKey: key, uma: table[key].v, startScore: start, returnScore: oka ? start + 5000 : start, oka };
}
export function scoringText(rules) {
  const s = scoring(rules), n = (rules && rules.sanma) ? 3 : 4;
  const okaPt = (s.returnScore - s.startScore) * n / 1000;
  return `${s.startScore.toLocaleString()}点持ち・${s.returnScore.toLocaleString()}点返し／ウマ ${(rules && rules.sanma ? UMA3 : UMA4)[s.umaKey].label}${okaPt ? `／オカ +${okaPt}` : '／オカなし'}`;
}
