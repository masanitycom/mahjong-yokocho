// 選べるアイコン（public/avatars/ID.webp）
// プロフィールの avatar には「a:ID」の形で保存する。写真は data URL のまま
export const AVATARS = [
  ['ren', 'レン'], ['jin', 'ジン'], ['kai', 'カイ'], ['sora', 'ソラ'], ['aoi', 'アオイ'], ['shion', 'シオン'],
  ['tsubasa', 'ツバサ'], ['genro', 'ゲンロウ'], ['shun', 'シュン'], ['gou', 'ゴウ'], ['ruka', 'ルカ'],
  ['ran', 'ラン'], ['reika', 'レイカ'], ['kaede', 'カエデ'], ['yuki', 'ユキ'], ['arisa', 'アリサ'], ['kyoko', 'キョウコ'], ['shiori', 'シオリ']
];
export const AVATAR_EXT = 'webp';
const IDS = new Set(AVATARS.map(a => a[0]));
export const isAvatarKey = v => typeof v === 'string' && v.startsWith('a:') && IDS.has(v.slice(2));
export const avatarUrl = v => isAvatarKey(v) ? `/avatars/${v.slice(2)}.${AVATAR_EXT}` : v;
// 使えなくなったキャラ指定は無視する
export const usablePhoto = v => !v ? null : String(v).startsWith('a:') ? (isAvatarKey(v) ? v : null) : v;

// CPU の顔（名前ごとに固定）
const CPU_FACE = { 'テツ': 'jin', 'ミサキ': 'kaede', 'ゲン': 'genro', 'サヨ': 'yuki', 'リュウ': 'ren', 'ハナ': 'ran' };
export function cpuAvatar(name) {
  if (!AVATARS.length) return null;
  if (CPU_FACE[name] && IDS.has(CPU_FACE[name])) return 'a:' + CPU_FACE[name];
  let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return 'a:' + AVATARS[h % AVATARS.length][0];
}
