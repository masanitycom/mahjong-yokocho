// 選べるアイコン（public/avatars/ID.webp）
// プロフィールの avatar には「a:ID」の形で保存する。写真は data URL のまま
// 本番用のイラストが用意できるまで空にしておく（空なら選択画面・CPUの顔は出ない）
// 追加するときは public/avatars/ID.webp を置き、['ID', '名前'] をここに並べる
export const AVATARS = [];
export const AVATAR_EXT = 'webp';
const IDS = new Set(AVATARS.map(a => a[0]));
export const isAvatarKey = v => typeof v === 'string' && v.startsWith('a:') && IDS.has(v.slice(2));
export const avatarUrl = v => isAvatarKey(v) ? `/avatars/${v.slice(2)}.${AVATAR_EXT}` : v;
// 使えなくなったキャラ指定は無視する
export const usablePhoto = v => !v ? null : String(v).startsWith('a:') ? (isAvatarKey(v) ? v : null) : v;

// CPU の顔（名前ごとに固定）
const CPU_FACE = { 'テツ': 'jin', 'ミサキ': 'mio', 'ゲン': 'kai', 'サヨ': 'yuki', 'リュウ': 'ren', 'ハナ': 'hana' };
export function cpuAvatar(name) {
  if (!AVATARS.length) return null;
  if (CPU_FACE[name] && IDS.has(CPU_FACE[name])) return 'a:' + CPU_FACE[name];
  let h = 0; for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return 'a:' + AVATARS[h % AVATARS.length][0];
}
