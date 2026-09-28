import { isDev } from '../../../lib/server/store.js';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ dev: isDev, supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null });
}
