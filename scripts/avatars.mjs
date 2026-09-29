// アイコン用のアニメ風キャラクター（オリジナル）を SVG で描き、public/avatars/ に書き出す。
//   node scripts/avatars.mjs
// 顔・目・髪・服をパーツに分けて、キャラごとに数値と色を変えて組み立てる。
import fs from 'node:fs';
import path from 'node:path';

/* ---------- 色 ---------- */
const hex2rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const rgb2hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => rgb2hex(hex2rgb(a).map((v, i) => v + (hex2rgb(b)[i] - v) * t));
const dk = (c, t) => mix(c, '#1a0f14', t);   // 少し赤みのある黒に寄せる（アニメの影色）
const lt = (c, t) => mix(c, '#ffffff', t);

let UID = 0;
const uid = p => `${p}${++UID}`;

/* ---------- 目 ---------- */
// 右目の形を基準に描き、左目は左右反転する。outer が +x 側
function eye(cx, cy, side, c) {
  const tilt = c.tilt || 0, sx = c.eyeW || 1, sy = c.eyeH || 1;
  const lash = c.lash, iris = c.iris;
  const cid = uid('ec'), gid = uid('eg'), rid = uid('er');
  const sclera = 'M-11,0 C-8,-8 4,-11 12,-6.5 C12.5,3 8,12 1,13 C-6,13 -10.5,6 -11,0 Z';
  const shape = c.eyeShape || 'round';
  // まつげ（上）: 外側が太く、先が少し跳ねる
  // 上まつげ：目頭は細く、目尻に向かって太くなり、外へ少し流れる
  const upper = shape === 'sharp'
    ? 'M-12,1 C-9,-7.5 3,-11.5 12.5,-7.8 C15.5,-6.6 17.5,-5 18.5,-2.6 C16.5,-3.8 14.6,-4.2 12.8,-4 C4.5,-7.8 -7,-5.6 -10.6,2 Z'
    : 'M-12.2,0.5 C-9.5,-9.5 3.5,-13.8 12.8,-8.6 C15.8,-7 17.8,-4.6 18.2,-1.8 C16.4,-3.4 14.6,-4 12.6,-4.2 C4,-9.3 -8,-7.2 -10.8,2 Z';
  const spikes = c.lashes ? `<path d="M15.5,-6.5 L20.5,-8.8 L16.8,-4.2 Z M12.5,-8.8 L16.6,-12.4 L14.6,-7.6 Z" fill="${lash}"/>` : '';
  const top = shape === 'sharp' ? -9 : -11;
  const irisRy = shape === 'sharp' ? 9 : 10.5;
  return `<g transform="translate(${cx},${cy}) scale(${side * sx},${sy}) rotate(${-tilt})">
  <defs>
    <clipPath id="${cid}"><path d="${sclera}"/></clipPath>
    <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${dk(iris, .62)}"/><stop offset=".42" stop-color="${iris}"/><stop offset="1" stop-color="${lt(iris, .55)}"/>
    </linearGradient>
    <radialGradient id="${rid}" cx=".5" cy=".85" r=".55"><stop offset="0" stop-color="${lt(iris, .75)}" stop-opacity=".95"/><stop offset="1" stop-color="${lt(iris, .75)}" stop-opacity="0"/></radialGradient>
  </defs>
  <path d="${sclera}" fill="#fffdfb"/>
  <g clip-path="url(#${cid})">
    <ellipse cx="1.5" cy="2.5" rx="8.2" ry="${irisRy}" fill="url(#${gid})" stroke="${dk(iris, .7)}" stroke-width="1"/>
    <ellipse cx="1.5" cy="6.5" rx="6.5" ry="5.5" fill="url(#${rid})"/>
    <ellipse cx="1.7" cy="2.8" rx="3.4" ry="${shape === 'sharp' ? 4.2 : 5}" fill="${dk(iris, .8)}"/>
    <path d="M-11,${top + 11} C-8,${top + 3} 4,${top} 12,${top + 4.5} L12,${top + 9} C4,${top + 4} -8,${top + 6} -11,${top + 15} Z" fill="${lash}" opacity=".3"/>
    <ellipse cx="-2.6" cy="-1.5" rx="2.9" ry="3.7" fill="#fff"/>
    <circle cx="5.2" cy="7" r="1.5" fill="#fff" opacity=".95"/>
    <circle cx="-4.5" cy="7.5" r=".9" fill="#fff" opacity=".7"/>
  </g>
  <path d="${upper}" fill="${lash}"/>${spikes}
  ${shape === 'sharp' ? '' : `<path d="M-6,-12.5 Q4,-16.5 12.5,-11.5" fill="none" stroke="${lash}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`}
  <path d="M2.5,13.4 Q9,12 12.3,6.5" fill="none" stroke="${lash}" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
  ${c.lowerLash ? `<path d="M11.8,8.5 L14.2,9.8 M9.8,11 L11.8,12.8" stroke="${lash}" stroke-width=".9" stroke-linecap="round"/>` : ''}
</g>`;
}
function brow(cx, cy, side, c) {
  const a = c.browTilt || 0;
  const d = c.browThick ? 'M-12,1 Q0,-5.5 13,-1 Q0,-2.2 -12,3.2 Z' : 'M-11,1 Q0,-4.8 12.5,-0.6 Q0,-2.3 -11,2.4 Z';
  return `<g transform="translate(${cx},${cy}) scale(${side},1) rotate(${-a})" opacity=".92"><path d="${d}" fill="${dk(c.hair, .55)}"/></g>`;
}

/* ---------- 口 ---------- */
function mouth(type, c) {
  const line = c.skinLine;
  const y = 136;
  switch (type) {
    case 'open': // にっこり開いた口
      return `<path d="M93,${y - 1.5} Q100,${y + 0.5} 107,${y - 1.5} Q106,${y + 7.5} 100,${y + 8} Q94,${y + 7.5} 93,${y - 1.5} Z" fill="#9c3440" stroke="${line}" stroke-width="1" stroke-linejoin="round"/>
        <path d="M95.5,${y + 5} Q100,${y + 2.5} 104.5,${y + 5} Q102.5,${y + 7.6} 100,${y + 7.8} Q97.5,${y + 7.6} 95.5,${y + 5} Z" fill="#f08a95"/>`;
    case 'grin': // 歯を見せて笑う
      return `<path d="M91.5,${y - 2.5} Q100,${y + 0.5} 108.5,${y - 3.5} Q106,${y + 6.5} 100,${y + 7} Q94,${y + 6.5} 91.5,${y - 2.5} Z" fill="#9c3440" stroke="${line}" stroke-width="1" stroke-linejoin="round"/>
        <path d="M92.5,${y - 1.8} Q100,${y + 1} 107.5,${y - 2.8} L107,${y} Q100,${y + 3.2} 93,${y + 0.5} Z" fill="#fff"/>`;
    case 'cat': // ω
      return `<path d="M93,${y - 1} Q96.5,${y + 3.2} 100,${y} Q103.5,${y + 3.2} 107,${y - 1}" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'smirk':
      return `<path d="M94,${y + 0.5} Q101,${y + 1.8} 107,${y - 2.5}" fill="none" stroke="${line}" stroke-width="1.5" stroke-linecap="round"/>`;
    case 'flat':
      return `<path d="M96,${y} Q100,${y + 0.8} 104,${y}" fill="none" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/>`;
    case 'o':
      return `<ellipse cx="100" cy="${y + 1.5}" rx="2.6" ry="3.2" fill="#9c3440" stroke="${line}" stroke-width="1"/>`;
    default: // smile
      return `<path d="M94.5,${y - 0.5} Q100,${y + 3.6} 105.5,${y - 0.5}" fill="none" stroke="${line}" stroke-width="1.5" stroke-linecap="round"/>`;
  }
}

