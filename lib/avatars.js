// 選べるアイコン（public/avatars/*.svg、scripts/avatars.mjs で生成）
// プロフィールの avatar には「a:ID」の形で保存する。写真は data URL のまま
export const AVATARS = [
  ['ren', 'レン'], ['hikari', 'ヒカリ'], ['sora', 'ソラ'], ['mio', 'ミオ'],
  ['kaede', 'カエデ'], ['aoi', 'アオイ'], ['yuki', 'ユキ'], ['kai', 'カイ'],
  ['rin', 'リン'], ['shion', 'シオン'], ['nana', 'ナナ'], ['tsubasa', 'ツバサ'],
  ['hana', 'ハナ'], ['jin', 'ジン'], ['reika', 'レイカ'], ['neko', 'ネコ']
];
const IDS = new Set(AVATARS.map(a => a[0]));
export const isAvatarKey = v => typeof v === 'string' && v.startsWith('a:') && IDS.has(v.slice(2));
export const avatarUrl = v => isAvatarKey(v) ? `/avatars/${v.slice(2)}.svg` : v;

// CPU の顔（名前ごとに固定）
const CPU_FACE = { 'テツ': 'jin', 'ミサキ': 'mio', 'ゲン': 'kai', 'サヨ': 'yuki', 'リュウ': 'ren', 'ハナ': 'hana' };
export function cpuAvatar(name) {
  if (CPU_FACE[name]) return 'a:' + CPU_FACE[name];
  let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return 'a:' + AVATARS[h % AVATARS.length][0];
}
