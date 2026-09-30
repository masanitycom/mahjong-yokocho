# 麻雀横丁

仲間内で打てる4人打ち・3人打ち（三麻・北抜き）麻雀のWebサービス。
部屋を立ててLINEで招待、成績はグループごとに記録される。

- Next.js 15（App Router）＋ Supabase（Postgres / 匿名ログイン / Realtime）＋ Vercel
- 対局の進行はすべてサーバー側。牌山と他人の手牌はブラウザに送らない
- 対局は「シード＋人間の判断ログ」だけを保存し、毎回サーバーで再生して局面を作る（`lib/server/replay.js`）

## 構成

| 場所 | 中身 |
|---|---|
| `lib/engine.js` | ルールエンジン（和了判定・役・符・点数・CPU思考・進行） |
| `lib/server/replay.js` | 判断ログからの再生、持ち時間切れの自動処理、席ごとの画面データ生成 |
| `lib/server/ops.js` | API の中身（プロフィール・グループ・卓・対局・結果保存・段位） |
| `lib/server/store.js` | データの読み書き。Supabase 版と、ローカル検証用のメモリ版 |
| `app/api/rpc/route.js` | API の入口（`{op, args}` を POST） |
| `lib/client/app.js` | 画面（ロビー・卓・対局・グループ・成績） |
| `supabase/migrations/0001_init.sql` | テーブル定義 |

## ローカルで動かす

Supabase の環境変数がなければ、メモリ保存・ログイン不要のローカル検証モードで動く。

```bash
npm install
npm run dev
# http://localhost:3000
```

別ブラウザ（またはシークレットウィンドウ）で開けば別のプレイヤーになる。

## 本番の準備

### 1. Supabase

1. 新しいプロジェクトを作る（リージョンは Tokyo）
2. SQL Editor で `supabase/migrations/` の SQL を番号順（0001 → 0004）にすべて実行
3. Authentication → Sign In / Providers → **Allow anonymous sign-ins** をオン
4. Authentication → URL Configuration の Site URL に本番URL（例 `https://mahjong-yokocho.vercel.app`）を入れる
5. Project Settings → API Keys で次の3つを控える
   - Project URL
   - anon（public）キー
   - service_role（secret）キー

### 2. Vercel

1. GitHub のリポジトリをインポート（Framework は Next.js のまま）
2. Environment Variables に登録

| 名前 | 値 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon キー |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role キー（公開しない） |
| `NEXT_PUBLIC_SITE_URL` | 本番URL（LINE共有のサムネイル用） |
| `CLOUDFLARE_TURN_KEY_ID` | 通話用。Cloudflare Realtime の TURN キーID（任意） |
| `CLOUDFLARE_TURN_API_TOKEN` | 通話用。上のキーの API トークン（Secret、任意） |
| `ADMIN_PASSWORD` | 運営管理画面（`/admin`）のパスワード（Secret） |

3. Deploy

## テスト

```bash
npm run test:engine   # サーバー再生で1局通し、手牌が他人に漏れないこと・持ち時間切れで進むことを確認
```

## 音声・BGM

- 鳴き・和了の声（`public/voice/`）は VOICEVOX で生成。クレジット表記が必要：
  VOICEVOX:ずんだもん、四国めたん、青山龍星、玄野武宏、白上虎太郎、九州そら、春日部つむぎ、No.7
  （アプリ内のホームと設定画面に表示している。各キャラクターの利用規約に従うこと）
- BGM（`public/bgm/lobby.mp3` ホーム用、`public/bgm/table.mp3` 対局用）は自作（プログラムで作曲・合成）。
  同じファイル名で差し替えれば別の曲にできる。ループ用に曲の前後へ0.5秒ずつ「曲の末尾／頭」をつなげた形で書き出している

## 通話

卓の参加者同士を WebRTC で直接つなぐ（P2P、最大4人の音声のみ）。接続の合図は `/api/rpc` の `rtc` 操作で中継し、Supabase Realtime で相手に届ける。
TURN の環境変数がない場合は STUN だけで接続する（一部のスマホ回線ではつながらないことがある）。

## 主催者と運営管理画面

- 卓を立てる・グループを作るには「主催者」になる必要がある。主催者には、運営が発行した主催者コード（`YK-XXXX-XXXX`）をアプリで入力してなる
- 誘われて遊ぶ人はコード不要（URL・卓番号・グループの招待で参加）。主催者のグループのメンバーは、そのグループの卓なら立てられる
- `0004_organizers.sql` を実行した時点で、すでにグループを作った人・卓を立てた人は自動で主催者になる。実行前は制限なしで今まで通り動く
- `/admin`（`ADMIN_PASSWORD` でログイン）
  - 概要：主催者数・プレイヤー数・対局数、日ごとの対局数、よく遊ばれているルール、よく遊んでいる主催者
  - 主催者：一覧と詳細（グループ、プレイヤーごとの合計pt・平均順位・トップ率などの成績、ルールの傾向、最近の対局）。期間は通算・30日・月ごと。利用の停止／再開、運営メモ。CSV保存
  - 主催者コード：発行（メモ・使える人数・有効期限・枚数）、使った人の確認、無効化
  - 対局：主催者・期間で絞り込み、CSV保存
- ローカル検証モードではパスワード `dev`。デモデータは `/api/admin` の `seedDemo` 操作で入れられる（メモリ保存のときだけ）