/* ---------- 髪 ---------- */
// 毛束（先が細くなる房）。根元は頭のてっぺん側に隠れる
function clump(rx, ry, tx, ty, w, bend) {
  const h = ty - ry;
  // 先の近くまで太さを保ち、最後にすっと細くなる
  return `M${rx - w / 2},${ry} C${rx - w / 2 + bend * .1},${ry + h * .55} ${tx - w * .52 + bend * .9},${ty - h * .32} ${tx},${ty}` +
    ` C${tx + w * .34 + bend * .8},${ty - h * .42} ${rx + w / 2 + bend * .1},${ry + h * .55} ${rx + w / 2},${ry} Z`;
}
// 前髪の房を並べる。f = { n, y, part, spread, w, bend, jag, seed }
function fringe(f) {
  const n = f.n || 7, out = [];
  let seed = f.seed || 3;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1..1
    const side = t - (f.part || 0);
    const tx = 100 + t * (f.spread || 42);
    const ty = (f.y || 104) - (1 - Math.abs(t)) * (f.arch || 4) + Math.abs(t) * (f.drop || 10) + (rnd() - .5) * (f.jag || 8);
    const rx = 100 + t * 20, ry = 46 + Math.abs(t) * 10;
    const w = (f.w || 26) - Math.abs(t) * 6;
    const bend = side * (f.bend || 7) + (f.sweep || 0);
    out.push({ rx, ry, tx, ty, w, bend, t });
  }
  // 外側から順に描き、真ん中の房が上に乗るように
  return out.sort((a, b) => Math.abs(b.t) - Math.abs(a.t)).map(o => clump(o.rx, o.ry, o.tx, o.ty, o.w, o.bend));
}
function shine(c) { // 天使の輪：頭の丸みに沿った帯。下側はギザギザ
  const y = c.shineY || 50, col = c.shineCol || (hex2rgb(c.hair).reduce((a, b) => a + b) < 240 ? mix(c.hair, '#9fb4d8', .45) : lt(c.hair, .65));
  const X = t => 100 + t * 40, Y = t => y + t * t * 16;
  let d = `M${X(-1)},${Y(-1)}`;
  for (let i = 1; i <= 20; i++) { const t = -1 + i / 10; d += ` L${X(t).toFixed(1)},${(Y(t) - 1.5).toFixed(1)}`; }
  for (let i = 20; i >= 0; i--) { const t = -1 + i / 10; const k = 1 - Math.abs(t); d += ` L${X(t).toFixed(1)},${(Y(t) + 2 + (i % 2 ? 7 * k + 2 : 1)).toFixed(1)}`; }
  return `<path d="${d} Z" fill="${col}" opacity="${c.shineOp || .55}"/>`;
}
/* ---------- 服 ---------- */
function clothes(c) {
  const col = c.cloth, line = dk(col, .6), skinS = c.skinShade;
  const torso = `M14,200 C20,178 52,166 84,163 L116,163 C148,166 180,178 186,200 Z`;
  const base = `<path d="${torso}" fill="${col}" stroke="${line}" stroke-width="1.6"/>`;
  switch (c.outfit) {
    case 'blazer':
      return base + `<path d="M84,163 L100,196 L116,163 Z" fill="#fbfbff" stroke="${dk('#fbfbff', .5)}" stroke-width="1.2"/>
        <path d="M84,163 L76,172 L97,200 L100,196 Z M116,163 L124,172 L103,200 L100,196 Z" fill="${dk(col, .25)}" stroke="${line}" stroke-width="1.2"/>
        ${c.tie ? `<path d="M96,168 L104,168 L102,174 L106,196 L100,200 L94,196 L98,174 Z" fill="${c.tie}" stroke="${dk(c.tie, .5)}" stroke-width="1"/>`
               : `<path d="M100,172 L88,166 L86,178 Z M100,172 L112,166 L114,178 Z" fill="${c.ribbon || '#e0445a'}" stroke="${dk(c.ribbon || '#e0445a', .5)}" stroke-width="1"/><circle cx="100" cy="172" r="3" fill="${dk(c.ribbon || '#e0445a', .2)}"/>`}`;
    case 'sailor':
      return base + `<path d="M84,163 L100,190 L116,163 Z" fill="${skinS}"/>
        <path d="M78,164 L100,196 L122,164 L150,172 L128,188 L100,200 L72,188 L50,172 Z" fill="${c.collar || '#1f3a6b'}" stroke="${line}" stroke-width="1.2"/>
        <path d="M58,174 L100,199 L142,174" fill="none" stroke="#fff" stroke-width="1.6" opacity=".9"/>
        <path d="M100,186 L88,178 L84,190 Z M100,186 L112,178 L116,190 Z" fill="${c.ribbon || '#e0445a'}" stroke="${dk(c.ribbon || '#e0445a', .5)}" stroke-width="1"/>`;
    case 'hoodie':
      return `<path d="M60,176 C62,160 80,156 100,156 C120,156 138,160 140,176 Z" fill="${dk(col, .2)}" stroke="${line}" stroke-width="1.5"/>` + base +
        `<path d="M82,164 Q100,180 118,164" fill="none" stroke="${line}" stroke-width="1.6"/>
         <path d="M92,172 L90,194 M108,172 L110,194" stroke="${c.accent || '#fff'}" stroke-width="2" stroke-linecap="round"/>
         <circle cx="90" cy="195" r="2.2" fill="${c.accent || '#fff'}"/><circle cx="110" cy="195" r="2.2" fill="${c.accent || '#fff'}"/>`;
    case 'kimono':
      return base + `<path d="M84,163 L112,200 L124,200 L96,163 Z" fill="${c.inner || '#f4efe6'}" stroke="${line}" stroke-width="1.2"/>
        <path d="M116,163 L90,200 L100,200 L120,172 Z" fill="${c.inner || '#f4efe6'}" stroke="${line}" stroke-width="1.2"/>
        <path d="M30,190 Q60,184 80,196 M150,186 Q166,188 176,196" fill="none" stroke="${lt(col, .35)}" stroke-width="2" opacity=".6"/>`;
    case 'suit':
      return base + `<path d="M85,163 L100,188 L115,163 Z" fill="#f5f5f5" stroke="#999" stroke-width="1"/>
        <path d="M96,166 L104,166 L102,171 L105,194 L100,199 L95,194 L98,171 Z" fill="${c.tie || '#a3202e'}" stroke="${dk(c.tie || '#a3202e', .5)}" stroke-width="1"/>
        <path d="M85,163 L74,170 L93,200 L97,200 Z M115,163 L126,170 L107,200 L103,200 Z" fill="${dk(col, .3)}" stroke="${line}" stroke-width="1.2"/>`;
    case 'jacket':
      return base + `<path d="M84,163 L90,200 L110,200 L116,163 Q100,170 84,163 Z" fill="${c.inner || '#1b1b22'}" stroke="${line}" stroke-width="1.2"/>
        <path d="M84,163 L72,170 L88,200 L92,200 Z M116,163 L128,170 L112,200 L108,200 Z" fill="${dk(col, .25)}" stroke="${line}" stroke-width="1.2"/>
        ${c.chain ? `<path d="M90,168 Q100,182 110,168" fill="none" stroke="#d9c27a" stroke-width="1.4"/><rect x="97.5" y="176" width="5" height="7" rx="1" fill="#e8d48a" stroke="#8a7535" stroke-width=".8"/>` : ''}`;
    case 'qipao':
      return base + `<path d="M86,158 L114,158 L116,168 Q100,172 84,168 Z" fill="${col}" stroke="${line}" stroke-width="1.4"/>
        <path d="M100,169 Q108,176 120,172 L126,186" fill="none" stroke="${c.accent || '#f2cf73'}" stroke-width="1.8"/>
        <circle cx="112" cy="175" r="2.2" fill="${c.accent || '#f2cf73'}"/>
        <path d="M40,188 q6,-6 12,0 q6,6 12,0 M140,184 q6,-6 12,0 q6,6 12,0" fill="none" stroke="${c.accent || '#f2cf73'}" stroke-width="1.4" opacity=".7"/>`;
    case 'sweater':
    default:
      return base + `<path d="M82,163 Q100,176 118,163 L116,168 Q100,182 84,168 Z" fill="${dk(col, .18)}" stroke="${line}" stroke-width="1.2"/>
        <path d="M40,186 L60,182 M140,182 L160,186" stroke="${dk(col, .25)}" stroke-width="1.4" opacity=".6"/>`;
  }
}

