
import MJ from '../engine.js';
const {tt,isRed,tileName,doraOf,countsOf,shanten,Game,AI} = MJ;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let stage = null;

/* ---------- 画面サイズ ---------- */
function fit(){
  const vw = innerWidth, vh = innerHeight;
  const portrait = vh > vw * 1.05;
  const W = portrait ? vh : vw, H = portrait ? vw : vh;
  let s = H / 900, lw = W / s;
  if (lw < 1600){ s = W / 1600; lw = 1600; }
  if (lw > 2200) lw = 2200;
  stage.style.width = lw + 'px';
  stage.style.transform = `translate(-50%,-50%) ${portrait ? 'rotate(90deg) ' : ''}scale(${s})`;
  document.documentElement.style.setProperty('--htw', Math.max(70, Math.min(128, (lw - 90) / 15)) + 'px');
}


/* ---------- 保存（この端末だけ） ---------- */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v ? Object.assign(JSON.parse(JSON.stringify(d)), JSON.parse(v)) : JSON.parse(JSON.stringify(d)); }catch(e){ return JSON.parse(JSON.stringify(d)); } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
};
const SKEY = 'miuchitaku.v2.settings', PKEY = 'miuchitaku.v2.profile';
const DEF = {
  you:{name:'あなた', photo:null},
  friends:[{name:'たけし',style:'attack',photo:null},{name:'ゆうこ',style:'balance',photo:null},{name:'まさ',style:'defense',photo:null}],
  length:'tonpuu', aka:true, kuitan:true, yakitori:false, wareme:false,
  hint:true, danger:true, voice:true, sound:true, timer:false, speed:'normal',
  batsu:'次の飲み会で乾杯の音頭をとる', felt:'jade', back:'amber'
};
const PDEF = { lv:0, rp:0, games:0, ranks:[0,0,0,0], hands:0, wins:0, dealIns:0, riichis:0, best:null, ach:{}, sumRank:0, maxScore:0 };
let S = store.get(SKEY, DEF);
if (!Array.isArray(S.friends) || S.friends.length !== 3) S.friends = JSON.parse(JSON.stringify(DEF.friends));
if (!S.you || typeof S.you !== 'object') S.you = {name:'あなた', photo:null};
let PR = store.get(PKEY, PDEF);
const saveS = () => { if (!store.set(SKEY, S)){ const bak = [S.you.photo, ...S.friends.map(f => f.photo)]; S.you.photo = null; S.friends.forEach(f => f.photo = null); store.set(SKEY, S); S.you.photo = bak[0]; S.friends.forEach((f,i) => f.photo = bak[i+1]); } };
const STYLE = {attack:'攻撃型', balance:'バランス型', defense:'守備型'};
const SEATCOL = [['#f2cf73','#9a6d17'],['#5ab8f0','#1b5796'],['#f27a9a','#9b2445'],['#8fd06a','#3d7a1f']];

const FELTS = { jade:['翡翠','#1f6b58','#0d3a31'], navy:['紺碧','#1f4f7a','#0c2340'], wine:['臙脂','#74263a','#330c18'], ink:['漆黒','#30363d','#101316'] };
const BACKS = { amber:['琥珀','#f0a045','#c46a1c'], azure:['瑠璃','#4f8fe0','#1f4f9c'], jade:['若竹','#4cc08a','#1d7a52'], sakura:['桜','#f5a3bb','#c95577'] };
function applyTheme(){
  const r = document.documentElement.style, f = FELTS[S.felt] || FELTS.jade, b = BACKS[S.back] || BACKS.amber;
  r.setProperty('--felt1', f[1]); r.setProperty('--felt2', f[2]);
  r.setProperty('--back', b[1]); r.setProperty('--back-d', b[2]);
}
applyTheme();

/* ---------- 段位 ---------- */
const TIERS = [['初心','#b98252','#6b4222'],['雀士','#c9d3d8','#6c7a82'],['雀傑','#f2cf73','#9a6d17'],['雀豪','#5fd6a4','#1d7a52'],['雀聖','#b48cff','#5a2aa3']];
const rankName = lv => lv >= 15 ? '魂天' : TIERS[Math.floor(lv/3)][0] + ['一','二','三'][lv%3];
const need = lv => 100 + lv * 40;
const rpGain = (rank, len, sanma) => sanma ? (len === 'hanchan' ? [90,5,-50] : [50,0,-30])[rank] : (len === 'hanchan' ? [90,35,-15,-50] : [50,20,-10,-30])[rank];
function emblem(lv){
  const t = lv >= 15 ? ['魂天','#ffb3e6','#6a3cc9'] : TIERS[Math.floor(lv/3)];
  const star = lv >= 15 ? '' : '★'.repeat(lv%3 + 1);
  return `<div class="emblem"><svg viewBox="0 0 112 124" aria-hidden="true"><defs><linearGradient id="eg${lv}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".25" stop-color="${t[1]}"/><stop offset="1" stop-color="${t[2]}"/></linearGradient></defs>
    <path d="M56 4 L106 30 L106 90 L56 120 L6 90 L6 30 Z" fill="url(#eg${lv})" stroke="#fff" stroke-opacity=".7" stroke-width="3"/>
    <path d="M56 16 L95 36 L95 84 L56 107 L17 84 L17 36 Z" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/></svg>
    <b>${lv >= 15 ? '魂' : t[0].charAt(1)}</b><small>${lv >= 15 ? '天' : star}</small></div>`;
}

/* ---------- 称号 ---------- */
const ACH = [
  ['first','初アガリ','1回和了する'],['ippatsu','一発屋','一発で和了する'],['mangan','満貫','満貫以上で和了'],
  ['haneman','跳満','跳満以上で和了'],['baiman','倍満','倍満以上で和了'],['yakuman','役満','役満を和了する'],
  ['ura3','裏の支配者','裏ドラ3枚以上'],['tobi','飛ばし屋','誰かを飛ばす'],['top','初トップ','1位で終局'],
  ['nodealin','鉄壁','放銃ゼロで終局'],['chiitoi','ニコニコ','七対子で和了'],['renchan','親っかぶり知らず','親で3本場まで連荘']
];

/* ---------- 牌の描画 ---------- */
const gcls = (id, forceType) => {
  const t = forceType !== undefined ? forceType : tt(id);
  return 'g' + t + (forceType === undefined && S.aka && isRed(id) ? 'r' : '');
};
function t2(id, o){
  o = o || {};
  const cls = ['t2', o.flat?'flat':'', o.side?'side':'', o.back?'bk':'', o.cls||''].join(' ');
  const st = o.tw ? ` style="--tw:${o.tw}px"` : '';
  if (o.back) return `<div class="${cls}"${st}><div class="fc"></div></div>`;
  return `<div class="${cls}"${st} title="${tileName(tt(id))}"><div class="cap"></div><div class="fc"><div class="gl ${o.type!==undefined?gcls(0,o.type):gcls(id)}"></div></div></div>`;
}
const t2t = (t, o) => t2(t*4+3, Object.assign({}, o, {type:t}));
function ft(id, o){
  o = o || {};
  const cls = ['ft', o.side?'side':'', o.cls||'', o.faceDown?'bkup':''].join(' ');
  return `<div class="${cls}"><i class="b"></i><i class="m"></i><i class="s"></i><i class="f">${o.faceDown?'':`<span class="gl ${gcls(id)}"></span>`}</i></div>`;
}
function stt(){ return `<div class="st"><i class="k"></i><i class="tp"></i><i class="f"></i></div>`; }

/* ---------- アバター ---------- */
function avatar(p, seat){
  const col = SEATCOL[seat] || SEATCOL[0];
  if (p && p.photo) return `<div class="av" style="background:#222"><img src="${p.photo}" alt=""></div>`;
  const ch = (p && p.name || '？').trim().charAt(0) || '？';
  return `<div class="av" style="background:radial-gradient(circle at 35% 30%,${col[0]},${col[1]})">${esc(ch)}</div>`;
}
const memberOf = seat => UI.online ? onlineMember(seat) : (seat === 0 ? S.you : S.friends[seat-1]);

/* ---------- 音 ---------- */
let AC = null;
const audio = () => { if (!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if (AC && AC.state === 'suspended') AC.resume(); return AC; };
function noise(ac, dur, freq, q, gain, when){
  const b = ac.createBuffer(1, Math.max(1, ac.sampleRate*dur|0), ac.sampleRate), d = b.getChannelData(0);
  for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length, 5);
  const s = ac.createBufferSource(); s.buffer = b;
  const f = ac.createBiquadFilter(); f.type='bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(ac.destination); s.start(when||ac.currentTime);
}
function tone(ac, freq, t0, dur, type, vol){
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type||'sine'; o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol||.2, t0+.01); g.gain.exponentialRampToValueAtTime(.0008, t0+dur);
  o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0+dur+.05);
}
const SFX = {
  clack(){ if (!S.sound) return; const ac = audio(); if (!ac) return; const n = ac.currentTime;
    noise(ac,.05,2600,3,.7,n); tone(ac,210,n,.08,'sine',.25); noise(ac,.03,4200,4,.25,n+.012); },
  call(){ if (!S.sound) return; const ac = audio(); if (!ac) return; const n = ac.currentTime;
    tone(ac,330,n,.18,'triangle',.18); tone(ac,494,n+.06,.25,'triangle',.18); },
  riichi(){ if (!S.sound) return; const ac = audio(); if (!ac) return; const n = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(180,n); o.frequency.exponentialRampToValueAtTime(900,n+.35);
    g.gain.setValueAtTime(.12,n); g.gain.exponentialRampToValueAtTime(.001,n+.5); o.connect(g); g.connect(ac.destination); o.start(n); o.stop(n+.55);
    tone(ac,1320,n+.3,.6,'sine',.12); noise(ac,.25,6000,1,.2,n+.28); },
  win(ym){ if (!S.sound) return; const ac = audio(); if (!ac) return; const n = ac.currentTime;
    noise(ac,.4,120,.7,.9,n); tone(ac,65,n,.6,'sine',.5);
    const ch = ym ? [0,4,7,11,14,19,24] : [0,4,7,12,16];
    ch.forEach((st,i) => { tone(ac, 392*Math.pow(2,st/12), n+.15+i*.08, 1.2, 'triangle', .12); tone(ac, 392*Math.pow(2,st/12)*2, n+.15+i*.08, .8, 'sine', .05); }); },
  draw(){ if (!S.sound) return; const ac = audio(); if (!ac) return; const n = ac.currentTime;
    tone(ac,392,n,.5,'triangle',.14); tone(ac,311,n+.2,.8,'triangle',.14); },
  tick(){ if (!S.sound) return; const ac = audio(); if (!ac) return; tone(ac,1200,ac.currentTime,.05,'square',.04); },
  pop(){ if (!S.sound) return; const ac = audio(); if (!ac) return; const n = ac.currentTime; tone(ac,700,n,.08,'sine',.15); tone(ac,1050,n+.04,.1,'sine',.1); }
};
const PITCH = [1.05,.75,1.5,1.2];
function voice(text, seat){
  if (!S.voice || !('speechSynthesis' in window)) return;
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 1.1; u.pitch = PITCH[seat] || 1; u.volume = 1;
    const v = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('ja'));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------- 状態 ---------- */
const UI = { g:null, gen:0, pend:null, riichiMode:false, chiPick:false, sel:null, auto:{win:false,nocall:false,tsumo:false}, bubbles:{}, stamps:false, timer:null, newAch:[], ak:null, an:null, animDiscard:null, animStick:null, lastHandSize:0, quitArm:false, renchanRun:0, menu:null };

function toast(msg){ const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; stage.appendChild(el); setTimeout(() => el.remove(), 2700); }

