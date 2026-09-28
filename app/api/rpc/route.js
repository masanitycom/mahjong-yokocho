import { OPS, ApiError } from '../../../lib/server/ops.js';
import { store, isDev } from '../../../lib/server/store.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : (isDev ? req.headers.get('x-dev-user') : null);
    const user = await store.userFromToken(token);
    if (!user) return Response.json({ error: 'ログインが切れました。ページを再読み込みしてください' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const fn = OPS[body.op];
    if (!fn) return Response.json({ error: '不明な操作です' }, { status: 400 });
    const data = await fn(user, body.args || {});
    return Response.json(data);
  } catch (e) {
    if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: 'サーバーでエラーが起きました' }, { status: 500 });
  }
}