/* ---------- 小物 ---------- */
function extras(c, layer) {
  let s = '';
  for (const a of c.acc || []) {
    const [kind, arg = {}] = Array.isArray(a) ? a : [a];
    const col = arg.col || '#e0445a';
    if (layer === 'back' && kind === 'catEars') {
      const f = c.hair, l = dk(c.hair, .6);
      s += `<path d="M58,70 L52,30 L84,50 Z" fill="${f}" stroke="${l}" stroke-width="1.6" stroke-linejoin="round"/><path d="M61,63 L57,39 L77,52 Z" fill="#f7b2c1"/>
            <path d="M142,70 L148,30 L116,50 Z" fill="${f}" stroke="${l}" stroke-width="1.6" stroke-linejoin="round"/><path d="M139,63 L143,39 L123,52 Z" fill="#f7b2c1"/>`;
    }
    if (layer === 'back' && kind === 'headphones') {
      s += `<path d="M50,100 C46,40 154,40 150,100" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"/>`;
    }
    if (layer === 'front' && kind === 'headphones') {
      s += `<rect x="42" y="92" width="16" height="30" rx="7" fill="${col}" stroke="${dk(col, .6)}" stroke-width="1.6"/><rect x="142" y="92" width="16" height="30" rx="7" fill="${col}" stroke="${dk(col, .6)}" stroke-width="1.6"/>
            <rect x="46" y="98" width="6" height="18" rx="3" fill="${lt(col, .35)}"/>`;
    }
    if (layer === 'front' && kind === 'ribbon') {
      const x = arg.x || 136, y = arg.y || 58;
      s += `<g transform="translate(${x},${y}) rotate(${arg.rot || 20})"><path d="M0,0 L-15,-10 L-14,9 Z M0,0 L15,-10 L14,9 Z" fill="${col}" stroke="${dk(col, .55)}" stroke-width="1.3" stroke-linejoin="round"/><circle r="3.6" fill="${dk(col, .15)}" stroke="${dk(col, .55)}" stroke-width="1.1"/></g>`;
    }
    if (layer === 'front' && kind === 'pin') {
      const x = arg.x || 66, y = arg.y || 82;
      s += `<g transform="translate(${x},${y}) rotate(${arg.rot || -30})"><rect x="-9" y="-2" width="18" height="4" rx="2" fill="${col}"/><rect x="-2" y="-9" width="4" height="18" rx="2" fill="${col}" transform="rotate(${arg.x2 ? 90 : 0})" opacity="${arg.cross ? 1 : 0}"/></g>`;
    }
    if (layer === 'front' && kind === 'star') {
      const x = arg.x || 64, y = arg.y || 80;
      s += `<path transform="translate(${x},${y}) scale(.9)" d="M0,-8 L2.4,-2.4 L8,-2 L3.6,1.8 L5,7.6 L0,4.6 L-5,7.6 L-3.6,1.8 L-8,-2 L-2.4,-2.4 Z" fill="${col}" stroke="${dk(col, .5)}" stroke-width="1"/>`;
    }
    if (layer === 'glasses' && kind === 'glasses') {
      const r = arg.round;
      const lens = (x) => r ? `<circle cx="${x}" cy="113" r="14" />` : `<rect x="${x - 15}" y="102" width="30" height="21" rx="5"/>`;
      s += `<g fill="${arg.tint || 'rgba(190,220,255,.18)'}" stroke="${col}" stroke-width="2">${lens(81)}${lens(119)}</g><path d="M${r ? 95 : 96},111 Q100,108 ${r ? 105 : 104},111" fill="none" stroke="${col}" stroke-width="2"/>
            <path d="M${r ? 72 : 70},106 L${r ? 76 : 76},104" stroke="#fff" stroke-width="2" opacity=".6" stroke-linecap="round"/><path d="M${r ? 110 : 108},106 L${r ? 114 : 114},104" stroke="#fff" stroke-width="2" opacity=".6" stroke-linecap="round"/>`;
    }
    if (layer === 'face' && kind === 'mole') s += `<circle cx="${arg.x || 114}" cy="${arg.y || 130}" r="1.3" fill="${dk(c.skin, .7)}"/>`;
    if (layer === 'face' && kind === 'scar') s += `<path d="M118,96 L126,112" stroke="${dk(c.skin, .35)}" stroke-width="1.6" stroke-linecap="round"/>`;
    if (layer === 'face' && kind === 'earring') s += `<circle cx="${arg.x || 60}" cy="${arg.y || 122}" r="2.4" fill="${col}" stroke="${dk(col, .5)}" stroke-width=".8"/>`;
    if (layer === 'face' && kind === 'fang') s += `<path d="M103.5,135.8 L105,139.5 L106.5,135.4 Z" fill="#fff" stroke="${c.skinLine}" stroke-width=".6"/>`;
  }
  return s;
}

