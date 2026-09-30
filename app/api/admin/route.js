import { ADMIN_OPS, checkAdmin, adminPasswordConfigured } from '../../../lib/server/admin.js';
import { ApiError } from '../../../lib/server/ops.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function POST(req) {
  try {
    if (!adminPasswordConfigured()) return Response.json({ error: '管理画面のパスワード（ADMIN_PASSWORD）が設定されていません' }, { status: 503 });
    if (!checkAdmin(req.headers.get('x-admin-key'))) { await sleep(800); return Response.json({ error: 'パスワードが違います' }, { status: 401 }); }
    const body = await req.json().catch(() => ({}));
    const fn = ADMIN_OPS[body.op];
    if (!fn) return Response.json({ error: '不明な操作です' }, { status: 400 });
    return Response.json(await fn(body.args || {}));
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    const hint = /organizer/.test(e.message || '') ? '（supabase/migrations/0004_organizers.sql を実行してください）' : '';
    return Response.json({ error: 'サーバーでエラーが起きました' + hint }, { status: 500 });
  }
}
