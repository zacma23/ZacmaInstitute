import type { IncomingMessage, ServerResponse } from 'http';
import { handleAiChat } from '../../server/handlers.ts';

type VercelReq = IncomingMessage & { method?: string; body?: Record<string, unknown> };
type VercelRes = ServerResponse & {
  status: (code: number) => VercelRes;
  json: (data: unknown) => void;
};

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const out = await handleAiChat((req.body || {}) as Parameters<typeof handleAiChat>[0]);
  return res.status(out.status).json(out.body);
}