/* ---------- 後ろ髪 ---------- */
function backHair(c, fill, line) {
  const st = `fill="${fill}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round"`;
  const b = c.back || 'short';
  if (b === 'spiky') { // 外はねの短髪：横と後ろに小さな毛先
    return `<path d="M48,98 C42,56 70,30 100,30 C130,30 158,56 152,98 L162,104 L150,110 L158,122 L145,118 L142,132 L135,120 L130,126 L70,126 L65,120 L58,132 L55,118 L42,122 L50,110 L38,104 L48,98 Z" ${st}/>
      <path d="M58,50 L46,40 L62,42 Z M142,50 L154,40 L138,42 Z" ${st}/>`;
  }
  if (b === 'short') return `<path d="M48,98 C42,56 70,30 100,30 C130,30 158,56 152,98 L151,120 L145,113 L142,130 L136,118 L130,126 L70,126 L64,118 L58,130 L55,113 L49,120 Z" ${st}/>`;
  if (b === 'bob') return `<path d="M47,98 C41,56 70,30 100,30 C130,30 159,56 153,98 C157,124 153,144 146,154 Q138,158 132,150 L68,150 Q62,158 54,154 C47,144 43,124 47,98 Z" ${st}/>`;
  // long
  const L = c.long || 196;
  return `<path d="M48,96 C40,56 70,30 100,30 C130,30 160,56 152,96 C158,130 160,${L - 34} 170,${L} Q156,${L - 6} 148,${L + 4} Q140,${L - 8} 128,${L - 2} L72,${L - 2} Q60,${L - 8} 52,${L + 4} Q44,${L - 6} 30,${L} C40,${L - 34} 42,130 48,96 Z" ${st}/>`;
}