/* ============ ロビー ============ */
let bgAnim = null;
function renderPracticeLobbyUnused(){
  const lv = PR.lv, nd = need(lv), pct = lv >= 15 ? 100 : Math.max(0, Math.min(100, PR.rp / nd * 100));
  const g = PR.games;
  const deco = [0*4, 13*4, 22*4, 31*4+1, 33*4+1].map(id => t2(id)).join('');
  $('#lobby').innerHTML = `
    <div class="lb-bg"><canvas id="dust" width="1600" height="900"></canvas><div class="lb-table"></div><div class="lb-tiles">${[4*4+0,5*4,6*4,13*4+1,13*4+2,13*4+3,27*4,27*4+1].map(id=>t2(id)).join('')}</div></div>
    <div class="logo"><h1>麻雀横丁</h1><div class="en">MAHJONG YOKOCHO</div></div>
    <div class="profile">
      ${emblem(lv)}
      <div>
        <div class="pf-name">${esc(S.you.name)}</div>
        <div class="pf-rank">${esc(rankName(lv))}</div>
        <div class="rbar"><i style="width:${pct}%"></i></div>
        <div class="pf-sub">${lv >= 15 ? '最高段位' : `昇段まで ${Math.max(0, nd - PR.rp)}pt`}</div>
      </div>
      <div class="pf-stats">
        <div><b>${g}</b><span>対局</span></div>
        <div><b>${g ? (PR.sumRank/g).toFixed(2) : '-'}</b><span>平均順位</span></div>
        <div><b>${g ? Math.round(PR.ranks[0]/g*100)+'%' : '-'}</b><span>トップ率</span></div>
        <div><b>${PR.hands ? Math.round(PR.wins/PR.hands*100)+'%' : '-'}</b><span>和了率</span></div>
      </div>
    </div>
    <div class="menu">
      <button class="mb-start" id="go" type="button"><div class="t">対局開始</div><div class="s">${esc(S.friends.map(f => f.name).join('・'))} と卓を囲む</div><div class="tl">${deco}</div></button>
      <div class="modepick" id="mode">
        <button type="button" data-v="tonpuu" class="${S.length==='tonpuu'?'on':''}">東風戦<small>サクッと約10分</small></button>
        <button type="button" data-v="hanchan" class="${S.length==='hanchan'?'on':''}">半荘戦<small>じっくり約25分</small></button>
      </div>
      <div class="subs">
        <button class="mb" type="button" data-p="member"><b>メンバー</b><span>名前・写真・打ち筋</span></button>
        <button class="mb" type="button" data-p="rule"><b>身内ルール</b><span>赤・喰いタン・焼き鳥 ほか</span></button>
        <button class="mb" type="button" data-p="skin"><b>着せ替え</b><span>卓と牌の色</span></button>
        <button class="mb" type="button" data-p="record"><b>戦績・称号</b><span>${Object.keys(PR.ach).length} / ${ACH.length} 獲得</span></button>
      </div>
    </div>
    <div class="lb-foot">いまはメンバーの名前でCPUが代打ちします</div>`;
  $('#go').addEventListener('click', () => { audio(); try{ speechSynthesis.getVoices(); }catch(e){} startGame(); });
  $$('#mode button').forEach(b => b.addEventListener('click', () => { S.length = b.dataset.v; saveS(); SFX.pop(); renderLobby(); }));
  $$('.mb').forEach(b => b.addEventListener('click', () => { SFX.pop(); openPanel(b.dataset.p); }));
  dust();
}
function dust(){
  const c = $('#dust'); if (!c) return;
  const ctx = c.getContext('2d');
  const P = Array.from({length:70}, () => ({x:Math.random()*1600, y:Math.random()*900, r:Math.random()*2+.5, v:Math.random()*.3+.08, a:Math.random()*Math.PI*2}));
  cancelAnimationFrame(bgAnim);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = () => {
    if ($('#lobby').hidden || !$('#dust')) return;
    ctx.clearRect(0,0,1600,900);
    const gr = ctx.createRadialGradient(1150,380,40,1150,380,700);
    gr.addColorStop(0,'rgba(255,220,150,.16)'); gr.addColorStop(1,'rgba(255,220,150,0)');
    ctx.fillStyle = gr; ctx.fillRect(0,0,1600,900);
    for (const p of P){
      p.y -= p.v; p.a += .01; if (p.y < -5){ p.y = 905; p.x = Math.random()*1600; }
      ctx.beginPath(); ctx.arc(p.x + Math.sin(p.a)*8, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,226,160,${.25 + .25*Math.sin(p.a*2)})`; ctx.fill();
    }
    if (!reduce) bgAnim = requestAnimationFrame(step);
  };
  step();
}

/* ---------- 設定パネル ---------- */
let photoTarget = null;
function openPanel(kind){
  const L = $('#layer');
  let body = '';
  const opt = (k, label, sub) => `<label class="opt"><input type="checkbox" id="o-${k}" data-k="${k}" ${S[k]?'checked':''}><span class="sw"></span><span>${label}${sub?`<small>${sub}</small>`:''}</span></label>`;
  if (kind === 'member'){
    const rows = [S.you, ...S.friends].map((m,i) => `<div class="mrow">
      <button class="phbtn" type="button" data-ph="${i}" aria-label="写真を選ぶ"><div style="width:84px;height:84px">${avatar(m,i).replace('class="av"','class="av" style="width:84px;height:84px;font-size:40px"')}</div><span class="cam">写真</span></button>
      <div><div class="who">${i===0?'あなた':'メンバー'+i}</div><input class="inp" type="text" id="mn-${i}" maxlength="8" value="${esc(m.name)}"></div>
      ${i===0?'<div class="who">写真をタップで顔写真を登録</div>':`<select class="inp" id="ms-${i}">${Object.entries(STYLE).map(([k,v]) => `<option value="${k}" ${m.style===k?'selected':''}>${v}</option>`).join('')}</select>`}
    </div>`).join('');
    body = `<h2>メンバー<button class="x" type="button">閉じる</button></h2>${rows}`;
  } else if (kind === 'rule'){
    body = `<h2>身内ルール<button class="x" type="button">閉じる</button></h2>
      <h3>ルール</h3><div class="opts">${opt('aka','赤ドラ','5萬・5筒・5索に1枚ずつ')}${opt('kuitan','喰いタン','鳴いても断么九あり')}${opt('yakitori','焼き鳥','和了なしで −10pt')}${opt('wareme','割れ目','毎局サイコロで決まる人の支払い・受取が倍')}${opt('timer','持ち時間','打牌15秒・鳴き8秒')}</div>
      <h3>アシスト・演出</h3><div class="opts">${opt('hint','牌効率ヒント','受入枚数と最善打を表示')}${opt('danger','危険牌表示','リーチ者に対する安全度')}${opt('voice','ボイス','リーチ・ロン・ポンを読み上げ')}${opt('sound','効果音','打牌音・和了音')}
        <label class="opt" style="cursor:default"><span>CPUの速さ</span><select class="inp" id="o-speed" style="margin-left:auto;width:150px;height:44px"><option value="slow" ${S.speed==='slow'?'selected':''}>ゆっくり</option><option value="normal" ${S.speed==='normal'?'selected':''}>ふつう</option><option value="fast" ${S.speed==='fast'?'selected':''}>速い</option></select></label></div>
      <h3>ラスの罰ゲーム</h3><input class="inp" type="text" id="o-batsu" maxlength="40" value="${esc(S.batsu)}">
      <div class="pf-sub" style="margin-top:18px">精算はMリーグ方式（25000点持ち・30000点返し・ウマ10-30・オカ+20）</div>`;
  } else if (kind === 'skin'){
    body = `<h2>着せ替え<button class="x" type="button">閉じる</button></h2>
      <h3>卓</h3><div class="swatches">${Object.entries(FELTS).map(([k,v]) => `<button type="button" class="swatch ${S.felt===k?'on':''}" data-felt="${k}"><div class="fp" style="background:radial-gradient(circle,${v[1]},${v[2]});box-shadow:inset 0 0 0 5px #3b2414"></div><span>${v[0]}</span></button>`).join('')}</div>
      <h3>牌の背</h3><div class="swatches">${Object.entries(BACKS).map(([k,v]) => `<button type="button" class="swatch ${S.back===k?'on':''}" data-back="${k}"><div class="fp" style="display:flex;gap:6px;justify-content:center;align-items:center;background:rgba(0,0,0,.25);--back:${v[1]};--back-d:${v[2]}">${t2(4*4+1,{tw:34})}${t2(0,{tw:34,back:true})}</div><span>${v[0]}</span></button>`).join('')}</div>`;
  } else if (kind === 'record'){
    const g = PR.games;
    const dist = PR.ranks.map((n,i) => `<i style="width:${g?n/g*100:25}%;background:${['#f2cf73','#c9d3d8','#d9a077','#5c6468'][i]}"></i>`).join('');
    body = `<h2>戦績・称号<button class="x" type="button">閉じる</button></h2>
      <div class="statgrid">
        <div><b>${g}</b><span>対局数</span></div>
        <div><b>${g?(PR.sumRank/g).toFixed(2):'-'}</b><span>平均順位</span></div>
        <div><b>${PR.hands?Math.round(PR.wins/PR.hands*100)+'%':'-'}</b><span>和了率</span></div>
        <div><b>${PR.hands?Math.round(PR.dealIns/PR.hands*100)+'%':'-'}</b><span>放銃率</span></div>
        <div><b>${PR.hands?Math.round(PR.riichis/PR.hands*100)+'%':'-'}</b><span>立直率</span></div>
      </div>
      <div class="rankdist">${dist}</div>
      <div class="pf-sub">1位 ${PR.ranks[0]} ／ 2位 ${PR.ranks[1]} ／ 3位 ${PR.ranks[2]} ／ 4位 ${PR.ranks[3]}　　最高打点：${PR.best?esc(`${PR.best.limit||''} ${PR.best.total}点（${PR.best.yaku}）`):'まだなし'}</div>
      <h3>称号</h3><div class="ach-grid">${ACH.map(([k,n,d]) => `<div class="achc ${PR.ach[k]?'on':''}"><b>${n}</b><span>${d}</span></div>`).join('')}</div>`;
  }
  L.innerHTML = `<div class="sheet-bg"><div class="sheet">${body}</div></div>`;
  const close = () => { collect(kind); L.innerHTML = ''; renderLobby(); };
  $('.x', L).addEventListener('click', close);
  $('.sheet-bg', L).addEventListener('click', e => { if (e.target.classList.contains('sheet-bg')) close(); });
  $$('input[type=checkbox]', L).forEach(el => el.addEventListener('change', () => { S[el.dataset.k] = el.checked; saveS(); SFX.pop(); }));
  $$('[data-ph]', L).forEach(b => b.addEventListener('click', () => { collect(kind); photoTarget = +b.dataset.ph; $('#photo').value = ''; $('#photo').click(); }));
  $$('[data-felt]', L).forEach(b => b.addEventListener('click', () => { S.felt = b.dataset.felt; saveS(); applyTheme(); openPanel('skin'); }));
  $$('[data-back]', L).forEach(b => b.addEventListener('click', () => { S.back = b.dataset.back; saveS(); applyTheme(); openPanel('skin'); }));
}
function collect(kind){
  const v = id => { const el = $(id); return el ? el.value.trim() : null; };
  if (kind === 'member'){
    const n0 = v('#mn-0'); if (n0 !== null) S.you.name = n0 || 'あなた';
    S.friends.forEach((f,i) => { const n = v('#mn-'+(i+1)); if (n !== null) f.name = n || DEF.friends[i].name; const st = v('#ms-'+(i+1)); if (st) f.style = st; });
  }
  if (kind === 'rule'){ const b = v('#o-batsu'); if (b !== null) S.batsu = b; const sp = v('#o-speed'); if (sp) S.speed = sp; }
  saveS();
}
function initPhoto(){ $('#photo').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0]; if (!f || photoTarget === null) return;
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 160;
      const s = Math.min(img.width, img.height), ctx = c.getContext('2d');
      ctx.drawImage(img, (img.width-s)/2, (img.height-s)/2, s, s, 0, 0, 160, 160);
      const url = c.toDataURL('image/jpeg', .82);
      onPhoto(url);
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}); }

/* ============ 対局 ============ */
function startGame(){
  onlineStop(); UI.online = null;
  UI.gen++;
  const gen = UI.gen;
  Object.assign(UI, { pend:null, riichiMode:false, chiPick:false, sel:null, bubbles:{}, stamps:false, newAch:[], ak:null, an:null, renchanRun:0, menu:null });
  const speed = {slow:1.5, normal:1, fast:.45}[S.speed] || 1;
  const players = [{name:S.you.name, human:true}].concat(S.friends.slice(0, S.sanma ? 2 : 3).map(f => ({name:f.name, style:f.style})));
  const g = new Game({
    rules:{ length:S.length, aka:S.aka, kuitan:S.kuitan, yakitori:S.yakitori, wareme:S.wareme, sanma:!!S.sanma },
    players,
    hooks:{
      emit:(type,d) => { if (gen === UI.gen) onEvent(type,d); },
      wait:(ms) => gen === UI.gen ? sleep(ms*speed) : new Promise(()=>{}),
      handEnd:(g,r) => gen === UI.gen ? showHandResult(g,r) : new Promise(()=>{}),
      human:{
        self:(g,o) => gen === UI.gen ? humanSelf(g,o) : new Promise(()=>{}),
        react:(g,o) => gen === UI.gen ? humanReact(g,o) : new Promise(()=>{})
      }
    }
  });
  UI.g = g;
  cancelAnimationFrame(bgAnim);
  $('#lobby').hidden = true; $('#game').hidden = false; $('#layer').innerHTML = '';
  buildGame();
  g.run().catch(e => { console.error(e); toast('エラーが起きました: ' + e.message); });
  setTimeout(() => bubble(1 + Math.floor(Math.random()*3), 'よろしく〜'), 900);
}
function buildGame(){
  $('#game').innerHTML = `
    <div class="scene"><div class="plane" id="plane"></div></div>
    <div class="hud roundhud" id="rhud"></div>
    <div class="hud topbtns"><button class="ib" type="button" id="b-auto">オート</button><button class="ib" type="button" id="b-stamp">スタンプ</button><button class="ib" type="button" id="b-snd">音</button><button class="ib" type="button" id="b-fs" hidden>全画面</button><button class="ib" type="button" id="b-quit">ロビーへ</button></div>
    <div id="pps"></div>
    <div class="info" id="info"></div>
    <div class="tmr" id="tmr" hidden></div>
    <div class="acts" id="acts"></div>
    <div class="me" id="me"></div>
    <div class="tools" id="tools"></div>
    <div id="stp"></div>
    <div class="fx" id="fx"></div>`;
  $('#b-quit').addEventListener('click', () => {
    const b = $('#b-quit');
    if (!UI.quitArm){ UI.quitArm = true; b.classList.add('arm'); b.textContent = '本当に中断する'; setTimeout(() => { UI.quitArm = false; if ($('#b-quit')){ $('#b-quit').classList.remove('arm'); $('#b-quit').textContent = 'ロビーへ'; } }, 2600); return; }
    UI.quitArm = false; toLobby();
  });
  const snd = () => { const b = $('#b-snd'); b.classList.toggle('on', S.sound); b.textContent = S.sound ? '音 ON' : '音 OFF'; };
  $('#b-snd').addEventListener('click', () => { S.sound = !S.sound; S.voice = S.sound; saveS(); snd(); });
  snd();
  $('#b-auto').addEventListener('click', () => { UI.menu = UI.menu === 'auto' ? null : 'auto'; SFX.pop(); renderTools(); });
  $('#b-stamp').addEventListener('click', () => { UI.menu = UI.menu === 'stamp' ? null : 'stamp'; SFX.pop(); renderTools(); });
  const fsb = $('#b-fs');
  if (document.fullscreenEnabled && document.documentElement.requestFullscreen){
    fsb.hidden = false;
    fsb.addEventListener('click', () => { try{ if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { fsb.hidden = true; }); }catch(e){ fsb.hidden = true; } });
  }
  renderTools();
}
function toLobby(){
  UI.gen++; UI.g = null; clearTimer(); onlineStop();
  $('#layer').innerHTML = ''; $('#game').hidden = true; $('#lobby').hidden = false; renderLobby();
}

/* ---------- イベント ---------- */
function onEvent(type, d){
  const g = UI.g; if (!g) return;
  if (type === 'log') return;
  if (type === 'discard'){
    UI.animDiscard = d.id;
    SFX.clack();
    if (d.riichi){ fxRiichi(g.P[d.seat].name, d.seat); voice('リーチ', d.seat); chatter('riichi', d.seat); }
  }
  if (type === 'riichi-stick') UI.animStick = d.seat;
  if (type === 'call'){ fxCall(d.seat, d.label, d.kind); voice(d.label, d.seat); SFX.call(); }
  if (type === 'win'){
    const r = d.result;
    fxWin(r.tsumo ? 'ツモ' : 'ロン', g.P[r.winner].name, r.res.yakuman > 0);
    voice(r.tsumo ? 'ツモ' : 'ロン', r.winner); SFX.win(r.res.yakuman > 0);
    chatter('win', r.winner, r.from);
  }
  if (type === 'ryuukyoku'){ fxDraw(d.result.reason); SFX.draw(); }
  if (type === 'end'){ showFinal(g, d); return; }
  render();
}

/* ---------- 人間 ---------- */
function humanSelf(g, o){
  return new Promise(res => {
    const done = v => { clearTimer(); UI.pend = null; UI.riichiMode = false; UI.sel = null; res(v); render(); };
    if (o.canTsumo && UI.auto.win) return setTimeout(() => done({type:'tsumo'}), 350);
    if (o.locked && !o.canTsumo && !o.kita) return setTimeout(() => done({type:'discard', id:o.drawn}), 650);
    if (UI.auto.tsumo && o.drawn !== null && !o.canTsumo && !o.riichiIds.length && !o.ankan.length && !o.kakan.length)
      return setTimeout(() => done({type:'discard', id:o.drawn}), 450);
    UI.pend = { kind:'self', o, done };
    UI.ak = null;
    startTimer(15, () => {
      const id = o.drawn !== null ? o.drawn : g.h.hands[0].filter(x => !o.forbid.includes(tt(x))).pop();
      done({type:'discard', id});
    });
    render();
  });
}
function humanReact(g, o){
  if (o.ron && UI.auto.win) return Promise.resolve({type:'ron'});
  if (!o.ron && UI.auto.nocall) return Promise.resolve({type:'pass'});
  return new Promise(res => {
    const done = v => { clearTimer(); UI.pend = null; UI.chiPick = false; res(v); render(); };
    UI.pend = { kind:'react', o, done };
    startTimer(8, () => done({type:'pass'}));
    render();
  });
}
function startTimer(sec, onEnd){
  clearTimer();
  if (!S.timer) return;
  const end = Date.now() + sec*1000, el = $('#tmr');
  el.hidden = false;
  const tick = () => {
    const left = (end - Date.now())/1000;
    const frac = Math.max(0, left / sec);
    el.innerHTML = `<svg viewBox="0 0 68 68"><circle cx="34" cy="34" r="30" fill="rgba(0,0,0,.6)" stroke="rgba(255,255,255,.12)" stroke-width="5"/><circle cx="34" cy="34" r="30" fill="none" stroke="${left<4?'#e8453a':'#f2cf73'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${188.5*frac} 999"/></svg><b>${Math.max(0,Math.ceil(left))}</b>`;
    if (left <= 0){ clearTimer(); onEnd(); }
  };
  tick(); UI.timer = setInterval(tick, 200);
}
function clearTimer(){ if (UI.timer) clearInterval(UI.timer); UI.timer = null; const el = $('#tmr'); if (el){ el.hidden = true; el.innerHTML = ''; } }
function canClick(id){
  const p = UI.pend; if (!p || p.kind !== 'self') return false;
  const o = p.o;
  if (o.locked) return id === o.drawn;
  if (UI.riichiMode) return o.riichiIds.includes(id);
  return !o.forbid.includes(tt(id));
}
let lastPointer = null;
addEventListener('pointerdown', e => { lastPointer = e.pointerType; }, true);
const isTouch = () => lastPointer === 'touch' || lastPointer === 'pen' || (lastPointer === null && matchMedia('(hover: none), (pointer: coarse)').matches);
function clickTile(id, ev){
  if (!canClick(id)) return;
  if (isTouch() && UI.sel !== id){ UI.sel = id; SFX.tick(); renderMe(UI.g, UI.g.h); return; }
  UI.pend.done({type:'discard', id, riichi: UI.riichiMode});
}

/* ---------- 演出 ---------- */
function fx(html, ms){ const el = document.createElement('div'); el.innerHTML = html; const f = $('#fx'); if (!f) return; const node = el.firstElementChild; f.appendChild(node); setTimeout(() => node.remove(), ms); }
function fxRiichi(name){
  SFX.riichi();
  fx(`<div class="flash"></div>`, 400);
  fx(`<div class="band riichi"><div class="speed"></div><b>リーチ</b><span>${esc(name)}</span></div>`, 1200);
}
const CALLXY = [[800,600],[1120,400],[800,210],[480,400]];
function fxCall(seat, label, kind){
  const [x,y] = CALLXY[posOf(seat)];
  fx(`<div class="callw ${kind}" style="left:${x}px;top:${y}px">${esc(label)}</div>`, 850);
}
function fxWin(word, name, ym){
  fx(`<div class="flash"></div>`, 400);
  fx(`<div class="winfx ${ym?'ym':''}"><div class="rays"></div><div class="winword"><b>${esc(word)}</b><span>${esc(name)}</span></div></div>`, 1500);
}
function fxDraw(reason){
  fx(`<div class="winfx"><div class="winword"><b style="font-size:220px;background:linear-gradient(180deg,#e8f4ff,#8fb6d6);-webkit-background-clip:text;background-clip:text">流局</b><span>${esc(reason)}</span></div></div>`, 1300);
}
function bubble(seat, text){
  UI.bubbles[seat] = text; renderPlates(UI.g);
  setTimeout(() => { if (UI.bubbles[seat] === text){ delete UI.bubbles[seat]; renderPlates(UI.g); } }, 2200);
}
const CHAT = { riichi:['こわっ','押すで','ベタオリ…','まだ早いって','受けて立つ'], winSelf:['いただき','ありがと〜','見えてた','ごっつぁん'], dealIn:['えぇ…','高っ！','それかー','読めんて'] };
const KN='一二三四';
const rl = g => MJ.WIND[g.round] + KN[g.kyoku] + '局';
const pick = a => a[Math.floor(Math.random()*a.length)];
// 自動のひとことはCPUの席だけ。オンラインで本物の人のセリフを勝手に出さない
const isCpuSeat = rs => rs !== 0 && (!UI.online || !!(UI.online.seatsRel && UI.online.seatsRel[rs] && UI.online.seatsRel[rs].cpu));
function chatter(kind, seat, from){
  const n = UI.g && UI.g.P ? UI.g.P.length : 4;
  if (kind === 'riichi' && Math.random() < .35){
    const cand = [...Array(n).keys()].filter(x => x !== seat && isCpuSeat(x));
    if (cand.length){ const q = pick(cand); setTimeout(() => bubble(q, pick(CHAT.riichi)), 700); }
  }
  if (kind === 'win'){
    if (isCpuSeat(seat) && Math.random() < .6) setTimeout(() => bubble(seat, pick(CHAT.winSelf)), 1600);
    if (from !== null && from !== undefined && isCpuSeat(from) && Math.random() < .6) setTimeout(() => bubble(from, pick(CHAT.dealIn)), 1900);
  }
}

/* ---------- 描画 ---------- */
function render(){
  const g = UI.g; if (!g || !g.h || !$('#plane')) return;
  const H = g.h;
  renderPlane(g, H); renderHud(g, H); renderPlates(g); renderMe(g, H); renderActs(g, H);
  UI.animDiscard = null; UI.animStick = null;
}
const ROT = [0, -90, 180, 90];
const NS = g => (g && g.P ? g.P.length : 4);
// 画面上の位置（0=自分 1=右 2=上 3=左）。3人打ちは上家を左に置く
const posOf = (p, g) => (NS(g || UI.g) === 3 && p === 2) ? 3 : p;
function pondHTML(g, H, p){
  const rv = H.river[p];
  // 鳴かれた牌は河から消す。リーチ宣言牌が鳴かれたら次の牌を横向きにする
  const vis = [];
  let wantSide = false;
  rv.forEach((d,i) => {
    if (d.riichi) wantSide = true;
    if (d.called) return;
    vis.push({d, i, side: wantSide});
    wantSide = false;
  });
  const lastI = H.lastDiscard && H.lastDiscard.seat === p && H.active ? rv.length-1 : -1;
  const rows = [];
  for (let k = 0; k < vis.length && rows.length < 3; k += 6){
    const chunk = vis.slice(k, rows.length === 2 ? vis.length : k + 6);
    rows.push(chunk.map(v => {
      const cls = [v.d.tsumogiri?'tg':'', v.i===lastI?'last':'', v.d.id===UI.animDiscard&&v.i===rv.length-1?'drop':''].join(' ');
      return ft(v.d.id, {side: v.side, cls});
    }).join(''));
  }
  return rows.map(r => `<div class="prow">${r}</div>`).join('');
}
function meld3(m){
  if (m.type === 'ankan') return `<div class="meld3">${m.tiles.map((id,i) => ft(id, {faceDown: i===0||i===3})).join('')}</div>`;
  const called = m.calledId, others = m.tiles.filter(x => x !== called && x !== m.addedId);
  const order = m.from === 3 ? [called, ...others] : m.from === 2 ? [others[0], called, ...others.slice(1)] : [...others, called];
  return `<div class="meld3">${order.map(id => ft(id, {side: id===called})).join('')}${m.addedId!==undefined?ft(m.addedId,{side:true}):''}</div>`;
}
function meld2(m){
  if (m.type === 'ankan') return `<div class="meld">${m.tiles.map((id,i) => t2(id, {flat:true, back: i===0||i===3})).join('')}</div>`;
  const called = m.calledId, others = m.tiles.filter(x => x !== called && x !== m.addedId);
  const order = m.from === 3 ? [called, ...others] : m.from === 2 ? [others[0], called, ...others.slice(1)] : [...others, called];
  return `<div class="meld">${order.map(id => t2(id, {flat:true, side: id===called})).join('')}${m.addedId!==undefined?t2(m.addedId,{flat:true,side:true}):''}</div>`;
}
function renderPlane(g, H){
  let html = `<div class="rim"></div><div class="felt"></div>`;
  let cp = '';
  const N = NS(g);
  for (let p = 0; p < N; p++){
    const on = H.turn === p && H.active;
    cp += `<div class="cps ${on?'on':''} ${p===g.dealer?'dealer':''}" style="transform:rotate(${ROT[posOf(p,g)]}deg)"><div class="lab"><span class="w">${MJ.WIND[(p-g.dealer+N)%N]}</span><span class="sc">${g.P[p].score}</span></div><div class="bar"></div></div>`;
  }
  html += `<div class="cp">${cp}<div class="mid"><div class="rn">${rl(g)}</div><div class="wl"><small>残</small>${H.wall.length}</div></div></div>`;
  for (let p = 0; p < N; p++){
    let inner = `<div class="pond">${pondHTML(g,H,p)}</div>`;
    if (H.riichi[p]) inner += `<div class="stick3 ${UI.animStick===p?'drop':''}"></div>`;
    if (p !== 0){
      const hand = H.hands[p];
      let handHTML;
      if (H.reveal) handHTML = hand.map(id => ft(id)).join('');
      else {
        const drawnHere = H.turn === p && H.drawnTile !== null && H.active && hand.length % 3 === 2;
        const n = hand.length;
        handHTML = Array.from({length: drawnHere ? n-1 : n}, stt).join('') + (drawnHere ? `<div class="gap"></div>${stt()}` : '');
      }
      const kitaHTML = H.kita && H.kita[p] && H.kita[p].length ? `<div class="meld3">${H.kita[p].map(id => ft(id)).join('')}</div>` : '';
      inner += `<div class="orow"><div class="hand">${handHTML}</div><div class="omelds">${kitaHTML}${H.melds[p].map(meld3).join('')}</div></div>`;
    }
    html += `<div class="seat" style="transform:rotateZ(${ROT[posOf(p,g)]}deg)">${inner}</div>`;
  }
  $('#plane').innerHTML = html;
}
function renderHud(g, H){
  const dora = [0,1,2,3,4].map(i => i < H.doraCount ? t2(H.dead[4+i*2], {flat:true}) : t2(0, {flat:true, back:true})).join('');
  $('#rhud').innerHTML = `${g.rules.name ? `<div class="tn">${esc(g.rules.name)}</div>` : ''}<div class="rn">${rl(g)}<small>${g.rules.sanma?'三麻 ':''}${g.rules.length==='hanchan'?'半荘戦':'東風戦'}</small></div>
    <div class="row"><span><i class="ico-100"></i><b>${g.honba}</b></span><span><i class="ico-stick"></i><b>${g.kyotaku}</b></span><span>残り<b>${H.wall.length}</b></span></div>
    <div class="dorabox"><span class="lb">ドラ</span><div class="ts">${dora}</div></div>`;
}
function renderPlates(g){
  if (!g || !g.h || !$('#pps')) return;
  const H = g.h;
  $('#pps').innerHTML = [...Array(NS(g)).keys()].map(p => {
    const pl = g.P[p], m = memberOf(p), turn = H.turn === p && H.active;
    const sub = seatSub(p, pl);
    const b = UI.bubbles[p] ? `<div class="bub">${esc(UI.bubbles[p])}</div>` : '';
    const think = UI.online && UI.online.waitingSeats && UI.online.waitingSeats.includes(p) && p !== 0 ? '<span class="think">考え中</span>' : '';
    const pos = posOf(p, g);
    return `<div class="pp pos${pos} ${pos===1||pos===2?'r':''} ${turn?'turn':''}">${think}<div class="ring">${avatar(m,p)}${p===g.dealer?'<div class="oya">親</div>':''}${H.riichi[p]?'<div class="rch">リーチ</div>':''}</div>
      <div class="nb"><b>${esc(pl.name)}</b><span>${esc(sub)}${H.wareme===p?' <span class="wm">割れ目</span>':''}</span></div>${b}</div>`;
  }).join('');
}
function analysis(g, H){
  const p = UI.pend;
  const key = H.hands[0].join(',') + '|' + (p && p.kind) + '|' + H.river.map(r => r.length).join(',') + '|' + (p && p.o.forbid ? p.o.forbid.join(',') : '');
  if (UI.ak === key) return UI.an;
  UI.ak = key; UI.an = null;
  if (p && p.kind === 'self' && !p.o.locked){
    const list = AI.analyze(g, 0, p.o.forbid);
    if (list.length){
      const minS = Math.min(...list.map(x => x.s));
      const bestUk = Math.max(...list.filter(x => x.s === minS).map(x => x.uk));
      const map = {};
      list.forEach(x => map[x.t] = {s:x.s, uk:x.uk, best: x.s===minS && x.uk===bestUk});
      UI.an = { map, minS, bestUk };
    }
  }
  return UI.an;
}
function renderMe(g, H){
  const p = UI.pend, mySelf = p && p.kind === 'self';
  const hand = H.hands[0].slice();
  let drawn = null;
  if (mySelf && p.o.drawn !== null && hand.includes(p.o.drawn)){ drawn = p.o.drawn; hand.splice(hand.indexOf(drawn), 1); }
  const an = S.hint ? analysis(g, H) : null;
  const threat = S.danger && H.riichi.some((r,q) => r && q !== 0);
  const btn = (id, isDrawn) => {
    const t = tt(id), ok = canClick(id);
    const a = an && an.map[t];
    let dg = '';
    if (threat){ const d = AI.danger(g, 0, t); dg = `<span class="dg ${d===0?'g':d<=4?'y':'r'}"></span>`; }
    const cls = ['ht', mySelf && !ok ? 'no' : '', a && a.best && mySelf && !UI.riichiMode ? 'best' : '', UI.sel===id?'sel':'', isDrawn?'in':''].join(' ');
    const uk = a && a.s === an.minS && mySelf && ok ? `<span class="uk">${a.uk}</span>` : '';
    return `<button type="button" class="${cls}" data-id="${id}" aria-label="${tileName(t)}">${UI.sel===id?'<span class="tap2">もう一度タップ</span>':uk}${dg}${t2(id)}</button>`;
  };
  let html = `<div class="hand">${hand.map(id => btn(id,false)).join('')}${drawn!==null?`<div class="drawn">${btn(drawn,true)}</div>`:''}</div>`;
  const myKita = H.kita && H.kita[0] && H.kita[0].length ? `<div class="meld kita">${H.kita[0].map(id => t2(id, {flat:true})).join('')}</div>` : '';
  if (H.melds[0].length || myKita) html += `<div class="mymelds">${myKita}${H.melds[0].map(meld2).join('')}</div>`;
  const el = $('#me');
  el.innerHTML = html;
  $$('.ht', el).forEach(b => b.addEventListener('click', e => clickTile(+b.dataset.id, e)));
  renderInfo(g, H, an);
}
function renderInfo(g, H, an){
  const p = UI.pend, info = [], called = H.melds[0].length;
  if (!H.active){ $('#info').innerHTML = ''; return; }
  if (p && p.kind === 'self'){
    const s = shanten(countsOf(H.hands[0]), called);
    if (s === -1) info.push(p.o.canTsumo ? `<span class="chip tp">ツモ和了できます</span>` : `<span class="chip ny">形は完成・役なし</span>`);
    else if (an){
      info.push(`<span class="chip sh">${an.minS===0?'打牌でテンパイ':an.minS+'向聴'}</span><span class="sub">最大受入 ${an.bestUk}枚</span>`);
      if (UI.sel !== null && an.map[tt(UI.sel)]){ const a = an.map[tt(UI.sel)]; info.push(`<span class="sub">${tileName(tt(UI.sel))}切り → ${a.s===0?'テンパイ':a.s+'向聴'}・受入${a.uk}枚（もう一度タップで打牌）</span>`); }
    }
    if (UI.riichiMode) info.push(`<span class="chip ny">リーチ宣言牌を選んでください</span>`);
  } else if (H.hands[0].length % 3 === 1){
    const s = shanten(countsOf(H.hands[0]), called);
    if (s === 0){
      const vis = g.visibleCounts(0), w = g.waits(0);
      let yaku = false;
      w.forEach(t => { if (MJ.evaluate(g.winCtx(0, t*4+3, {}))) yaku = true; });
      info.push(`<span class="chip tp">テンパイ</span><div class="waits">${w.map(t => `<div class="w">${t2t(t,{flat:true})}<span>残${Math.max(0,4-vis[t])}</span></div>`).join('')}</div>`);
      if (g.isFuriten(0)) info.push(`<span class="chip fr">フリテン</span>`);
      if (!yaku && !H.riichi[0]) info.push(`<span class="chip ny">役なし</span>`);
    } else if (S.hint) info.push(`<span class="chip sh">${s}向聴</span>`);
  }
  $('#info').innerHTML = info.join('');
}
function renderActs(g, H){
  const p = UI.pend, a = [];
  if (p && p.kind === 'self'){
    const o = p.o;
    if (o.canTsumo) a.push(`<button type="button" class="ab win" data-a="tsumo">ツモ</button>`);
    if (o.riichiIds.length && !o.locked) a.push(`<button type="button" class="ab rch ${UI.riichiMode?'on':''}" data-a="riichi">${UI.riichiMode?'取消':'リーチ'}</button>`);
    o.ankan.forEach(t => a.push(`<button type="button" class="ab kan" data-a="ankan" data-t="${t}">カン<small>${tileName(t)}</small></button>`));
    o.kakan.forEach(t => a.push(`<button type="button" class="ab kan" data-a="kakan" data-t="${t}">加槓<small>${tileName(t)}</small></button>`));
    if (o.kita) a.push(`<button type="button" class="ab kita" data-a="kita">キタ</button>`);
    if (o.kyuushu) a.push(`<button type="button" class="ab skip" data-a="kyuushu">九種九牌</button>`);
    if (o.locked && (o.canTsumo || o.kita)) a.push(`<button type="button" class="ab skip" data-a="skipTsumo">${o.canTsumo?'見逃す':'ツモ切り'}</button>`);
  } else if (p && p.kind === 'react'){
    const o = p.o;
    if (UI.chiPick){
      o.chi.forEach((pr,i) => a.push(`<button type="button" class="ab combo" data-a="chiC" data-i="${i}">${t2t(pr[0],{flat:true})}${t2t(pr[1],{flat:true})}</button>`));
      a.push(`<button type="button" class="ab skip" data-a="chiBack">戻る</button>`);
    } else {
      if (o.ron) a.push(`<button type="button" class="ab win" data-a="ron">ロン</button>`);
      if (o.pon) a.push(`<button type="button" class="ab pon" data-a="pon">ポン</button>`);
      if (o.chi) a.push(`<button type="button" class="ab chi" data-a="chi">チー</button>`);
      if (o.kan) a.push(`<button type="button" class="ab kan" data-a="kan">カン</button>`);
      a.push(`<button type="button" class="ab skip" data-a="pass">スキップ</button>`);
    }
  }
  const el = $('#acts'); el.innerHTML = a.join('');
  $$('button', el).forEach(b => b.addEventListener('click', () => act(b.dataset.a, b.dataset)));
}
function act(a, ds){
  const p = UI.pend; if (!p) return;
  if (p.kind === 'self'){
    if (a === 'tsumo') p.done({type:'tsumo'});
    else if (a === 'riichi'){ UI.riichiMode = !UI.riichiMode; UI.sel = null; render(); }
    else if (a === 'ankan' || a === 'kakan') p.done({type:a, t:+ds.t});
    else if (a === 'kyuushu') p.done({type:'kyuushu'});
    else if (a === 'kita') p.done({type:'kita'});
    else if (a === 'skipTsumo') p.done({type:'discard', id:p.o.drawn});
  } else {
    const o = p.o;
    if (a === 'chi'){ if (o.chi.length === 1) p.done({type:'chi', chi:o.chi[0]}); else { UI.chiPick = true; renderActs(UI.g, UI.g.h); } }
    else if (a === 'chiC') p.done({type:'chi', chi:o.chi[+ds.i]});
    else if (a === 'chiBack'){ UI.chiPick = false; renderActs(UI.g, UI.g.h); }
    else p.done({type:a});
  }
}
function renderTools(){
  const tg = (k, l, d) => `<button type="button" class="tg2 ${UI.auto[k]?'on':''}" data-k="${k}"><i></i><span>${l}<small>${d}</small></span></button>`;
  const anyAuto = UI.auto.win || UI.auto.nocall || UI.auto.tsumo;
  const ba = $('#b-auto'); if (ba){ ba.classList.toggle('on', anyAuto || UI.menu === 'auto'); }
  const bs = $('#b-stamp'); if (bs) bs.classList.toggle('on', UI.menu === 'stamp');
  $('#tools').innerHTML = UI.menu === 'auto' ? `<div class="dropdown">${tg('win','自動和了','和了れる時は自動で和了')}${tg('nocall','鳴きなし','ポン・チーを聞かない')}${tg('tsumo','ツモ切り','引いた牌をそのまま捨てる')}</div>` : '';
  $$('#tools .tg2').forEach(b => b.addEventListener('click', () => { const k = b.dataset.k; UI.auto[k] = !UI.auto[k]; SFX.pop(); renderTools(); }));
  const list = ['よろしく','ナイス！','それロンやろ','こわっ','えぇ…','ごめん','おつかれ','GG'];
  $('#stp').innerHTML = UI.menu === 'stamp' ? `<div class="dropdown stamppal">${list.map(s => `<button type="button" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : '';
  $$('#stp button').forEach(b => b.addEventListener('click', () => {
    if (UI.online){ SFX.pop(); UI.menu = null; renderTools(); sendStamp(b.dataset.s); return; }
    bubble(0, b.dataset.s); SFX.pop(); UI.menu = null; renderTools();
    if (Math.random() < .55) setTimeout(() => bubble(1 + Math.floor(Math.random()*3), pick(['せやな','まだまだ','ｗ','それな','はよ打って'])), 900);
  }));
}

/* ---------- 称号 ---------- */
function unlock(k){
  if (PR.ach[k]) return;
  PR.ach[k] = true; const a = ACH.find(x => x[0] === k);
  UI.newAch.push(a[1]); store.set(PKEY, PR); toast('称号「' + a[1] + '」を獲得');
}

/* ---------- 局の結果 ---------- */
function countUp(el, to, ms){
  const from = 0, t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0)/ms), e = 1 - Math.pow(1-k, 3); el.textContent = Math.round(from + (to-from)*e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function dcards(g, deltas){
  return `<div class="dcards">${g.P.map((pl,i) => {
    const d = deltas[i], cls = d > 0 ? 'plus' : d < 0 ? 'minus' : 'zero';
    return `<div class="dc">${avatar(memberOf(i), i)}<div><div class="n">${esc(pl.name)}</div><div class="s num">${pl.score}</div><div class="d num ${cls}">${d>0?'+':''}${d}</div></div></div>`;
  }).join('')}</div>`;
}
async function showHandResult(g, r, ho){
  ho = ho || {};
  if (!ho.noDelay) await sleep(r.kind === 'win' ? 1550 : 1300);
  render();
  if (r.kind === 'win' && r.winner === 0){
    const names = r.res.yaku.map(y => y.name), L = r.res.limit, ym = r.res.yakuman > 0;
    unlock('first');
    if (names.includes('一発')) unlock('ippatsu');
    if (names.includes('七対子')) unlock('chiitoi');
    if (ym || ['満貫','跳満','倍満','三倍満','数え役満'].includes(L)) unlock('mangan');
    if (ym || ['跳満','倍満','三倍満','数え役満'].includes(L)) unlock('haneman');
    if (ym || ['倍満','三倍満','数え役満'].includes(L)) unlock('baiman');
    if (ym || L === '数え役満') unlock('yakuman');
    if (r.res.ura >= 3) unlock('ura3');
    if (g.P.some((pl,i) => i !== 0 && pl.score < 0)) unlock('tobi');
    if (g.dealer === 0 && g.honba >= 2) unlock('renchan');
  }
  let html;
  if (r.kind === 'win'){
    const res = r.res, w = r.winner;
    const hand = r.hand.filter(id => id !== r.winId);
    const lim = res.limit;
    const hanko = lim ? `<div class="hanko ${res.yakuman?'ym':''} ${lim.length>2?'sm':''}"><b>${esc(lim.replace('ダブル','二倍'))}</b></div>` : '';
    html = `<div class="res">
      <div class="res-head"><div class="word">${r.tsumo?'ツモ':'ロン'}</div><div class="ring">${avatar(memberOf(w), w)}</div>
        <div class="nm"><b>${esc(g.P[w].name)}</b><span>${r.tsumo?'自摸和':esc(g.P[r.from].name)+' から出和了'}${r.wareme>=0?`　割れ目：${esc(g.P[r.wareme].name)}`:''}</span></div></div>
      <div class="res-hand"><div class="g">${hand.map(id => t2(id)).join('')}</div><div class="g">${t2(r.winId,{cls:'rd'})}</div>${r.melds.map(m => `<div class="g">${meld2(m).replace(/^<div class="meld">|<\/div>$/g,'')}</div>`).join('')}</div>
      <div class="res-dora"><div>ドラ表示<div class="g">${r.doraInd.map(t => t2t(t,{flat:true})).join('')}</div></div>${r.uraInd.length?`<div>裏ドラ表示<div class="g">${r.uraInd.map(t => t2t(t,{flat:true})).join('')}</div></div>`:''}</div>
      <div class="res-body">
        <div class="yk">${res.yaku.map((y,i) => `<div style="animation-delay:${.15+i*.12}s"><span>${esc(y.name)}</span><b>${typeof y.han==='number'?y.han+'翻':y.han}</b></div>`).join('')}</div>
        <div class="score-side"><div id="hk" style="min-width:${lim?180:0}px;min-height:${lim?180:0}px"></div><div class="pv"><div class="pts" id="pts">0</div><div class="hf">${res.yakuman?'':`${res.han}翻 ${res.fu}符`}${r.stick?`　供託 +${r.stick}`:''}</div></div></div>
      </div>
      ${dcards(g, r.deltas)}
      <div class="res-foot"><button class="bigbtn" id="next" type="button">次の局へ</button></div>
    </div>`;
    $('#layer').innerHTML = html;
    const delay = .15 + res.yaku.length*.12;
    setTimeout(() => { if ($('#hk') && hanko){ $('#hk').innerHTML = hanko; SFX.clack(); } if ($('#pts')) countUp($('#pts'), res.total, 700); }, delay*1000 + 150);
  } else {
    html = `<div class="res">
      <div class="res-head"><div class="word" style="color:#b9d4ea">流局</div><div class="nm"><span>${esc(r.reason)}</span></div></div>
      <div style="margin-top:24px">${[...Array(NS(g)).keys()].map(i => `<div class="tpr"><div class="n">${avatar(memberOf(i),i)}${esc(g.P[i].name)}</div>${r.tenpai[i]?`<span class="chip tp">聴牌</span><div class="g">${g.h.hands[i].map(id => t2(id,{flat:true})).join('')}</div>`:'<span class="chip sh">ノーテン</span>'}</div>`).join('')}</div>
      <div style="flex:1"></div>
      ${dcards(g, r.deltas)}
      <div class="res-foot"><button class="bigbtn" id="next" type="button">次の局へ</button></div>
    </div>`;
    $('#layer').innerHTML = html;
  }
  return new Promise(res => {
    const b = $('#next');
    if (ho.waiting){ b.disabled = true; b.textContent = '他のプレイヤーを待っています'; b.classList.add('sec'); return; }
    b.focus();
    b.addEventListener('click', () => { SFX.pop(); if (!ho.keep) $('#layer').innerHTML = ''; else { b.disabled = true; b.textContent = '他のプレイヤーを待っています'; b.classList.add('sec'); } res(); });
  });
}

/* ---------- 終局 ---------- */
function showFinal(g, d){
  const final = d.final, me = final.find(f => f.seat === 0), rank = me.rank - 1;
  const beforeLv = PR.lv, before = rankName(PR.lv);
  PR.games++; PR.ranks[rank]++; PR.sumRank += me.rank;
  PR.hands += g.P[0].hands; PR.wins += g.P[0].wins; PR.dealIns += g.P[0].dealIns; PR.riichis += g.P[0].riichis;
  if (g.P[0].bestHand && (!PR.best || g.P[0].bestHand.total > PR.best.total)) PR.best = g.P[0].bestHand;
  const gain = rpGain(rank, S.length, !!S.sanma);
  let change = '';
  if (PR.lv < 15){
    PR.rp += gain;
    if (PR.rp >= need(PR.lv)){ PR.rp -= need(PR.lv); PR.lv++; change = `昇段 ${before} → ${rankName(PR.lv)}`; }
    else if (PR.rp < 0){ if (PR.lv >= 3){ PR.lv--; PR.rp = Math.floor(need(PR.lv)/2); change = `降段 ${before} → ${rankName(PR.lv)}`; } else PR.rp = 0; }
  }
  if (me.rank === 1) unlock('top');
  if (g.P[0].dealIns === 0) unlock('nodealin');
  store.set(PKEY, PR);
  const last = final[final.length - 1];
  const pct = PR.lv >= 15 ? 100 : Math.max(0, Math.min(100, PR.rp/need(PR.lv)*100));
  const html = `<div class="res">
    <div class="res-head"><div class="word">終局</div><div class="nm"><span>${d.reason&&d.reason!=='終局'?esc(d.reason)+'　':''}${S.length==='hanchan'?'半荘戦':'東風戦'}</span></div></div>
    <div class="fin-list">${final.map((f,i) => `<div class="fr ${f.seat===0?'isme':''}" style="animation-delay:${.1+i*.12}s"><span class="rk r${f.rank}"><b>${f.rank}</b>位</span>${avatar(memberOf(f.seat), f.seat)}<span class="nm">${esc(g.P[f.seat].name)}${f.yakitori?'<small>焼き鳥</small>':''}</span><span class="sc">${f.score}</span><span class="pt ${f.pt>0?'plus':f.pt<0?'minus':'zero'}">${f.pt>0?'+':''}${f.pt.toFixed(1)}</span></div>`).join('')}</div>
    <div class="fin-bottom">
      <div class="rkcard">${emblem(PR.lv)}<div style="flex:1"><div style="font-size:26px">${esc(rankName(PR.lv))} <span class="num ${gain>=0?'plus':'minus'}" style="font-size:28px;margin-left:8px">${gain>0?'+':''}${gain}</span></div>
        ${change?`<div style="color:var(--gold);font-size:18px;margin-top:4px">${esc(change)}</div>`:''}
        <div class="rbar"><i style="width:${pct}%"></i></div><div class="pf-sub">${PR.lv>=15?'最高段位':`${PR.rp} / ${need(PR.lv)} pt`}</div>
        ${UI.newAch.length?`<div class="pf-sub" style="color:var(--gold)">新しい称号：${UI.newAch.map(esc).join('・')}</div>`:''}</div></div>
      ${S.batsu?`<div class="batsu"><b>罰ゲーム　${esc(g.P[last.seat].name)}</b><span>${esc(S.batsu)}</span></div>`:'<div></div>'}
    </div>
    <div style="flex:1"></div>
    <div class="res-foot"><button class="bigbtn sec" id="toL" type="button">ロビーへ</button><button class="bigbtn" id="again" type="button">もう一局</button></div>
  </div>`;
  void beforeLv;
  setTimeout(() => {
    $('#layer').innerHTML = html; SFX.win(false);
    $('#again').addEventListener('click', () => { $('#layer').innerHTML = ''; startGame(); });
    $('#toL').addEventListener('click', toLobby);
  }, 500);
}




/* =====================================================================
   オンライン（部屋・グループ・成績）
   ===================================================================== */
const NET = { cfg: null, sb: null, devUser: null };
let ME = null;               // {profile, groups, stats, account}
const R = { code: null, room: null, view: null, version: -1, eventCount: null, unsub: null, poll: null, tickT: 0, queue: Promise.resolve(), overlayKey: null, lastPromptKey: null, builtFor: null };

async function netInit(){
  NET.cfg = await fetch('/api/config').then(r => r.json());
  if (NET.cfg.dev){
    let id = null;
    try{ id = localStorage.getItem('yokocho.devUser'); }catch(e){}
    if (!id){ id = crypto.randomUUID(); try{ localStorage.setItem('yokocho.devUser', id); }catch(e){} }
    NET.devUser = id;
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  NET.sb = createClient(NET.cfg.supabaseUrl, NET.cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const { data } = await NET.sb.auth.getSession();
  if (!data.session){
    const r = await NET.sb.auth.signInAnonymously();
    if (r.error) throw r.error;
  }
}
async function rpc(op, args){
  const headers = { 'Content-Type': 'application/json' };
  if (NET.cfg.dev) headers['x-dev-user'] = NET.devUser;
  else { const { data } = await NET.sb.auth.getSession(); headers.Authorization = 'Bearer ' + (data.session && data.session.access_token); }
  const res = await fetch('/api/rpc', { method: 'POST', headers, body: JSON.stringify({ op, args: args || {} }) });
  const j = await res.json().catch(() => ({ error: '通信エラーが起きました' }));
  if (!res.ok) throw new Error(j.error || '通信エラーが起きました');
  return j;
}
function subscribeRoom(roomId, cb){
  if (NET.cfg.dev){
    const es = new EventSource('/api/dev-events?room=' + roomId);
    es.onmessage = e => { try{ cb(JSON.parse(e.data)); }catch(x){} };
    return () => es.close();
  }
  const ch = NET.sb.channel('room-' + roomId).on('broadcast', { event: 'u' }, m => cb(m.payload)).subscribe();
  return () => { try{ NET.sb.removeChannel(ch); }catch(e){} };
}

async function loadMe(){
  ME = await rpc('me');
  S.you.name = ME.profile.name; S.you.photo = ME.profile.avatar; saveS();
  return ME;
}

/* ---------- 共通 ---------- */
const busy = (el, on) => { if (el){ el.disabled = on; el.classList.toggle('busy', on); } };
function sheet(title, body, opts){
  opts = opts || {};
  const L = $('#layer');
  L.innerHTML = `<div class="sheet-bg"><div class="sheet ${opts.cls||''}"><h2>${title}<button class="x" type="button">${opts.closeLabel||'閉じる'}</button></h2>${body}</div></div>`;
  const close = () => { L.innerHTML = ''; if (opts.onClose) opts.onClose(); };
  $('.x', L).addEventListener('click', close);
  $('.sheet-bg', L).addEventListener('click', e => { if (e.target.classList.contains('sheet-bg')) close(); });
  return { el: $('.sheet', L), close };
}
const fmtPt = v => (v > 0 ? '+' : '') + Number(v).toFixed(1);
const fmtDate = s => { const d = new Date(s); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
function avatarP(p, seat, size){
  const html = avatar({ name: p && p.name, photo: p && p.avatar }, seat % 4);
  return size ? html.replace('class="av" style="', `class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.46)}px;`) : html;
}
const kRound = s => String(s || '').replace(/[1-4]/, d => '一二三四'[d - 1]);
function copyText(text){
  try{ navigator.clipboard.writeText(text).then(() => toast('コピーしました'), () => toast(text)); }catch(e){ toast(text); }
}
function lineUrl(text){ return 'https://line.me/R/msg/text/?' + encodeURIComponent(text); }
const canShare = () => !!(navigator.share);
/** スマホの共有シート（Signal・LINE・Messenger・Discord・メールなど）で招待を送る */
async function shareInvite(text, url){
  if (navigator.share){
    try{ await navigator.share({ title: '麻雀横丁', text, url }); return; }
    catch(e){ if (e && e.name === 'AbortError') return; }
  }
  copyText(text + '\n' + url);
}
function go(path){ try{ history.replaceState(null, '', path); }catch(e){} }

/* ============ ホーム ============ */
function renderLobby(){
  go('/');
  $('#room').hidden = true; $('#game').hidden = true; $('#lobby').hidden = false;
  const p = ME ? ME.profile : { name: S.you.name, lv: 0, rp: 0, avatar: null };
  const st = ME ? ME.stats : { games: 0, ranks: [0,0,0,0], pt: 0 };
  const lv = p.lv, nd = need(lv), pct = lv >= 15 ? 100 : Math.max(0, Math.min(100, p.rp / nd * 100));
  const avg = st.games ? (st.ranks.reduce((a, n, i) => a + n*(i+1), 0) / st.games).toFixed(2) : '-';
  const deco = [0*4, 13*4, 22*4, 31*4+1, 33*4+1].map(id => t2(id)).join('');
  $('#lobby').innerHTML = `
    <div class="lb-bg"><canvas id="dust" width="1600" height="900"></canvas><div class="lb-table"></div><div class="lb-tiles">${[4*4+0,5*4,6*4,13*4+1,13*4+2,13*4+3,27*4,27*4+1].map(id=>t2(id)).join('')}</div></div>
    <div class="logo"><h1>麻雀横丁</h1><div class="en">MAHJONG YOKOCHO</div></div>
    <button class="profile" type="button" id="pf">
      <div class="pf-av">${avatarP(p, 0, 120)}</div>
      <div>
        <div class="pf-name">${esc(p.name)}</div>
        <div class="pf-rank">${esc(rankName(lv))}</div>
        <div class="rbar"><i style="width:${pct}%"></i></div>
        <div class="pf-sub">${lv >= 15 ? '最高段位' : `昇段まで ${Math.max(0, nd - p.rp)}pt`}</div>
      </div>
      <div class="pf-stats">
        <div><b>${st.games}</b><span>対局</span></div>
        <div><b>${avg}</b><span>平均順位</span></div>
        <div><b>${st.games ? Math.round(st.ranks[0]/st.games*100)+'%' : '-'}</b><span>トップ率</span></div>
        <div><b class="${st.pt>0?'plus':st.pt<0?'minus':''}">${st.games ? fmtPt(st.pt) : '-'}</b><span>累計pt</span></div>
      </div>
    </button>
    <div class="menu">
      <button class="mb-start" id="mk" type="button"><div class="t">卓を立てる</div><div class="s">仲間を招待して4人で打つ</div><div class="tl">${deco}</div></button>
      <div class="subs">
        <button class="mb" type="button" id="m-join"><b>番号で入る</b><span>4桁の卓番号を入力</span></button>
        <button class="mb" type="button" id="m-grp"><b>グループ</b><span>${ME && ME.groups.length ? ME.groups.length + 'グループ・ランキング' : '仲間を集めて成績を記録'}</span></button>
        <button class="mb" type="button" id="m-cpu"><b>CPUと練習</b><span>ひとりで打つ</span></button>
        <button class="mb" type="button" id="m-skin"><b>着せ替え</b><span>卓と牌の色</span></button>
      </div>
    </div>`;
  $('#pf').addEventListener('click', () => { SFX.pop(); openProfile(); });
  $('#mk').addEventListener('click', () => { audio(); SFX.pop(); openCreateRoom(); });
  $('#m-join').addEventListener('click', () => { audio(); SFX.pop(); openKeypad(); });
  $('#m-grp').addEventListener('click', () => { SFX.pop(); openGroups(); });
  $('#m-cpu').addEventListener('click', () => { audio(); SFX.pop(); openPractice(); });
  $('#m-skin').addEventListener('click', () => { SFX.pop(); openPanel('skin'); });
  dust();
}

/* ---------- CPU練習 ---------- */
function openPractice(){
  const b = `<div class="modepick" id="pn" style="margin-bottom:14px">
      <button type="button" data-n="4" class="${!S.sanma?'on':''}">4人打ち<small>いつもの麻雀</small></button>
      <button type="button" data-n="3" class="${S.sanma?'on':''}">3人打ち<small>三麻・北抜き</small></button></div>
    <div class="modepick" id="pm">
      <button type="button" data-v="tonpuu" class="${S.length==='tonpuu'?'on':''}">東風戦<small>約10分</small></button>
      <button type="button" data-v="hanchan" class="${S.length==='hanchan'?'on':''}">半荘戦<small>約25分</small></button></div>
    <div class="row2"><button class="mb" type="button" id="p-mem"><b>練習相手</b><span>${esc(S.friends.map(f => f.name).join('・'))}</span></button>
    <button class="mb" type="button" id="p-rule"><b>ルール・アシスト</b><span>赤・喰いタン・ヒントなど</span></button></div>
    <div class="sheet-foot"><button class="bigbtn" id="p-go" type="button">練習を始める</button></div>`;
  sheet('CPUと練習', b);
  $$('#pm button').forEach(x => x.addEventListener('click', () => { S.length = x.dataset.v; saveS(); openPractice(); }));
  $$('#pn button').forEach(x => x.addEventListener('click', () => { S.sanma = x.dataset.n === '3'; saveS(); openPractice(); }));
  $('#p-mem').addEventListener('click', () => openPanel('member'));
  $('#p-rule').addEventListener('click', () => openPanel('rule'));
  $('#p-go').addEventListener('click', () => { $('#layer').innerHTML = ''; try{ speechSynthesis.getVoices(); }catch(e){} startGame(); });
}

/* ---------- プロフィール ---------- */
function openProfile(){
  const p = ME.profile, st = ME.stats, acc = ME.account;
  const avg = st.games ? (st.ranks.reduce((a, n, i) => a + n*(i+1), 0) / st.games).toFixed(2) : '-';
  const body = `
    <div class="prof-top">
      <button class="phbtn" type="button" id="pp-ph" aria-label="写真を変える"><div style="width:150px;height:150px">${avatarP(p, 0, 150)}</div><span class="cam">写真</span></button>
      <div style="flex:1;min-width:0">
        <div class="who">名前（卓で表示されます）</div>
        <div class="inline"><input class="inp" id="pp-name" maxlength="10" value="${esc(p.name)}"><button class="bigbtn slim" id="pp-save" type="button">保存</button></div>
      </div>
      ${emblem(p.lv)}
    </div>
    <h3>成績</h3>
    <div class="statgrid">
      <div><b>${st.games}</b><span>対局数</span></div>
      <div><b>${avg}</b><span>平均順位</span></div>
      <div><b class="${st.pt>0?'plus':st.pt<0?'minus':''}">${st.games?fmtPt(st.pt):'-'}</b><span>累計pt</span></div>
      <div><b>${st.hands?Math.round(st.wins/st.hands*100)+'%':'-'}</b><span>和了率</span></div>
      <div><b>${st.hands?Math.round(st.dealIns/st.hands*100)+'%':'-'}</b><span>放銃率</span></div>
    </div>
    <div class="pf-sub" style="margin-top:12px">1位 ${st.ranks[0]} ／ 2位 ${st.ranks[1]} ／ 3位 ${st.ranks[2]} ／ 4位 ${st.ranks[3]}　最高打点：${st.best?esc(`${st.best.label||''} ${st.best.total}点`):'まだなし'}</div>
    <h3>称号（この端末）</h3><div class="ach-grid">${ACH.map(([k,n,d]) => `<div class="achc ${PR.ach[k]?'on':''}"><b>${n}</b><span>${d}</span></div>`).join('')}</div>
    <h3>アカウントの引き継ぎ</h3>
    ${NET.cfg.dev ? '<div class="pf-sub">ローカル検証モードでは使えません</div>' : acc.anonymous ? `
      <div class="pf-sub">いまは登録なしで遊んでいます。機種変更やブラウザのデータ削除で成績が消えないよう、メールアドレスを登録しておけます。</div>
      <div class="inline" style="margin-top:12px"><input class="inp" id="pp-mail" type="email" inputmode="email" placeholder="メールアドレス"><button class="bigbtn slim" id="pp-link" type="button">登録する</button></div>
      <div class="pf-sub" style="margin-top:18px">別の端末で登録済みのアカウントを使う</div>
      <div class="inline" style="margin-top:8px"><input class="inp" id="pp-mail2" type="email" inputmode="email" placeholder="登録したメールアドレス"><button class="bigbtn slim sec" id="pp-login" type="button">ログインリンクを送る</button></div>`
      : `<div class="pf-sub">登録済み：${esc(acc.email || '')}　どの端末でもこのメールでログインできます。</div>`}`;
  sheet('プロフィール', body, { onClose: () => renderLobby() });
  $('#pp-ph').addEventListener('click', () => { photoTarget = 'profile'; $('#photo').value = ''; $('#photo').click(); });
  $('#pp-save').addEventListener('click', async e => {
    busy(e.currentTarget, true);
    try{ await rpc('updateProfile', { name: $('#pp-name').value }); await loadMe(); toast('保存しました'); }catch(x){ toast(x.message); }
    busy(e.currentTarget, false);
  });
  const link = $('#pp-link');
  if (link) link.addEventListener('click', async () => {
    const email = $('#pp-mail').value.trim(); if (!email) return;
    busy(link, true);
    const { error } = await NET.sb.auth.updateUser({ email }, { emailRedirectTo: location.origin });
    busy(link, false);
    toast(error ? '送れませんでした: ' + error.message : '確認メールを送りました。メールのリンクを開くと登録完了です');
  });
  const login = $('#pp-login');
  if (login) login.addEventListener('click', async () => {
    const email = $('#pp-mail2').value.trim(); if (!email) return;
    busy(login, true);
    const { error } = await NET.sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin } });
    busy(login, false);
    toast(error ? '送れませんでした: ' + error.message : 'ログイン用のリンクを送りました');
  });
}
function onPhoto(url){
  if (photoTarget === 'profile'){
    rpc('updateProfile', { avatar: url }).then(loadMe).then(openProfile).catch(e => toast(e.message));
    return;
  }
  memberOf(photoTarget).photo = url; saveS(); openPanel('member');
}

/* ---------- 卓を立てる ---------- */
const TABLE_NAMES = ['負けたら奢り卓','役満祈願卓','ハコ下注意卓','今夜は帰さない卓','親っかぶり卓','金曜の夜卓','一発逆転卓','赤5の奪い合い卓','終電までに終わる卓','リーチ一発ツモ卓','裏ドラ頼み卓','ベタオリ禁止卓','焼き鳥回避卓','点棒の貸し借り卓','横丁の奥の卓','常連だけの卓'];
function openCreateRoom(presetGroup){
  let groups = ME.groups;
  const st = { group: presetGroup !== undefined ? presetGroup : (groups[0] ? groups[0].id : null), sanma: !!S.sanma, length: S.length, aka: S.aka, kuitan: S.kuitan, yakitori: S.yakitori, wareme: S.wareme, timer: true, batsu: S.batsu, name: '' };
  const draw = () => {
    const opt = (k, label, sub) => `<label class="opt"><input type="checkbox" data-k="${k}" ${st[k]?'checked':''}><span class="sw"></span><span>${label}<small>${sub}</small></span></label>`;
    const body = `
      <div class="who">卓の名前</div>
      <div class="inline" style="margin-bottom:22px"><input class="inp" id="cr-name" maxlength="16" value="${esc(st.name)}" placeholder="空欄なら名前をおまかせで付けます"><button class="bigbtn slim sec" id="cr-dice" type="button">おまかせ</button></div>
      <div class="who">成績を記録するグループ</div>
      <div class="chips" id="cr-g">${groups.map(g => `<button type="button" class="chipb ${st.group===g.id?'on':''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}<button type="button" class="chipb ${st.group===null?'on':''}" data-g="">記録しない</button><button type="button" class="chipb add" id="cr-newg">＋ 新しいグループ</button></div>
      ${st.newGroup ? `<div class="inline" style="margin-top:14px"><input class="inp" id="cr-gname" maxlength="10" placeholder="例：金曜麻雀会"><button class="bigbtn slim" id="cr-gmk" type="button">作って選ぶ</button></div>` : ''}
      ${!groups.length && !st.newGroup ? '<div class="pf-sub" style="margin-top:10px">グループを作ると、この卓の結果がランキングと対局履歴に残ります</div>' : ''}
      <div class="modepick" id="cr-n" style="margin-top:22px">
        <button type="button" data-n="4" class="${!st.sanma?'on':''}">4人打ち<small>いつもの麻雀</small></button>
        <button type="button" data-n="3" class="${st.sanma?'on':''}">3人打ち<small>三麻・北抜き</small></button></div>
      <div class="modepick" id="cr-m" style="margin-top:14px">
        <button type="button" data-v="tonpuu" class="${st.length==='tonpuu'?'on':''}">東風戦<small>約10分</small></button>
        <button type="button" data-v="hanchan" class="${st.length==='hanchan'?'on':''}">半荘戦<small>約25分</small></button></div>
      <h3>ルール</h3>
      <div class="opts">${opt('aka','赤ドラ','各色の5に1枚')}${opt('kuitan','喰いタン','鳴いても断么九')}${opt('yakitori','焼き鳥','和了なしで −10pt')}${opt('wareme','割れ目','支払い・受取が倍になる人')}${opt('timer','持ち時間','打牌25秒・鳴き12秒')}</div>
      <h3>ラスの罰ゲーム</h3><input class="inp" id="cr-b" maxlength="40" value="${esc(st.batsu||'')}" placeholder="なしでもOK">
      <div class="sheet-foot"><button class="bigbtn" id="cr-go" type="button">卓を立てる</button></div>`;
    sheet('卓を立てる', body);
    const keep = () => { st.batsu = $('#cr-b').value; st.name = $('#cr-name').value; };
    $('#cr-dice').addEventListener('click', () => { let n; do { n = pick(TABLE_NAMES); } while (n === $('#cr-name').value && TABLE_NAMES.length > 1); $('#cr-name').value = n; SFX.tick(); });
    $$('#cr-g .chipb[data-g]').forEach(b => b.addEventListener('click', () => { keep(); st.group = b.dataset.g || null; st.newGroup = false; SFX.tick(); draw(); }));
    $('#cr-newg').addEventListener('click', () => { keep(); st.newGroup = true; draw(); const i = $('#cr-gname'); if (i) i.focus(); });
    const gmk = $('#cr-gmk');
    if (gmk) gmk.addEventListener('click', async () => {
      const name = $('#cr-gname').value.trim(); if (!name){ $('#cr-gname').focus(); return; }
      keep(); busy(gmk, true);
      try{ const r = await rpc('createGroup', { name }); await loadMe(); groups = ME.groups; st.group = r.group.id; st.newGroup = false; toast(`「${name}」を作りました`); draw(); }
      catch(x){ toast(x.message); busy(gmk, false); }
    });
    $$('#cr-m button').forEach(b => b.addEventListener('click', () => { keep(); st.length = b.dataset.v; draw(); }));
    $$('#cr-n button').forEach(b => b.addEventListener('click', () => { keep(); st.sanma = b.dataset.n === '3'; draw(); }));
    $$('.sheet input[type=checkbox]').forEach(el => el.addEventListener('change', () => { st[el.dataset.k] = el.checked; }));
    $('#cr-go').addEventListener('click', async e => {
      keep();
      Object.assign(S, { sanma: st.sanma, length: st.length, aka: st.aka, kuitan: st.kuitan, yakitori: st.yakitori, wareme: st.wareme, batsu: st.batsu }); saveS();
      busy(e.currentTarget, true);
      try{
        const r = await rpc('createRoom', { groupId: st.group, rules: { sanma: st.sanma, length: st.length, aka: st.aka, kuitan: st.kuitan, yakitori: st.yakitori, wareme: st.wareme, timer: st.timer, batsu: st.batsu, name: st.name } });
        $('#layer').innerHTML = '';
        enterRoom(r.room.code, r);
      }catch(x){ toast(x.message); busy(e.currentTarget, false); }
    });
  };
  draw();
}

/* ---------- 番号で入る ---------- */
function openKeypad(){
  let v = '';
  const body = `<div class="kp-disp" id="kp-d"></div>
    <div class="kp">${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" data-n="${n}">${n}</button>`).join('')}<button type="button" data-n="del" class="sm">消す</button><button type="button" data-n="0">0</button><button type="button" data-n="go" class="go">入る</button></div>`;
  sheet('番号で入る', body, { cls: 'narrow' });
  const upd = () => { $('#kp-d').innerHTML = [0,1,2,3].map(i => `<span class="${v[i]?'on':''}">${v[i]||''}</span>`).join(''); };
  upd();
  $$('.kp button').forEach(b => b.addEventListener('click', async () => {
    const n = b.dataset.n;
    if (n === 'del') v = v.slice(0, -1);
    else if (n === 'go'){ if (v.length === 4){ busy(b, true); try{ const r = await rpc('joinRoom', { code: v }); $('#layer').innerHTML = ''; enterRoom(v, r); }catch(x){ toast(x.message); busy(b, false); } } return; }
    else if (v.length < 4) v += n;
    SFX.tick(); upd();
  }));
}

/* ============ グループ ============ */
async function openGroups(){
  try{ await loadMe(); }catch(e){}
  const gs = ME.groups;
  const body = `
    ${gs.length ? `<div class="glist">${gs.map(g => `<button type="button" class="gitem" data-id="${g.id}"><b>${esc(g.name)}</b><span>${g.memberCount}人${g.role==='owner'?'・作成者':''}</span></button>`).join('')}</div>` : '<div class="pf-sub">まだグループがありません。作るか、招待コードで入りましょう。</div>'}
    <h3>グループを作る</h3>
    <div class="inline"><input class="inp" id="g-name" maxlength="10" placeholder="例：金曜麻雀会"><button class="bigbtn slim" id="g-mk" type="button">作る</button></div>
    <div class="pf-sub" style="margin-top:22px">仲間から届いた招待リンクを開くか、そのグループの卓に一度入ると、自動でメンバーになります。</div>
    <details class="codejoin"><summary>招待コードを手で入力する</summary>
    <div class="inline" style="margin-top:12px"><input class="inp" id="g-code" maxlength="6" placeholder="6桁のコード" style="text-transform:uppercase"><button class="bigbtn slim sec" id="g-join" type="button">入る</button></div></details>`;
  sheet('グループ', body, { onClose: () => renderLobby() });
  $$('.gitem').forEach(b => b.addEventListener('click', () => openGroup(b.dataset.id)));
  $('#g-mk').addEventListener('click', async e => {
    busy(e.currentTarget, true);
    try{ const r = await rpc('createGroup', { name: $('#g-name').value }); await loadMe(); openGroup(r.group.id); }catch(x){ toast(x.message); busy(e.currentTarget, false); }
  });
  $('#g-join').addEventListener('click', async e => {
    busy(e.currentTarget, true);
    try{ const r = await rpc('joinGroup', { code: $('#g-code').value }); await loadMe(); openGroup(r.group.id); }catch(x){ toast(x.message); busy(e.currentTarget, false); }
  });
}
async function openGroup(id, tab, mode){
  let d;
  try{ d = await rpc('getGroup', { id }); }catch(x){ toast(x.message); return openGroups(); }
  tab = tab || 'rank';
  const g = d.group, mem = {};
  d.members.forEach(m => { mem[m.id] = m; });
  const url = `${location.origin}/g/${g.code}`;
  const has3 = d.ranking.some(x => Number(x.mode) === 3), has4 = d.ranking.some(x => Number(x.mode || 4) === 4);
  mode = mode || (has4 || !has3 ? 4 : 3);
  const rows = d.ranking.filter(x => Number(x.mode || 4) === mode).sort((a, b) => Number(b.total_pt) - Number(a.total_pt));
  const noGames = d.members.filter(m => !rows.some(r => r.user_id === m.id));
  const modeChips = (has3 && has4) || mode === 3 ? `<div class="rank-mode">${[4,3].map(m => `<button type="button" class="chipb ${mode===m?'on':''}" data-mode="${m}">${m}人打ち</button>`).join('')}</div>` : '';
  const rankHTML = modeChips + (rows.length ? `<div class="tbl rank">
      <div class="tr th"><span>#</span><span></span><span>名前</span><span>累計pt</span><span>対局</span><span>平均順位</span><span>トップ率</span><span>和了率</span><span>最高打点</span></div>
      ${rows.map((r, i) => { const m = mem[r.user_id] || { name: '退会した人' }; return `<div class="tr ${i<3?'top'+(i+1):''}"><span class="num">${i+1}</span><span>${avatarP(m, i, 64)}</span><span class="nm">${esc(m.name)}</span><span class="num ${r.total_pt>0?'plus':r.total_pt<0?'minus':''}">${fmtPt(r.total_pt)}</span><span class="num">${r.games}</span><span class="num">${Number(r.avg_rank).toFixed(2)}</span><span class="num">${Math.round(r.tops/r.games*100)}%</span><span class="num">${r.hands?Math.round(r.wins/r.hands*100)+'%':'-'}</span><span class="num">${r.best_total||'-'}</span></div>`; }).join('')}
    </div>${noGames.length ? `<div class="pf-sub" style="margin-top:12px">まだ対局なし：${noGames.map(m => esc(m.name)).join('、')}</div>` : ''}`
    : '<div class="empty">まだ対局がありません。卓を立てて最初の1局を打ちましょう。</div>');
  const histHTML = d.games.length ? `<div class="hist">${d.games.map(x => {
      const res = x.results.slice().sort((a, b) => a.rank - b.rank);
      return `<button type="button" class="hrow" data-game="${x.id}"><span class="dt">${fmtDate(x.ended_at)}<small>${x.rules.name ? esc(x.rules.name) + '・' : ''}${x.rules.sanma?'三麻・':''}${x.rules.length==='hanchan'?'半荘':'東風'}</small></span>${res.map(r => { const pl = x.players[r.seat]; return `<span class="hp r${r.rank}"><i>${r.rank}</i>${esc(pl.name)}<b class="${r.pt>0?'plus':r.pt<0?'minus':''}">${fmtPt(r.pt)}</b></span>`; }).join('')}</button>`;
    }).join('')}</div>` : '<div class="empty">まだ対局がありません。</div>';
  const memHTML = `<div class="glist">${d.members.map((m, i) => `<div class="gitem static">${avatarP(m, i, 64)}<b>${esc(m.name)}</b><span>${esc(rankName(m.lv||0))}${m.role==='owner'?'・作成者':''}</span></div>`).join('')}</div>`;
  const body = `
    <div class="ginv">
      <div><div class="who">招待コード</div><div class="gcode">${esc(g.code)}</div></div>
      <button class="bigbtn slim" id="g-share" type="button">${canShare() ? '招待を送る' : '招待文をコピー'}</button>
      <a class="bigbtn line" href="${lineUrl(`麻雀横丁のグループ「${g.name}」に招待します。\n${url}`)}" target="_blank" rel="noopener">LINE</a>
      <button class="bigbtn slim sec" id="g-copy" type="button">URLをコピー</button>
      <button class="bigbtn" id="g-play" type="button">この仲間で卓を立てる</button>
    </div>
    <div class="tabs">${[['rank','ランキング'],['hist','対局履歴'],['mem','メンバー']].map(([k,l]) => `<button type="button" data-t="${k}" class="${tab===k?'on':''}">${l}</button>`).join('')}</div>
    <div class="tabbody">${tab==='rank'?rankHTML:tab==='hist'?histHTML:memHTML}</div>
    ${!d.isOwner && tab==='mem' ? '<div class="sheet-foot"><button class="bigbtn slim sec" id="g-leave" type="button">このグループを抜ける</button></div>' : ''}`;
  sheet(esc(g.name), body, { cls: 'wide', closeLabel: '戻る', onClose: () => openGroups() });
  $('#g-copy').addEventListener('click', () => copyText(url));
  $('#g-share').addEventListener('click', () => shareInvite(`麻雀横丁のグループ「${g.name}」に招待します。`, url));
  $('#g-play').addEventListener('click', () => openCreateRoom(g.id));
  $$('.tabs button').forEach(b => b.addEventListener('click', () => openGroup(id, b.dataset.t, mode)));
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => openGroup(id, 'rank', +b.dataset.mode)));
  $$('.hrow').forEach(b => b.addEventListener('click', () => openGameDetail(b.dataset.game, () => openGroup(id, 'hist'))));
  const lv = $('#g-leave');
  if (lv) lv.addEventListener('click', async () => { try{ await rpc('leaveGroup', { id }); await loadMe(); openGroups(); }catch(x){ toast(x.message); } });
}
async function openGameDetail(id, back){
  let d;
  try{ d = await rpc('getGame', { id }); }catch(x){ toast(x.message); return; }
  const x = d.game, res = x.results.slice().sort((a, b) => a.rank - b.rank);
  const name = s => esc(x.players[s] ? x.players[s].name : '?');
  const body = `
    <div class="pf-sub">${fmtDate(x.ended_at)}　${x.rules.sanma?'3人打ち ':''}${x.rules.length==='hanchan'?'半荘戦':'東風戦'}　${esc(x.end_reason||'')}</div>
    <div class="fin-list">${res.map(r => `<div class="fr"><span class="rk r${r.rank}"><b>${r.rank}</b>位</span>${avatarP({ name: x.players[r.seat].name }, r.seat, 68)}<span class="nm">${name(r.seat)}${x.players[r.seat].cpu?'<small>CPU</small>':''}${r.yakitori?'<small>焼き鳥</small>':''}</span><span class="sc">${r.score}</span><span class="pt ${r.pt>0?'plus':r.pt<0?'minus':'zero'}">${fmtPt(r.pt)}</span></div>`).join('')}</div>
    <h3>局の記録</h3>
    <div class="hands">${x.hands.map(h => h.kind === 'win'
      ? `<div class="hd"><span class="rd">${esc(kRound(h.round))}${h.honba?` ${h.honba}本場`:''}</span><span class="w">${name(h.winner)}<small>${h.tsumo?'ツモ':name(h.from)+'から'}</small></span><span class="yk2">${esc(h.yaku.join('・'))}</span><span class="pt2">${h.limit?`<em>${esc(h.limit)}</em>`:''}${h.total}</span></div>`
      : `<div class="hd draw"><span class="rd">${esc(kRound(h.round))}${h.honba?` ${h.honba}本場`:''}</span><span class="w">流局<small>${esc(h.reason)}</small></span><span class="yk2">${h.tenpai ? '聴牌：' + (h.tenpai.map((t,i) => t ? name(i) : null).filter(Boolean).join('・') || 'なし') : ''}</span><span class="pt2"></span></div>`).join('')}</div>`;
  sheet(esc(x.rules.name || '対局の記録'), body, { cls: 'wide', closeLabel: '戻る', onClose: back || (() => renderLobby()) });
}

/* ============ 卓（部屋） ============ */
function onlineMember(rs){
  const s = UI.online && UI.online.seatsRel && UI.online.seatsRel[rs];
  return s ? { name: s.name, photo: s.avatar } : { name: '?' };
}
function seatSub(p, pl){
  if (!UI.online) return p === 0 ? rankName(PR.lv) : STYLE[pl.style];
  const s = UI.online.seatsRel && UI.online.seatsRel[p];
  if (!s) return '';
  return s.cpu ? 'CPU・' + (STYLE[s.style] || '') : (s.lv != null ? rankName(s.lv) : '');
}
function onlineStop(){
  if (R.unsub){ R.unsub(); R.unsub = null; }
  if (R.poll){ clearInterval(R.poll); R.poll = null; }
  R.code = null; R.room = null; R.view = null; R.version = -1; R.eventCount = null; R.overlayKey = null; R.lastPromptKey = null; R.builtFor = null;
}
async function enterRoom(code, first){
  onlineStop();
  R.code = code;
  go('/r/' + code);
  let p = first;
  try{
    if (!p){
      p = await rpc('getRoom', { code });
      if (p.room.mySeat < 0){
        if (p.room.status !== 'lobby'){ toast('この卓はもう始まっています'); return renderLobby(); }
        p = await rpc('joinRoom', { code });
      }
    }
  }catch(x){ toast(x.message); return renderLobby(); }
  if (R.code !== code) return;
  R.unsub = subscribeRoom(p.room.id, msg => {
    R.lastMsg = Date.now();
    if (msg.stamp){ const n = R.room.rules.sanma ? 3 : 4; const rs = (msg.stamp.seat - R.room.mySeat + n) % n; bubble(rs, msg.stamp.text); SFX.pop(); return; }
    if (msg.v && msg.v > R.version) refreshRoom();
  });
  R.poll = setInterval(() => { if (Date.now() - (R.lastMsg || 0) > 8000) refreshRoom(); }, 4000);
  applyRoom(p);
}
let refreshing = false, refreshAgain = false;
async function refreshRoom(){
  if (!R.code) return;
  if (refreshing){ refreshAgain = true; return; }
  refreshing = true;
  try{ const p = await rpc('getRoom', { code: R.code }); applyRoom(p); }catch(e){}
  refreshing = false;
  if (refreshAgain){ refreshAgain = false; refreshRoom(); }
}
function applyRoom(p){
  if (!p || !p.room || (R.code && p.room.code !== R.code)) return;
  if (p.room.version < R.version) return;
  if (p.now) R.offset = p.now - Date.now();
  if (p.room.mySeat < 0 && p.room.status !== 'lobby'){ toast('この卓には参加していません'); onlineStop(); UI.online = null; return renderLobby(); }
  const same = p.room.version === R.version;
  R.room = p.room; R.version = p.room.version;
  const nS = p.room.rules.sanma ? 3 : 4;
  const rel = s => (s - Math.max(0, p.room.mySeat) + nS) % nS;
  const seatsRel = [...Array(nS).keys()].map(i => p.room.seats[(i + Math.max(0, p.room.mySeat)) % nS]);
  UI.online = { seatsRel, code: p.room.code, waitingSeats: [] };
  if (p.room.status === 'lobby'){
    $('#layer').innerHTML = ''; R.eventCount = null; R.builtFor = null; R.overlayKey = null;
    return renderRoom();
  }
  if (same) return;
  if (p.view) R.queue = R.queue.then(() => playView(p.view)).catch(e => console.error(e));
  void rel;
}

function renderRoom(){
  const r = R.room;
  $('#lobby').hidden = true; $('#game').hidden = true; $('#room').hidden = false;
  cancelAnimationFrame(bgAnim);
  const url = `${location.origin}/r/${r.code}`;
  const rules = r.rules;
  const chips = [rules.sanma?'3人打ち':'4人打ち', rules.length==='hanchan'?'半荘戦':'東風戦', rules.aka?'赤あり':'赤なし', rules.kuitan?'喰いタンあり':'喰いタンなし', rules.yakitori?'焼き鳥':'', rules.wareme?'割れ目':'', rules.timer?'持ち時間あり':'持ち時間なし'].filter(Boolean);
  const humans = r.seats.filter(s => s.occupied && !s.cpu).length;
  $('#room').innerHTML = `
    <div class="lb-bg"><div class="lb-table"></div></div>
    <div class="rs-head">
      <div><div class="tname">${esc(rules.name || '')}</div><div class="who">卓番号</div><div class="rcode">${r.code.split('').map(c => `<span>${c}</span>`).join('')}</div></div>
      <div class="rs-meta">${r.groupName ? `<div class="gtag">${esc(r.groupName)}</div>` : '<div class="gtag off">成績は記録しない</div>'}<div class="chips">${chips.map(c => `<span class="chip sh">${c}</span>`).join('')}</div>${rules.batsu?`<div class="pf-sub">罰ゲーム：${esc(rules.batsu)}</div>`:''}</div>
      <button class="ib" type="button" id="rs-leave">退出</button>
    </div>
    <div class="rs-inv">
      <button class="bigbtn slim" id="rs-share" type="button">${canShare() ? '招待を送る' : '招待文をコピー'}</button>
      <a class="bigbtn line" href="${lineUrl(`麻雀横丁で「${rules.name || '卓'}」を立てたよ。卓番号 ${r.code}\n${url}`)}" target="_blank" rel="noopener">LINE</a>
      <button class="bigbtn slim sec" id="rs-copy" type="button">URLをコピー</button>
    </div>
    <div class="seats ${rules.sanma?'three':''}">${r.seats.slice(0, rules.sanma ? 3 : 4).map((s, i) => {
      const w = MJ.WIND[i];
      if (s.occupied) return `<div class="seatc ${s.isMe?'me2':''}"><div class="sw2">${w}</div><div class="ring">${s.cpu ? avatarP({ name: s.name }, i, 120) : avatarP({ name: s.name, avatar: s.avatar }, i, 120)}</div><b>${esc(s.name||'')}</b><span>${s.cpu ? 'CPU・' + STYLE[s.style] : (s.lv!=null?rankName(s.lv):'')}${s.isHost?'・ホスト':''}</span>
        ${r.isHost && s.cpu ? `<div class="seat-ops"><select class="inp" data-style="${i}">${Object.entries(STYLE).map(([k,v]) => `<option value="${k}" ${s.style===k?'selected':''}>${v}</option>`).join('')}</select><button type="button" class="mini" data-open="${i}">外す</button></div>` : ''}
        ${r.isHost && !s.cpu && !s.isMe ? `<div class="seat-ops"><button type="button" class="mini" data-open="${i}">外す</button></div>` : ''}</div>`;
      return `<div class="seatc empty"><div class="sw2">${w}</div><div class="ring ghost"><span>?</span></div><b>招待待ち</b><span>URLか卓番号で参加</span>${r.isHost ? `<div class="seat-ops"><button type="button" class="mini gold" data-cpu="${i}">CPUを入れる</button></div>` : ''}</div>`;
    }).join('')}</div>
    <div class="rs-foot">${r.isHost
      ? `<span class="pf-sub">空いた席はCPUが入ります</span><button class="bigbtn start" id="rs-start" type="button">対局開始</button>`
      : `<span class="waitmsg">ホストの開始を待っています<i></i><i></i><i></i></span>`}</div>`;
  $('#rs-copy').addEventListener('click', () => copyText(url));
  $('#rs-share').addEventListener('click', () => shareInvite(`麻雀横丁で「${rules.name || '卓'}」を立てたよ。卓番号 ${r.code}`, url));
  $('#rs-leave').addEventListener('click', async () => { try{ await rpc('leaveRoom', { code: r.code }); }catch(e){} onlineStop(); UI.online = null; await loadMe().catch(() => {}); renderLobby(); });
  $$('[data-cpu]').forEach(b => b.addEventListener('click', async () => { busy(b, true); try{ applyRoom(await rpc('seatOp', { code: r.code, seat: +b.dataset.cpu, op: 'cpu' })); }catch(x){ toast(x.message); } }));
  $$('[data-open]').forEach(b => b.addEventListener('click', async () => { busy(b, true); try{ applyRoom(await rpc('seatOp', { code: r.code, seat: +b.dataset.open, op: 'open' })); }catch(x){ toast(x.message); } }));
  $$('[data-style]').forEach(el => el.addEventListener('change', async () => { try{ applyRoom(await rpc('seatOp', { code: r.code, seat: +el.dataset.style, op: 'style', style: el.value })); }catch(x){ toast(x.message); } }));
  const stb = $('#rs-start');
  if (stb) stb.addEventListener('click', async () => { audio(); busy(stb, true); try{ applyRoom(await rpc('startGame', { code: r.code })); }catch(x){ toast(x.message); busy(stb, false); } });
  void humans;
}

/* ---------- 対局の画面（サーバーの局面を描く） ---------- */
function viewToGame(v){
  const g = Object.create(Game.prototype);
  Object.assign(g, { rules: v.rules, P: v.P, round: v.round, kyoku: v.kyoku, honba: v.honba, kyotaku: v.kyotaku, handNo: v.handNo, hooks: {} });
  Object.defineProperty(g, 'dealer', { value: v.dealer, writable: true });
  if (v.h){
    const h = Object.assign({}, v.h);
    h.wall = { length: v.h.wallCount };
    h.safeAfter = v.h.safeAfter.map(a => new Set(a));
    h.hands = v.h.hands.map(x => x.slice());
    g.h = h;
  }
  return g;
}
function ensureGameScreen(){
  const key = R.room.id + ':' + (R.room.gameId || 'live');
  if (R.builtFor === key && !$('#game').hidden) return;
  R.builtFor = key;
  $('#lobby').hidden = true; $('#room').hidden = true; $('#game').hidden = false;
  cancelAnimationFrame(bgAnim);
  UI.gen++;
  Object.assign(UI, { pend: null, riichiMode: false, chiPick: false, sel: null, bubbles: {}, menu: null, ak: null, an: null, newAch: [] });
  buildGame();
}
const EV_DELAY = { discard: 480, 'riichi-stick': 0, call: 900, win: 1700, ryuukyoku: 1400, deal: 500 };
async function playView(v){
  if (!R.room || R.room.status === 'lobby') return;
  ensureGameScreen();
  const cont = R.eventCount !== null && v.timelineFrom === R.eventCount;
  if (cont && v.timeline && v.timeline.length){
    for (const it of v.timeline){
      if (it.ev.type === 'end') continue;
      UI.pend = null;
      UI.g = viewToGame(it.state);
      const d = Object.assign({}, it.ev, { game: UI.g });
      if (it.ev.type === 'deal'){ $('#layer').innerHTML = ''; R.overlayKey = null; }
      onEvent(it.ev.type, d);
      let ms = EV_DELAY[it.ev.type] || 300;
      if (it.ev.type === 'discard' && it.ev.seat === 0) ms = 160;
      if (it.ev.type === 'discard' && it.ev.riichi) ms = 1300;
      await sleep(ms);
    }
  }
  R.eventCount = v.eventCount;
  R.view = v;
  UI.g = viewToGame(v);
  UI.online.waitingSeats = (v.waiting || []).filter(w => w.kind !== 'next').map(w => w.seat);
  applyPrompt(v);
}
const srvNow = () => Date.now() + (R.offset || 0);
function applyPrompt(v){
  clearTimer();
  UI.pend = null; UI.riichiMode = false; UI.chiPick = false; UI.sel = null;
  const g = UI.g, pr = v.prompt;
  if (v.final){ render(); showFinalOnline(v); return; }
  if (!v.h || v.h.active || !v.h.result){ if (R.overlayKey){ $('#layer').innerHTML = ''; R.overlayKey = null; } }
  if (pr && (pr.kind === 'self' || pr.kind === 'react')){
    const o = pr.opts;
    const done = a => {
      if (!UI.pend || UI.pend.key !== pr.key) return;
      clearTimer(); UI.pend = null; UI.riichiMode = false; UI.sel = null; UI.chiPick = false;
      optimistic(a); render();
      rpc('act', { code: R.code, key: pr.key, action: a }).then(applyRoom).catch(e => { toast(e.message); refreshRoom(); });
    };
    UI.pend = { kind: pr.kind, o, done, key: pr.key };
    UI.ak = null;
    render();
    if (pr.kind === 'self'){
      if (o.canTsumo && UI.auto.win) return setTimeout(() => done({ type: 'tsumo' }), 300);
      if (o.locked && !o.canTsumo && !o.kita) return setTimeout(() => done({ type: 'discard', id: o.drawn }), 500);
      if (UI.auto.tsumo && o.drawn !== null && !o.canTsumo && !o.riichiIds.length && !o.ankan.length && !o.kakan.length) return setTimeout(() => done({ type: 'discard', id: o.drawn }), 400);
    } else {
      if (o.ron && UI.auto.win) return done({ type: 'ron' });
      if (!o.ron && UI.auto.nocall) return done({ type: 'pass' });
    }
    if (v.rules.timer !== false) startTimerUntil(pr.deadline, () => done(pr.kind === 'self' ? { type: 'discard', id: o.drawn !== null ? o.drawn : UI.g.h.hands[0].filter(x => !o.forbid.includes(tt(x))).pop() } : { type: 'pass' }));
    return;
  }
  render();
  if (v.h && v.h.result && !v.h.active){
    const key = 'res' + v.handNo + ':' + (pr && pr.kind === 'next' ? pr.key : 'wait');
    if (R.overlayKey === key) return;
    const first = !R.overlayKey || !R.overlayKey.startsWith('res' + v.handNo);
    R.overlayKey = key;
    if (pr && pr.kind === 'next'){
      showHandResult(g, v.h.result, { noDelay: true, keep: true }).then(() => {
        rpc('act', { code: R.code, key: pr.key, action: { type: 'next' } }).then(applyRoom).catch(e => toast(e.message));
      });
      if (v.rules.timer !== false) startTimerUntil(pr.deadline, () => { const b = $('#next'); if (b && !b.disabled) b.click(); });
    } else if (first){
      showHandResult(g, v.h.result, { noDelay: true, waiting: true });
    } else {
      const b = $('#next'); if (b){ b.disabled = true; b.textContent = '他のプレイヤーを待っています'; b.classList.add('sec'); }
    }
  }
}
/** 送信直後に手牌から牌を消して反応を速く見せる */
function optimistic(a){
  const g = UI.g; if (!g || !g.h) return;
  if (a.type === 'discard' && g.h.hands[0].includes(a.id)){
    g.h.hands[0] = g.h.hands[0].filter(x => x !== a.id).sort((x, y) => x - y);
    g.h.river[0] = g.h.river[0].concat([{ id: a.id, riichi: !!a.riichi, called: false, tsumogiri: false }]);
    UI.animDiscard = a.id; g.h.lastDiscard = { seat: 0, id: a.id }; g.h.drawnTile = null;
    SFX.clack();
    if (a.riichi){ fxRiichi(g.P[0].name); voice('リーチ', 0); }
  }
}
function startTimerUntil(deadline, onEnd){
  clearTimer();
  const el = $('#tmr'); if (!el) return;
  const total = Math.max(1, (deadline - srvNow()) / 1000);
  el.hidden = false;
  const tick = () => {
    const left = (deadline - srvNow()) / 1000;
    const frac = Math.max(0, Math.min(1, left / total));
    el.innerHTML = `<svg viewBox="0 0 68 68"><circle cx="34" cy="34" r="30" fill="rgba(0,0,0,.6)" stroke="rgba(255,255,255,.12)" stroke-width="5"/><circle cx="34" cy="34" r="30" fill="none" stroke="${left<5?'#e8453a':'#f2cf73'}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${188.5*frac} 999"/></svg><b>${Math.max(0,Math.ceil(left))}</b>`;
    if (left <= 0){ clearTimer(); onEnd(); }
  };
  tick(); UI.timer = setInterval(tick, 250);
}
// 誰かの持ち時間が切れたらサーバーに進行を頼む
setInterval(() => {
  if (!R.code || !R.view || !R.room || R.room.status !== 'playing') return;
  const now = srvNow();
  const expired = (R.view.waiting || []).some(w => w.deadline && now > w.deadline + 1200);
  if (expired && Date.now() - R.tickT > 4000){ R.tickT = Date.now(); rpc('tick', { code: R.code }).then(applyRoom).catch(() => {}); }
}, 1000);

function sendStamp(text){
  bubble(0, text);
  rpc('stamp', { code: R.code, text }).catch(() => {});
}

function showFinalOnline(v){
  if (R.overlayKey === 'final') return;
  R.overlayKey = 'final';
  const final = v.final.slice().sort((a, b) => a.rank - b.rank);
  const me = final.find(f => f.seat === 0);
  if (me && me.rank === 1) unlock('top');
  if (v.P[0].dealIns === 0) unlock('nodealin');
  const rk = v.rank;
  const last = final[final.length - 1];
  const batsu = v.rules.batsu;
  const pct = rk ? (rk.lv >= 15 ? 100 : Math.max(0, Math.min(100, rk.rp / need(rk.lv) * 100))) : 0;
  const html = `<div class="res">
    <div class="res-head"><div class="word">終局</div><div class="nm">${v.rules.name?`<b>${esc(v.rules.name)}</b>`:''}<span>${v.endReason&&v.endReason!=='終局'?esc(v.endReason)+'　':''}${v.rules.sanma?'三麻 ':''}${v.rules.length==='hanchan'?'半荘戦':'東風戦'}${R.room.groupName?'　'+esc(R.room.groupName)+' に記録しました':''}</span></div></div>
    <div class="fin-list">${final.map((f,i) => `<div class="fr ${f.seat===0?'isme':''}" style="animation-delay:${.1+i*.12}s"><span class="rk r${f.rank}"><b>${f.rank}</b>位</span>${avatar(memberOf(f.seat), f.seat)}<span class="nm">${esc(v.P[f.seat].name)}${f.yakitori?'<small>焼き鳥</small>':''}</span><span class="sc">${f.score}</span><span class="pt ${f.pt>0?'plus':f.pt<0?'minus':'zero'}">${f.pt>0?'+':''}${f.pt.toFixed(1)}</span></div>`).join('')}</div>
    <div class="fin-bottom">
      ${rk ? `<div class="rkcard">${emblem(rk.lv)}<div style="flex:1"><div style="font-size:30px">${esc(rankName(rk.lv))} <span class="num ${rk.gain>=0?'plus':'minus'}" style="font-size:32px;margin-left:8px">${rk.gain>0?'+':''}${rk.gain}</span></div>
        ${rk.change?`<div style="color:var(--gold);font-size:24px;margin-top:4px">${rk.change==='up'?'昇段':'降段'} ${esc(rankName(rk.before))} → ${esc(rankName(rk.lv))}</div>`:''}
        <div class="rbar"><i style="width:${pct}%"></i></div><div class="pf-sub">${rk.lv>=15?'最高段位':`${rk.rp} / ${need(rk.lv)} pt`}</div></div></div>` : '<div></div>'}
      ${batsu?`<div class="batsu"><b>罰ゲーム　${esc(v.P[last.seat].name)}</b><span>${esc(batsu)}</span></div>`:'<div></div>'}
    </div>
    <div style="flex:1"></div>
    <div class="res-foot"><button class="bigbtn sec" id="toL" type="button">ホームへ</button>${R.room.isHost?'<button class="bigbtn" id="again" type="button">もう一局</button>':'<span class="waitmsg small">ホストが「もう一局」を押すと卓に戻ります</span>'}</div>
  </div>`;
  setTimeout(() => {
    $('#layer').innerHTML = html; SFX.win(false);
    const ag = $('#again');
    if (ag) ag.addEventListener('click', async () => { busy(ag, true); try{ applyRoom(await rpc('rematch', { code: R.code })); }catch(x){ toast(x.message); busy(ag, false); } });
    $('#toL').addEventListener('click', async () => { onlineStop(); UI.online = null; UI.gen++; UI.g = null; $('#layer').innerHTML = ''; await loadMe().catch(() => {}); renderLobby(); });
  }, 600);
}

function askName(){
  return new Promise(res => {
    $('#lobby').innerHTML = '';
    const body = `<div class="pf-sub" style="font-size:24px">卓でみんなに表示される名前です。あとから変えられます。</div>
      <div class="inline" style="margin-top:20px"><input class="inp" id="nm-first" maxlength="10" placeholder="例：まさ" autocomplete="nickname"><button class="bigbtn slim" id="nm-ok" type="button">決定</button></div>`;
    sheet('名前を決めよう', body, { cls: 'narrow', closeLabel: 'あとで', onClose: () => res() });
    const ok = async () => {
      const v = $('#nm-first').value.trim(); if (!v) return;
      busy($('#nm-ok'), true);
      try{ await rpc('updateProfile', { name: v }); await loadMe(); }catch(x){ toast(x.message); busy($('#nm-ok'), false); return; }
      $('#layer').innerHTML = ''; res();
    };
    $('#nm-ok').addEventListener('click', ok);
    $('#nm-first').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}

/* ============ 起動 ============ */
export async function boot(route){
  stage = $('#stage');
  addEventListener('resize', fit); fit();
  initPhoto();
  applyTheme();
  try{ speechSynthesis.getVoices(); }catch(e){}
  $('#lobby').innerHTML = '<div class="boot">読み込み中…</div>';
  try{
    await netInit();
    await loadMe();
  }catch(e){
    console.error(e);
    $('#lobby').innerHTML = `<div class="boot">サーバーにつながりませんでした。<br>電波の良い場所で再読み込みしてください。<br><small>${esc(e.message||'')}</small></div>`;
    return;
  }
  if (!ME.profile.name || ME.profile.name === 'ななし') await askName();
  if (route && route.kind === 'room' && route.code) return enterRoom(route.code);
  if (route && route.kind === 'group' && route.code){
    try{ const r = await rpc('joinGroup', { code: route.code }); await loadMe(); renderLobby(); return openGroup(r.group.id); }
    catch(x){ toast(x.message); }
  }
  renderLobby();
}
