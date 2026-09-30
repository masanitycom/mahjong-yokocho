'use client';
// 運営用の管理画面（/admin）。主催者・コード・対局・点数の集計を見る。
import { useCallback, useEffect, useMemo, useState } from 'react';

const KEY = 'yk-admin';
const fmtDate = s => { if (!s) return '—'; const d = new Date(s); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
const fmtDT = s => { if (!s) return '—'; const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const ago = s => {
  if (!s) return '—';
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)}分前`; if (m < 1440) return `${Math.floor(m / 60)}時間前`;
  const d = Math.floor(m / 1440); return d < 31 ? `${d}日前` : fmtDate(s);
};
const pt = v => (v > 0 ? '+' : '') + Number(v).toFixed(1);
const ptCls = v => v > 0 ? 'x-plus' : v < 0 ? 'x-minus' : '';
const STATUS = { active: ['有効', 'ok'], suspended: ['停止中', 'ng'] };

function useApi(onAuthFail) {
  return useCallback(async (op, args) => {
    const key = sessionStorage.getItem(KEY) || '';
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': key }, body: JSON.stringify({ op, args: args || {} }) });
    const j = await res.json().catch(() => ({ error: '通信エラーが起きました' }));
    if (res.status === 401) { onAuthFail(j.error); throw new Error(j.error); }
    if (!res.ok) throw new Error(j.error || '通信エラーが起きました');
    return j;
  }, [onAuthFail]);
}

function csvDownload(name, rows) {
  const esc = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const text = '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- 部品 ---------- */
function Avatar({ src, name, size = 36 }) {
  const url = src && src.startsWith('a:') ? `/avatars/${src.slice(2)}.webp` : src;
  return url
    ? <img className="aav" src={url} alt="" style={{ width: size, height: size }} />
    : <span className="aav aini" style={{ width: size, height: size, fontSize: size * .45 }}>{(name || '？').charAt(0)}</span>;
}
function Kpi({ label, value, sub }) {
  return <div className="kpi"><span>{label}</span><b className="x-num">{value}</b>{sub ? <small>{sub}</small> : null}</div>;
}
function Pill({ status }) {
  const [t, c] = STATUS[status] || ['一般', 'mu'];
  return <span className={`pill ${c}`}>{t}</span>;
}
function Empty({ children }) { return <div className="x-empty">{children}</div>; }
/** 1系列の棒グラフ。ホバー／タップで値を出す */
function Bars({ data, unit = '局', labelEvery = 1, height = 180 }) {
  const [hi, setHi] = useState(-1);
  const max = Math.max(1, ...data.map(d => d.value));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  return (
    <div className="bars" style={{ height }} onMouseLeave={() => setHi(-1)}>
      <div className="grid">{[1, .5, 0].map(f => <div key={f}><span className="x-num">{Math.round(nice * f)}</span></div>)}</div>
      <div className="cols">
        {data.map((d, i) => (
          <button key={i} type="button" className={`col ${hi === i ? 'x-on' : ''}`} onMouseEnter={() => setHi(i)} onFocus={() => setHi(i)} onClick={() => setHi(i)} aria-label={`${d.label} ${d.value}${unit}`}>
            <i style={{ height: `${d.value / nice * 100}%` }} />
            {i % labelEvery === 0 || i === data.length - 1 ? <em>{d.short || d.label}</em> : null}
            {hi === i ? <div className="tip"><b className="x-num">{d.value}</b>{unit}<small>{d.label}</small></div> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
function Meter({ label, value }) {
  return <div className="meter"><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><b className="x-num">{value}%</b></div>;
}
function RuleStats({ r }) {
  if (!r || !r.total) return <Empty>この期間の対局はまだありません</Empty>;
  return (
    <div className="rules">
      <div className="meters">
        <Meter label="3人打ち" value={r.sanma} />
        <Meter label="半荘戦" value={r.hanchan} />
        <Meter label="赤ドラあり" value={r.aka} />
        <Meter label="焼き鳥" value={r.yakitori} />
        <Meter label="割れ目" value={r.wareme} />
      </div>
      <div className="umas">
        <h4>よく使われるポイント設定</h4>
        {r.uma.map(u => <div key={u.label} className="uma"><span>{u.label}</span><b className="x-num">{u.count}</b><small>局</small></div>)}
      </div>
    </div>
  );
}
function Results({ list }) {
  return <div className="gres">{list.map((r, i) => (
    <span key={i} className={`x-r x-r${r.rank}`}><em>{r.rank}</em>{r.name}{r.cpu ? <small>CPU</small> : null}<b className={`x-num ${ptCls(r.pt)}`}>{pt(r.pt)}</b></span>
  ))}</div>;
}
function GamesTable({ games, showOrganizer, onOrganizer }) {
  if (!games.length) return <Empty>この期間の対局はまだありません</Empty>;
  return (
    <div className="x-tbl games">
      <div className="x-tr x-th"><span>日時</span>{showOrganizer ? <span>主催者</span> : null}<span>グループ・卓</span><span>ルール</span><span>結果</span></div>
      {games.map(g => (
        <div className="x-tr" key={g.id}>
          <span className="x-dt x-num">{fmtDT(g.endedAt)}</span>
          {showOrganizer ? <span>{g.organizer ? <button type="button" className="link" onClick={() => onOrganizer(g.organizer)}>{g.organizerName || '（不明）'}</button> : '—'}</span> : null}
          <span><b>{g.group || '記録なし'}</b><small>{g.rules.name}</small></span>
          <span className="rl">{g.rules.mode}・{g.rules.length}<small>{g.rules.uma}{g.rules.oka ? '・オカあり' : ''}{g.rules.options.length ? '・' + g.rules.options.join('・') : ''}</small></span>
          <span><Results list={g.results} /></span>
        </div>
      ))}
    </div>
  );
}
function gamesCsv(name, games) {
  csvDownload(name, [['終了日時', '主催者', 'グループ', '卓名', '人数', '長さ', 'ウマ', 'オカ', 'ルール', '1位', '1位pt', '2位', '2位pt', '3位', '3位pt', '4位', '4位pt']].concat(
    games.map(g => {
      const r = [0, 1, 2, 3].map(i => g.results[i]).flatMap(x => x ? [x.name + (x.cpu ? '(CPU)' : ''), x.pt] : ['', '']);
      return [new Date(g.endedAt).toLocaleString('ja-JP'), g.organizerName || '', g.group || '', g.rules.name, g.rules.mode, g.rules.length, g.rules.uma, g.rules.oka ? 'あり' : 'なし', g.rules.options.join(' '), ...r];
    })));
}

/* ---------- 画面 ---------- */
function Overview({ api, go }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('overview').then(setD, e => setErr(e.message)); }, [api]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="loading">読み込み中…</div>;
  const k = d.kpi;
  const daily = d.daily.map(x => ({ label: x.day.replace(/^\d+-0?(\d+)-0?(\d+)$/, '$1月$2日'), short: x.day.replace(/^\d+-0?(\d+)-0?(\d+)$/, '$1/$2'), value: x.games }));
  return (
    <>
      <div className="kpis">
        <Kpi label="主催者" value={k.organizers} sub={`30日で遊んだ ${k.activeOrganizers}人${k.suspended ? `・停止中 ${k.suspended}人` : ''}`} />
        <Kpi label="プレイヤー" value={k.players} sub={`30日で遊んだ ${k.activePlayers}人`} />
        <Kpi label="対局（30日）" value={k.games30} sub={`通算 ${k.games}局`} />
        <Kpi label="今日の対局" value={k.gamesToday} />
      </div>
      <section className="card">
        <h3>日ごとの対局数<small>直近30日</small></h3>
        <Bars data={daily} labelEvery={5} />
      </section>
      <div className="two">
        <section className="card">
          <h3>よく遊んでいる主催者<small>直近30日</small></h3>
          {d.topOrganizers.length ? <div className="rank">{d.topOrganizers.map((o, i) => (
            <button type="button" key={o.id} className="rrow" onClick={() => go('org', o.id)}>
              <span className="x-n x-num">{i + 1}</span><span className="x-nm">{o.name}</span><b className="x-num">{o.games}</b><small>局</small>
            </button>))}</div> : <Empty>まだ対局がありません</Empty>}
        </section>
        <section className="card">
          <h3>遊ばれているルール<small>直近30日</small></h3>
          <RuleStats r={d.rules} />
        </section>
      </div>
    </>
  );
}

function Organizers({ api, go }) {
  const [d, setD] = useState(null), [q, setQ] = useState(''), [err, setErr] = useState('');
  useEffect(() => { api('organizers').then(setD, e => setErr(e.message)); }, [api]);
  const list = useMemo(() => !d ? [] : d.organizers.filter(o => !q || (o.name || '').includes(q) || (o.code && (o.code.label || '').includes(q)) || (o.note || '').includes(q)), [d, q]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="loading">読み込み中…</div>;
  return (
    <section className="card">
      <div className="x-bar">
        <h3>主催者<small>{d.organizers.length}人</small></h3>
        <input className="ainp" placeholder="名前・コードのメモで探す" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {!list.length ? <Empty>{d.organizers.length ? '見つかりません' : 'まだ主催者はいません。「主催者コード」でコードを発行して渡してください'}</Empty> : (
        <div className="x-tbl orgs">
          <div className="x-tr x-th"><span>主催者</span><span>状態</span><span className="x-r">グループ</span><span className="x-r">対局 30日</span><span className="x-r">通算</span><span className="x-r">プレイヤー</span><span>最終対局</span></div>
          {list.map(o => (
            <button type="button" className="x-tr click" key={o.id} onClick={() => go('org', o.id)}>
              <span className="x-who"><Avatar src={o.avatar} name={o.name} /><span><b>{o.name}</b><small>{o.code ? `${o.code.label || 'ラベルなし'}・${o.code.code}` : '既存の利用者'}</small></span></span>
              <span><Pill status={o.status} /></span>
              <span className="x-r x-num">{o.groups}</span>
              <span className="x-r x-num strong">{o.games30}</span>
              <span className="x-r x-num">{o.games}</span>
              <span className="x-r x-num">{o.players}</span>
              <span className="mu">{ago(o.lastGameAt)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function OrganizerDetail({ api, id, back }) {
  const [period, setPeriod] = useState('all'), [d, setD] = useState(null), [err, setErr] = useState(''), [note, setNote] = useState(''), [saving, setSaving] = useState(false);
  const load = useCallback(() => api('organizer', { id, period }).then(x => { setD(x); setNote(x.organizer.note); }, e => setErr(e.message)), [api, id, period]);
  useEffect(() => { load(); }, [load]);
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="loading">読み込み中…</div>;
  const o = d.organizer;
  const setStatus = async status => {
    if (status === 'suspended' && !confirm(`${o.name} さんの主催者の利用を停止します。卓を立てる・グループを作ることができなくなります（これまでの記録は残ります）。`)) return;
    setSaving(true); try { await api('setOrganizer', { id: o.id, status }); await load(); } catch (e) { alert(e.message); } setSaving(false);
  };
  const saveNote = async () => { setSaving(true); try { await api('setOrganizer', { id: o.id, note }); await load(); } catch (e) { alert(e.message); } setSaving(false); };
  const months = d.months.slice().reverse().slice(-12).map(m => ({ label: m.key.replace(/^(\d+)-0?(\d+)$/, '$1年$2月'), short: m.key.replace(/^\d+-0?(\d+)$/, '$1月'), value: m.games }));
  return (
    <>
      <button type="button" className="back" onClick={back}>← 主催者一覧</button>
      <section className="card head">
        <Avatar src={o.avatar} name={o.name} size={72} />
        <div className="hinfo">
          <div className="hname"><b>{o.name}</b><Pill status={o.status} /></div>
          <div className="mu">主催者になった日 {fmtDate(o.since)}{o.code ? `・コード ${o.code.code}（${o.code.label || 'ラベルなし'}）` : ''}</div>
          <div className="note"><input className="ainp" value={note} maxLength={400} placeholder="運営メモ（本人には見えません）" onChange={e => setNote(e.target.value)} />
            <button type="button" className="btn x-sub" disabled={saving || note === o.note} onClick={saveNote}>メモを保存</button></div>
        </div>
        <div className="hact">
          {o.status === 'active'
            ? <button type="button" className="btn danger" disabled={saving} onClick={() => setStatus('suspended')}>利用を停止</button>
            : <button type="button" className="btn" disabled={saving} onClick={() => setStatus('active')}>{o.status === 'suspended' ? '利用を再開' : '主催者にする'}</button>}
        </div>
      </section>
      <div className="x-bar">
        <div className="seg">
          <button type="button" className={period === 'all' ? 'x-on' : ''} onClick={() => setPeriod('all')}>通算</button>
          <button type="button" className={period === 'days:30' ? 'x-on' : ''} onClick={() => setPeriod('days:30')}>30日</button>
          <select className="ainp x-sel" value={period.startsWith('month:') ? period : ''} onChange={e => e.target.value && setPeriod(e.target.value)}>
            <option value="">月を選ぶ</option>
            {d.months.map(m => <option key={m.key} value={'month:' + m.key}>{m.key.replace('-', '年') + '月'}（{m.games}局）</option>)}
          </select>
        </div>
        <span className="mu">{d.periodLabel}の集計</span>
      </div>
      <div className="kpis">
        <Kpi label="対局" value={d.kpi.games} sub={`通算 ${d.kpi.totalGames}局`} />
        <Kpi label="プレイヤー" value={d.kpi.players} sub="この期間に遊んだ人" />
        <Kpi label="グループ" value={d.kpi.groups} />
      </div>
      <section className="card">
        <div className="x-bar"><h3>プレイヤーの成績<small>{d.periodLabel}・合計ptの順</small></h3>
          {d.ranking.length ? <button type="button" className="btn x-sub" onClick={() => csvDownload(`${o.name}_成績_${d.periodLabel}.csv`, [['順位', '名前', '対局', '合計pt', '平均順位', 'トップ率', 'ラス率', '和了率', '放銃率', '最高打点', '最終対局']].concat(d.ranking.map((r, i) => [i + 1, r.name, r.games, r.pt, r.avgRank, r.topRate + '%', r.lastRate + '%', r.winRate + '%', r.dealInRate + '%', r.best || '', fmtDate(r.last)])))}>CSVで保存</button> : null}
        </div>
        {!d.ranking.length ? <Empty>この期間の対局はまだありません</Empty> : (
          <div className="x-tbl ranking">
            <div className="x-tr x-th"><span className="x-r">#</span><span>名前</span><span className="x-r">対局</span><span className="x-r">合計pt</span><span className="x-r">平均順位</span><span className="x-r">トップ率</span><span className="x-r">ラス率</span><span className="x-r">和了率</span><span className="x-r">放銃率</span><span className="x-r">最高打点</span></div>
            {d.ranking.map((r, i) => (
              <div className="x-tr" key={r.userId}>
                <span className={`x-r x-num x-n${i < 3 ? i + 1 : ''}`}>{i + 1}</span>
                <span className="x-who"><Avatar src={r.avatar} name={r.name} size={30} /><b>{r.name}</b></span>
                <span className="x-r x-num">{r.games}</span>
                <span className={`x-r x-num strong ${ptCls(r.pt)}`}>{pt(r.pt)}</span>
                <span className="x-r x-num">{r.avgRank.toFixed(2)}</span>
                <span className="x-r x-num">{r.topRate}%</span>
                <span className="x-r x-num">{r.lastRate}%</span>
                <span className="x-r x-num">{r.winRate}%</span>
                <span className="x-r x-num">{r.dealInRate}%</span>
                <span className="x-r x-num">{r.best ? r.best.toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="two">
        <section className="card">
          <h3>月ごとの対局数</h3>
          {months.length ? <Bars data={months} height={160} /> : <Empty>まだ対局がありません</Empty>}
        </section>
        <section className="card">
          <h3>遊んでいるルール<small>{d.periodLabel}</small></h3>
          <RuleStats r={d.rules} />
        </section>
      </div>
      <section className="card">
        <h3>グループ<small>{d.groups.length}</small></h3>
        {!d.groups.length ? <Empty>まだグループはありません</Empty> : (
          <div className="x-tbl groups">
            <div className="x-tr x-th"><span>グループ</span><span>招待コード</span><span className="x-r">メンバー</span><span className="x-r">対局（{d.periodLabel}）</span><span>作成日</span></div>
            {d.groups.map(g => <div className="x-tr" key={g.id}><span><b>{g.name}</b></span><span className="x-num mu">{g.code}</span><span className="x-r x-num">{g.members}</span><span className="x-r x-num">{g.games}</span><span className="mu">{fmtDate(g.createdAt)}</span></div>)}
          </div>
        )}
      </section>
      <section className="card">
        <div className="x-bar"><h3>最近の対局<small>{d.periodLabel}・最大50件</small></h3>
          {d.recent.length ? <button type="button" className="btn x-sub" onClick={() => gamesCsv(`${o.name}_対局_${d.periodLabel}.csv`, d.recent)}>CSVで保存</button> : null}</div>
        <GamesTable games={d.recent} />
      </section>
    </>
  );
}

function Codes({ api, go }) {
  const [d, setD] = useState(null), [err, setErr] = useState(''), [form, setForm] = useState({ label: '', maxUses: 1, days: 0, count: 1 }), [fresh, setFresh] = useState([]), [busy, setBusy] = useState(false), [copied, setCopied] = useState('');
  const load = useCallback(() => api('codes').then(setD, e => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);
  const copy = t => { navigator.clipboard.writeText(t).then(() => { setCopied(t); setTimeout(() => setCopied(''), 1500); }); };
  const create = async e => {
    e.preventDefault(); setBusy(true);
    try { const r = await api('createCodes', form); setFresh(r.codes.map(c => c.code)); setForm(f => ({ ...f, label: '' })); await load(); } catch (x) { alert(x.message); }
    setBusy(false);
  };
  const toggle = async c => {
    if (!c.revoked && !confirm(`${c.code} を無効にします。まだ使っていない人は、このコードで主催者になれなくなります（すでに主催者の人はそのまま）。`)) return;
    try { await api('setCode', { id: c.id, revoked: !c.revoked }); await load(); } catch (x) { alert(x.message); }
  };
  if (err) return <div className="err">{err}</div>;
  if (!d) return <div className="loading">読み込み中…</div>;
  const state = c => c.revoked ? ['無効', 'ng'] : c.uses >= c.maxUses ? ['使用済み', 'mu'] : c.expiresAt && new Date(c.expiresAt) < new Date() ? ['期限切れ', 'mu'] : ['未使用あり', 'ok'];
  return (
    <>
      <section className="card">
        <h3>主催者コードを発行</h3>
        <form className="issue" onSubmit={create}>
          <label><span>メモ（誰に渡すか）</span><input className="ainp" maxLength={40} value={form.label} placeholder="例：田中さん（駅前の雀荘）" onChange={e => setForm({ ...form, label: e.target.value })} /></label>
          <label><span>使える人数</span><select className="ainp x-sel" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: Number(e.target.value) })}>{[1, 3, 5, 10, 30, 100].map(n => <option key={n} value={n}>{n}人</option>)}</select></label>
          <label><span>有効期限</span><select className="ainp x-sel" value={form.days} onChange={e => setForm({ ...form, days: Number(e.target.value) })}><option value={0}>なし</option><option value={7}>7日</option><option value={30}>30日</option><option value={90}>90日</option></select></label>
          <label><span>枚数</span><select className="ainp x-sel" value={form.count} onChange={e => setForm({ ...form, count: Number(e.target.value) })}>{[1, 5, 10, 20].map(n => <option key={n} value={n}>{n}枚</option>)}</select></label>
          <button className="btn" type="submit" disabled={busy}>発行する</button>
        </form>
        {fresh.length ? (
          <div className="fresh">
            <div className="mu">発行しました。コピーして主催者に渡してください（アプリの「卓を立てる」から入力します）</div>
            <div className="fcodes">{fresh.map(c => <button type="button" key={c} className="fcode x-num" onClick={() => copy(c)}>{c}<small>{copied === c ? 'コピーしました' : 'コピー'}</small></button>)}</div>
            {fresh.length > 1 ? <button type="button" className="btn x-sub" onClick={() => copy(fresh.join('\n'))}>{copied === fresh.join('\n') ? 'コピーしました' : 'まとめてコピー'}</button> : null}
          </div>
        ) : null}
      </section>
      <section className="card">
        <h3>発行したコード<small>{d.codes.length}</small></h3>
        {!d.codes.length ? <Empty>まだ発行していません</Empty> : (
          <div className="x-tbl codes">
            <div className="x-tr x-th"><span>コード</span><span>メモ</span><span className="x-r">使用</span><span>期限</span><span>状態</span><span>使った人</span><span /></div>
            {d.codes.map(c => { const [t, cl] = state(c); return (
              <div className="x-tr" key={c.id}>
                <span><button type="button" className="code x-num" onClick={() => copy(c.code)} title="コピー">{c.code}</button>{copied === c.code ? <small className="ok">コピーしました</small> : null}</span>
                <span>{c.label || <span className="mu">—</span>}</span>
                <span className="x-r x-num">{c.uses}/{c.maxUses}</span>
                <span className="mu">{c.expiresAt ? fmtDate(c.expiresAt) : 'なし'}</span>
                <span><span className={`pill ${cl}`}>{t}</span></span>
                <span className="users">{c.usedBy.length ? c.usedBy.map(u => <button type="button" key={u.id} className="link" onClick={() => go('org', u.id)}>{u.name}</button>) : <span className="mu">—</span>}</span>
                <span className="x-r"><button type="button" className={`btn x-mini ${c.revoked ? '' : 'x-ghost'}`} onClick={() => toggle(c)}>{c.revoked ? '有効に戻す' : '無効にする'}</button></span>
              </div>); })}
          </div>
        )}
      </section>
    </>
  );
}

function Games({ api, go }) {
  const [period, setPeriod] = useState('days:30'), [org, setOrg] = useState(''), [orgs, setOrgs] = useState([]), [d, setD] = useState(null), [err, setErr] = useState('');
  useEffect(() => { api('organizers').then(x => setOrgs(x.organizers), () => {}); }, [api]);
  useEffect(() => { setD(null); api('games', { period, organizer: org || undefined }).then(setD, e => setErr(e.message)); }, [api, period, org]);
  const months = useMemo(() => { const out = []; const n = new Date(); for (let i = 0; i < 12; i++) { const d = new Date(n.getFullYear(), n.getMonth() - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); } return out; }, []);
  if (err) return <div className="err">{err}</div>;
  return (
    <section className="card">
      <div className="x-bar">
        <h3>対局<small>{d ? `${d.periodLabel}・${d.games.length}局` : ''}</small></h3>
        <div className="filters">
          <select className="ainp x-sel" value={org} onChange={e => setOrg(e.target.value)}><option value="">すべての主催者</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <select className="ainp x-sel" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="days:7">直近7日</option><option value="days:30">直近30日</option><option value="days:90">直近90日</option>
            {months.map(m => <option key={m} value={'month:' + m}>{m.replace('-', '年')}月</option>)}
            <option value="all">通算</option>
          </select>
          <button type="button" className="btn x-sub" disabled={!d || !d.games.length} onClick={() => gamesCsv(`対局_${d.periodLabel}.csv`, d.games)}>CSVで保存</button>
        </div>
      </div>
      {!d ? <div className="loading">読み込み中…</div> : <GamesTable games={d.games.slice(0, 300)} showOrganizer onOrganizer={id => go('org', id)} />}
      {d && d.games.length > 300 ? <div className="mu" style={{ marginTop: 12 }}>画面には300局まで表示しています。全件はCSVで保存してください。</div> : null}
    </section>
  );
}

function Login({ onOk, msg }) {
  const [v, setV] = useState(''), [err, setErr] = useState(msg || ''), [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); if (!v) return; setBusy(true); setErr('');
    sessionStorage.setItem(KEY, v);
    const res = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': v }, body: JSON.stringify({ op: 'overview' }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onOk(); else { sessionStorage.removeItem(KEY); setErr(j.error || 'ログインできませんでした'); }
  };
  return (
    <div className="login">
      <form className="lcard" onSubmit={submit}>
        <div className="alogo">麻雀横丁<small>運営管理</small></div>
        <input className="ainp" type="password" autoFocus autoComplete="current-password" placeholder="管理パスワード" value={v} onChange={e => setV(e.target.value)} />
        <button className="btn" type="submit" disabled={busy}>{busy ? '確認中…' : 'ログイン'}</button>
        {err ? <div className="err">{err}</div> : null}
      </form>
    </div>
  );
}

const TABS = [['overview', '概要'], ['orgs', '主催者'], ['codes', '主催者コード'], ['games', '対局']];
export default function Admin() {
  const [authed, setAuthed] = useState(null), [msg, setMsg] = useState(''), [tab, setTab] = useState('overview'), [orgId, setOrgId] = useState(null);
  useEffect(() => { setAuthed(!!sessionStorage.getItem(KEY)); }, []);
  const onAuthFail = useCallback(m => { sessionStorage.removeItem(KEY); setMsg(m || ''); setAuthed(false); }, []);
  const api = useApi(onAuthFail);
  const go = useCallback((t, id) => { if (t === 'org') { setTab('orgs'); setOrgId(id); } else { setTab(t); setOrgId(null); } window.scrollTo?.(0, 0); document.querySelector('.adm')?.scrollTo(0, 0); }, []);
  if (authed === null) return <div className="adm" />;
  return (
    <div className="adm">
      {!authed ? <Login msg={msg} onOk={() => { setMsg(''); setAuthed(true); }} /> : (
        <>
          <header className="top">
            <div className="brand">麻雀横丁<small>運営管理</small></div>
            <nav>{TABS.map(([k, t]) => <button type="button" key={k} className={tab === k ? 'x-on' : ''} onClick={() => go(k)}>{t}</button>)}</nav>
            <button type="button" className="out" onClick={() => { sessionStorage.removeItem(KEY); setAuthed(false); }}>ログアウト</button>
          </header>
          <main className="main">
            {tab === 'overview' ? <Overview api={api} go={go} /> : null}
            {tab === 'orgs' ? (orgId ? <OrganizerDetail key={orgId} api={api} id={orgId} back={() => setOrgId(null)} /> : <Organizers api={api} go={go} />) : null}
            {tab === 'codes' ? <Codes api={api} go={go} /> : null}
            {tab === 'games' ? <Games api={api} go={go} /> : null}
          </main>
        </>
      )}
    </div>
  );
}
