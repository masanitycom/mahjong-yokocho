// ローカル検証用の通知（本番は Supabase Realtime を使う）
import { store, isDev } from '../../../lib/server/store.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req) {
  if (!isDev) return new Response('not found', { status: 404 });
  const room = new URL(req.url).searchParams.get('room');
  const bus = store.bus;
  let handler, timer;
  const stream = new ReadableStream({
    start(c) {
      const enc = new TextEncoder();
      handler = p => c.enqueue(enc.encode(`data: ${JSON.stringify(p)}\n\n`));
      bus.on('room-' + room, handler);
      timer = setInterval(() => c.enqueue(enc.encode(': ping\n\n')), 15000);
      c.enqueue(enc.encode(': ok\n\n'));
    },
    cancel() { bus.off('room-' + room, handler); clearInterval(timer); }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
}