/* ---------- 1人分 ---------- */
function portrait(c) {
  UID = 0;
  c = Object.assign({ skin: '#ffe6d5', mouth: 'smile', outfit: 'sweater', blush: true, tilt: 0 }, c);
  c.skinShade = c.skinShade || mix(c.skin, '#e39a86', .45);
  c.skinLine = c.skinLine || mix(c.skin, '#7a3a2e', .72);
  c.lash = c.lash || dk(c.hair, .85);
  const hairL = dk(c.hair, .62), hairS = dk(c.hair, .3);
  const faceD = 'M62,90 C62,58 138,58 138,90 L138,109 C137,124 118,142 100,150 C82,142 63,124 62,109 Z';
  const faceClip = uid('fc'), bgId = uid('bg'), hg = uid('hg');
  const fr = fringe(c.fringe || {});
  const sides = (c.sides || []).map(s => clump(...s));
  const hairFill = `url(#${hg})`;
  const strand = d => `<path d="${d}" fill="${hairFill}" stroke="${hairL}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const ey = c.eyeY || 111;

  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="18 20 164 164" width="256" height="256">`);
  o.push(`<defs>
    <radialGradient id="${bgId}" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="${lt(c.bg, .4)}"/><stop offset=".65" stop-color="${c.bg}"/><stop offset="1" stop-color="${dk(c.bg, .35)}"/></radialGradient>
    <linearGradient id="${hg}" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="150"><stop offset="0" stop-color="${lt(c.hair, .14)}"/><stop offset=".55" stop-color="${c.hair}"/><stop offset="1" stop-color="${dk(c.hair, .22)}"/></linearGradient>
    <clipPath id="${faceClip}"><path d="${faceD}"/></clipPath>
  </defs>`);
  o.push(`<rect x="0" y="0" width="200" height="200" fill="url(#${bgId})"/>`);
  o.push(`<g opacity=".15" fill="#fff"><path d="M0,70 L70,0 L90,0 L0,90 Z"/><path d="M0,120 L120,0 L130,0 L0,130 Z"/><path d="M130,210 L210,130 L210,160 L160,210 Z"/></g>`);
  if (c.sparkle) o.push(`<g fill="#fff" opacity=".8"><path d="M34,46 l2,6 l6,2 l-6,2 l-2,6 l-2,-6 l-6,-2 l6,-2 Z"/><path d="M166,50 l1.5,4 l4,1.5 l-4,1.5 l-1.5,4 l-1.5,-4 l-4,-1.5 l4,-1.5 Z"/><circle cx="158" cy="32" r="1.6"/><circle cx="42" cy="76" r="1.2"/></g>`);
  o.push(extras(c, 'back'));
  if (c.twin) o.push(`<path d="M60,62 C30,62 18,104 22,146 C24,168 16,186 10,198 C34,188 44,168 44,148 C44,118 52,92 64,80 Z" fill="${hairFill}" stroke="${hairL}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M140,62 C170,62 182,104 178,146 C176,168 184,186 190,198 C166,188 156,168 156,148 C156,118 148,92 136,80 Z" fill="${hairFill}" stroke="${hairL}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M40,86 C30,108 30,138 32,160 M160,86 C170,108 170,138 168,160" fill="none" stroke="${hairL}" stroke-width="1" opacity=".45"/>`);
  if (c.pony) o.push(`<path d="M136,48 C170,34 192,66 186,106 C182,134 190,158 196,176 C172,168 164,140 166,112 C168,86 156,70 140,68 Z" fill="${hairFill}" stroke="${hairL}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M172,68 C182,90 176,120 178,146" fill="none" stroke="${hairL}" stroke-width="1" opacity=".45"/>`);
  if (c.buns) o.push(`<circle cx="60" cy="46" r="17" fill="${c.hair}" stroke="${hairL}" stroke-width="1.6"/><circle cx="140" cy="46" r="17" fill="${c.hair}" stroke="${hairL}" stroke-width="1.6"/>
      <path d="M50,40 Q60,32 70,40 M130,40 Q140,32 150,40" fill="none" stroke="${hairL}" stroke-width="1" opacity=".5"/>`);
  o.push(backHair(c, hairS, hairL));
  // 首・服
  o.push(`<path d="M88,136 L88,170 Q100,176 112,170 L112,136 Z" fill="${c.skin}" stroke="${c.skinLine}" stroke-width="1.4"/>`);
  o.push(`<path d="M88,138 Q100,160 112,138 L112,154 Q100,166 88,154 Z" fill="${c.skinShade}"/>`);
  o.push(clothes(c));
  if (!c.noEars) o.push(`<path d="M63,100 C54,96 53,112 58,118 C60,121 63,121 64,119 Z" fill="${c.skin}" stroke="${c.skinLine}" stroke-width="1.4"/><path d="M137,100 C146,96 147,112 142,118 C140,121 137,121 136,119 Z" fill="${c.skin}" stroke="${c.skinLine}" stroke-width="1.4"/>`);
  // 顔
  o.push(`<path d="${faceD}" fill="${c.skin}" stroke="${c.skinLine}" stroke-width="1.5"/>`);
  o.push(`<g clip-path="url(#${faceClip})" fill="${c.skinShade}" opacity=".9">${fr.concat(sides).map(d => `<path d="${d}" transform="translate(1,6)"/>`).join('')}</g>`);
  if (c.blush) o.push(`<g opacity=".5"><ellipse cx="76" cy="124" rx="8" ry="4" fill="#ff8a9a"/><ellipse cx="124" cy="124" rx="8" ry="4" fill="#ff8a9a"/></g>
    <g stroke="#e0607a" stroke-width=".9" opacity=".55" stroke-linecap="round"><path d="M72,125 L74,121 M76,125 L78,121 M80,125 L82,121"/><path d="M118,125 L120,121 M122,125 L124,121 M126,125 L128,121"/></g>`);
  o.push(brow(81, c.browY || 93, -1, c), brow(119, c.browY || 93, 1, c));
  o.push(eye(81, ey, -1, c), eye(119, ey, 1, c));
  o.push(`<path d="M99.5,126 L101.2,128.2" stroke="${c.skinLine}" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`);
  o.push(mouth(c.mouth, c));
  o.push(extras(c, 'face'));
  // 髪（横の房 → 前髪 → 頭頂）
  sides.forEach(d => o.push(strand(d)));
  fr.forEach(d => o.push(strand(d)));
  const cap = 'M46,100 C40,56 68,28 100,28 C132,28 160,56 154,100 C146,78 128,62 100,62 C72,62 54,78 46,100 Z';
  o.push(`<path d="${cap}" fill="${hairFill}"/>`);
  o.push(`<path d="M46,100 C40,56 68,28 100,28 C132,28 160,56 154,100" fill="none" stroke="${hairL}" stroke-width="1.6"/>`);
  o.push(shine(c));
  if (c.ahoge) o.push(`<path d="M100,30 C96,16 104,8 115,11 C107,15 105,22 105,30 Z" fill="${c.hair}" stroke="${hairL}" stroke-width="1.4" stroke-linejoin="round"/>`);
  // 眉は前髪に透けて見える
  o.push(`<g opacity=".45">${brow(81, c.browY || 93, -1, c)}${brow(119, c.browY || 93, 1, c)}</g>`);
  o.push(extras(c, 'front'));
  o.push(extras(c, 'glasses'));
  o.push(`</svg>`);
  return o.join('\n');
}

