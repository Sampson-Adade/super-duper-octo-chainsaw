import { experimental_upgradeWebSocket } from '@vercel/functions';
import { handleWebSocket } from '../../../lib/vercel-socket';

export const runtime = 'nodejs';
export const maxDuration = 300;

export function GET() {
  if (!process.env.REDIS_URL) {
    return Response.json({ ok: false, error: 'Room storage is not configured yet.' }, { status: 503 });
  }
  return experimental_upgradeWebSocket((ws) => handleWebSocket(ws));
}