/* ---------- キャラクター（すべてオリジナル） ---------- */
// fringe: 前髪 { n:房の数, y:毛先の高さ, w:房の太さ, bend:外への流れ, sweep:片側への流れ, jag:長さのばらつき, drop:外側ほど長く }
// sides: 横の房 [根元x, 根元y, 先x, 先y, 太さ, 曲がり]
const SIDE = (len, w = 15, b = 3) => [[58, 72, 60, len, w, -b], [142, 72, 140, len, w, b]];
export const CHARS = [
  { id: 'ren', name: 'レン', note: 'クール', hair: '#2a2e39', iris: '#d23a3a', bg: '#3b4a7a', eyeShape: 'sharp', tilt: 6, eyeH: .92, browTilt: 8, browThick: true, mouth: 'smirk', outfit: 'jacket', cloth: '#262a33', chain: true, blush: false,
    back: 'short', fringe: { n: 7, y: 102, w: 22, bend: 8, jag: 12, sweep: -5, seed: 5 }, sides: SIDE(128, 14, 3), acc: [['earring', { col: '#d8d8e0' }]] },
  { id: 'hikari', name: 'ヒカリ', note: 'げんき', hair: '#ff8fb8', iris: '#3a8ef0', bg: '#ffc2d9', mouth: 'open', outfit: 'sailor', cloth: '#fbfbff', ribbon: '#e8455d', twin: true, sparkle: true, lashes: true,
    back: 'bob', fringe: { n: 7, y: 96, w: 27, bend: 5, jag: 5, drop: 14, seed: 2 }, sides: SIDE(150, 15, 4), ahoge: true,
    acc: [['ribbon', { col: '#ff4d6d', x: 58, y: 60, rot: -20 }], ['ribbon', { col: '#ff4d6d', x: 142, y: 60, rot: 20 }]] },
  { id: 'sora', name: 'ソラ', note: 'おだやか', hair: '#cfd6e6', iris: '#4a90d9', bg: '#9bc4ea', mouth: 'smile', outfit: 'hoodie', cloth: '#5a6b8c', accent: '#f4f4f8', blush: false,
    back: 'short', fringe: { n: 6, y: 100, w: 27, bend: 6, jag: 8, sweep: 4, seed: 7 }, sides: SIDE(132, 15, 2), shineCol: '#ffffff' },
  { id: 'mio', name: 'ミオ', note: 'おしとやか', hair: '#27232f', iris: '#8e5bd6', bg: '#b9a3e3', mouth: 'smile', outfit: 'blazer', cloth: '#2d3558', ribbon: '#c23b5a', long: 196, lowerLash: true, lashes: true,
    back: 'long', fringe: { n: 8, y: 95, w: 22, bend: 1, jag: 2, drop: 0, arch: 0, seed: 1 }, sides: SIDE(158, 16, 0), acc: [['pin', { col: '#e8d48a', x: 128, y: 74, rot: 30 }]] },
  { id: 'kaede', name: 'カエデ', note: 'あかるい', hair: '#f08a3c', iris: '#3fae6a', bg: '#ffd27a', mouth: 'grin', outfit: 'sweater', cloth: '#f6f0e4', sparkle: true, lashes: true,
    back: 'bob', fringe: { n: 6, y: 96, w: 29, bend: 7, jag: 6, sweep: -6, seed: 4 }, sides: [[58, 72, 55, 142, 16, -6], [142, 72, 145, 142, 16, 6]], acc: [['headphones', { col: '#2f3f63' }]] },
  { id: 'aoi', name: 'アオイ', note: 'りちてき', hair: '#2e4f86', iris: '#3aa6c9', bg: '#7fb0d6', eyeShape: 'sharp', tilt: 3, mouth: 'flat', outfit: 'blazer', cloth: '#1f2740', tie: '#2f6fb3', blush: false,
    back: 'short', fringe: { n: 7, y: 98, w: 23, bend: 5, jag: 8, sweep: 6, part: .3, seed: 9 }, sides: SIDE(126, 13, 2), acc: [['glasses', { col: '#39404f' }]] },
  { id: 'yuki', name: 'ユキ', note: 'しずか', hair: '#eef1f8', iris: '#d2455a', bg: '#8fa8d0', mouth: 'smile', outfit: 'kimono', cloth: '#6c86c8', inner: '#fbf7ef', long: 200, lowerLash: true, lashes: true, shineCol: '#b9d6ff',
    back: 'long', fringe: { n: 7, y: 98, w: 25, bend: 4, jag: 4, seed: 6 }, sides: SIDE(172, 15, 2), acc: [['star', { col: '#a9d3ff', x: 66, y: 78 }]] },
  { id: 'kai', name: 'カイ', note: 'やんちゃ', hair: '#f4c64a', iris: '#e0892a', bg: '#f28b4b', eyeShape: 'sharp', tilt: 4, browTilt: 4, browThick: true, mouth: 'grin', outfit: 'jacket', cloth: '#c23b3b', inner: '#222', blush: false,
    back: 'spiky', fringe: { n: 7, y: 94, w: 21, bend: 12, jag: 14, drop: -2, seed: 8 }, sides: SIDE(122, 13, 5), acc: [['fang']] },
  { id: 'rin', name: 'リン', note: 'きまぐれ', hair: '#f6d57a', iris: '#27b3a3', bg: '#9fe0cf', mouth: 'cat', outfit: 'hoodie', cloth: '#f7a8c0', accent: '#fff', pony: true, sparkle: true, lashes: true,
    back: 'bob', fringe: { n: 7, y: 98, w: 25, bend: 6, jag: 6, sweep: -5, seed: 3 }, sides: SIDE(138, 14, 3), acc: [['pin', { col: '#ff6b8a', x: 70, y: 78, rot: -40 }]] },
  { id: 'shion', name: 'シオン', note: 'ミステリアス', hair: '#6a4fa3', iris: '#e0b64a', bg: '#4b3a7a', eyeShape: 'sharp', tilt: 2, eyeH: .9, mouth: 'smile', outfit: 'kimono', cloth: '#2b2540', inner: '#d8cfe8', blush: false, long: 184,
    back: 'long', fringe: { n: 6, y: 104, w: 26, bend: 8, sweep: -9, part: -.4, jag: 6, seed: 11 }, sides: [[142, 72, 146, 170, 14, 5]], acc: [['mole', { x: 86, y: 128 }]] },
  { id: 'nana', name: 'ナナ', note: 'ふんわり', hair: '#8a5a3c', iris: '#b86b2e', bg: '#f3c8a8', mouth: 'smile', outfit: 'sweater', cloth: '#f2e3c9', pony: true, lowerLash: true, lashes: true,
    back: 'bob', fringe: { n: 7, y: 98, w: 26, bend: 5, jag: 5, seed: 12 }, sides: SIDE(146, 14, 3), acc: [['ribbon', { col: '#6aa8e0', x: 150, y: 56, rot: 30 }]] },
  { id: 'tsubasa', name: 'ツバサ', note: 'ねっけつ', hair: '#c9303a', iris: '#2f9e57', bg: '#ff9a6b', eyeShape: 'sharp', tilt: 5, browTilt: 10, browThick: true, mouth: 'open', outfit: 'hoodie', cloth: '#2b2b33', accent: '#ff5a3c', blush: false,
    back: 'spiky', fringe: { n: 7, y: 94, w: 21, bend: 12, jag: 14, sweep: 6, seed: 13 }, sides: SIDE(120, 13, 5) },
  { id: 'hana', name: 'ハナ', note: 'にこにこ', hair: '#79c9a8', iris: '#e0627a', bg: '#c6f0dc', mouth: 'open', outfit: 'qipao', cloth: '#e04a5a', accent: '#ffd66b', buns: true, sparkle: true, lashes: true,
    back: 'bob', fringe: { n: 7, y: 96, w: 26, bend: 5, jag: 5, seed: 14 }, sides: SIDE(150, 13, 2) },
  { id: 'jin', name: 'ジン', note: 'しぶい', hair: '#1e1c22', iris: '#9aa3ad', bg: '#5b5048', eyeShape: 'sharp', tilt: 3, eyeH: .82, browTilt: 6, browThick: true, mouth: 'smirk', outfit: 'suit', cloth: '#1d1f26', tie: '#8c1c2a', blush: false, skin: '#f3d3bd',
    back: 'short', fringe: { n: 4, y: 78, w: 30, bend: 10, sweep: 16, drop: 14, jag: 6, seed: 15 }, sides: SIDE(118, 12, 2), acc: [['glasses', { col: '#b89b52', tint: 'rgba(30,20,20,.6)' }], ['scar']] },
  { id: 'reika', name: 'レイカ', note: 'おとな', hair: '#8a1f3d', iris: '#c9793a', bg: '#6b2a3f', eyeShape: 'sharp', tilt: 2, lowerLash: true, lashes: true, mouth: 'smile', outfit: 'qipao', cloth: '#1c1c26', accent: '#e8c56b', long: 200, blush: false,
    back: 'long', fringe: { n: 6, y: 102, w: 30, bend: 8, sweep: 14, part: .5, drop: 2, jag: 4, seed: 16 }, sides: [[142, 70, 150, 176, 16, 8], [58, 72, 58, 150, 13, -3]], acc: [['mole', { x: 112, y: 131 }], ['earring', { col: '#e8c56b', x: 141, y: 122 }]] },
  { id: 'neko', name: 'ネコ', note: 'いたずら', hair: '#34303d', iris: '#f0b82a', bg: '#ff9ec4', mouth: 'cat', outfit: 'hoodie', cloth: '#ffe28a', accent: '#fff', sparkle: true, lowerLash: true, lashes: true,
    back: 'bob', fringe: { n: 7, y: 98, w: 24, bend: 6, jag: 8, seed: 17 }, sides: SIDE(140, 14, 3), acc: [['catEars'], ['fang']] }
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = path.join(process.cwd(), 'public', 'avatars');
  fs.mkdirSync(dir, { recursive: true });
  for (const c of CHARS) fs.writeFileSync(path.join(dir, c.id + '.svg'), portrait(c));
  console.log('wrote', CHARS.length, 'avatars to', dir);
}
export { portrait };
