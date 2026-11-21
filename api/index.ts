import type { IncomingMessage, ServerResponse } from 'http';
import {
  handleAiChat,
  handleAiChatStream,
  handleAiSecurityAudit,
  handleCronReminders,
  handleDispatchExternal,
  handleHealth,
  handleRecordReminderRun,
  handleSetupStatus,
  handleSmsBalance,
  handleSmsSend,
  handleSmsStatus,
  handleVerifyPlatformAdmin,
  type ServerSmsProvider,
} from '../server/handlers.ts';
import {
  handleLoginAttempt,
  handleSessionCreate,
  handleSessionLogout,
  handleSessionRefresh,
  handleSessionValidate,
} from '../server/sessionManager.ts';
import {
  handleChapaInitialize,
  handleChapaStatus,
  handleChapaVerify,
  handleChapaWebhook,
  type ChapaInitializePayload,
  type ChapaVerifyParams,
} from '../server/chapaGateway.ts';
import { handleScanIdDocument, type ScanIdRequestBody } from '../server/idScanner.ts';
import {
  buildRateLimitHeaders,
  checkApiRateLimit,
  extractClientIp,
} from '../server/rateLimiter.ts';

type VercelReq = IncomingMessage & {
  method?: string;
  url?: string;
  body?: unknown;
  rawBody?: string | Buffer;
  query?: Record<string, string | string[] | undefined>;
};

type VercelRes = ServerResponse & {
  status?: (code: number) => VercelRes;
  json?: (data: unknown) => void;
};

function sendJson(res: VercelRes, status: number, body: unknown): void {
  if (typeof res.status === 'function') {
    const statusRes = res.status(status);
    if (typeof statusRes.json === 'function') {
      statusRes.json(body);
      return;
    }
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getQueryParam(
  url: URL,
  reqQuery: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  const fromUrl = url.searchParams.get(key);
  if (fromUrl !== null) return fromUrl;
  const fromReq = reqQuery?.[key];
  if (Array.isArray(fromReq)) return fromReq[0];
  return typeof fromReq === 'string' ? fromReq : undefined;
}

function resolveRoutePath(req: VercelReq): { routePath: string; parsedUrl: URL } {
  const parsedUrl = new URL(req.url || '/api', 'http://localhost');
  const routeParam = getQueryParam(parsedUrl, req.query, '__route');
  let routePath = parsedUrl.pathname;
  if ((routePath === '/api/index' || routePath === '/api') && routeParam) {
    routePath = `/api/${routeParam.replace(/^\/+/, '')}`;
  }
  routePath = routePath.replace(/\/+$/, '') || '/api';
  return { routePath, parsedUrl };
}

function resolveRequestOrigin(req: VercelReq): string | undefined {
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const protoHeader = req.headers['x-forwarded-proto'] || 'https';
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  if (host) {
    return `${proto}://${host}`;
  }
  return undefined;
}

function isSecureRequest(req: VercelReq): boolean {
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return process.env.NODE_ENV === 'production' || proto === 'https';
}

async function readRawBody(req: VercelReq): Promise<string> {
  if (typeof req.rawBody === 'string') return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function parseJsonBody(req: VercelReq): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body as Record<string, unknown>;
  }
  const raw = await readRawBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function applyNoStoreHeaders(res: VercelRes, setCookie?: string): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  if (setCookie) {
    res.setHeader('Set-Cookie', setCookie);
  }
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  const method = (req.method || 'GET').toUpperCase();
  const { routePath, parsedUrl } = resolveRoutePath(req);
  const authHeader =
    typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;

  try {
    // Enforce server-side API rate limiting across all Vercel serverless routes
    const clientIp = extractClientIp(
      req.headers as Record<string, string | string[] | undefined>,
      req.socket?.remoteAddress
    );
    const rl = checkApiRateLimit(routePath, clientIp);
    const rlHeaders = buildRateLimitHeaders(rl);
    Object.entries(rlHeaders).forEach(([k, v]) => res.setHeader(k, v));
    if (!rl.allowed) {
      applyNoStoreHeaders(res);
      sendJson(res, 429, {
        code: 'RATE_LIMIT_EXCEEDED',
        error: `Too many requests to ${rl.bucket} API. Please retry after ${rl.retryAfterSec} seconds.`,
        retryAfterSec: rl.retryAfterSec,
      });
      return;
    }

    // Health & Platform Setup
    if (routePath === '/api/health') {
      const out = handleHealth();
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/setup/status') {
      const out = await handleSetupStatus(process.cwd());
      sendJson(res, out.status, out.body);
      return;
    }

    // Scheduled Reminders & External Dispatch
    if (routePath === '/api/cron/reminders') {
      const out = await handleCronReminders(authHeader);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/reminders/dispatch-external') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = await handleDispatchExternal(body as Parameters<typeof handleDispatchExternal>[0]);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/reminders/record-run') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = handleRecordReminderRun(body as Parameters<typeof handleRecordReminderRun>[0]);
      sendJson(res, out.status, out.body);
      return;
    }

    // Centralized AI Engine & OCR Document Scanner
    if (routePath === '/api/ai/chat') {
      applyNoStoreHeaders(res);
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = await handleAiChat(body as Parameters<typeof handleAiChat>[0], authHeader);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/ai/chat/stream') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      let headersSent = false;
      const ensureSseHeaders = () => {
        if (headersSent) return;
        headersSent = true;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
      };

      const body = await parseJsonBody(req);
      await handleAiChatStream(
        body as Parameters<typeof handleAiChatStream>[0],
        {
          onDelta: (delta) => {
            ensureSseHeaders();
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          },
          onDone: (meta) => {
            ensureSseHeaders();
            res.write(`data: ${JSON.stringify({ done: true, ...meta })}\n\n`);
            res.end();
          },
          onError: (status, errBody) => {
            if (!headersSent) {
              applyNoStoreHeaders(res);
              sendJson(res, status, errBody);
            } else {
              res.write(
                `data: ${JSON.stringify({ error: errBody.error || 'AI stream interrupted' })}\n\n`
              );
              res.end();
            }
          },
        },
        authHeader
      );
      return;
    }

    if (routePath === '/api/ai/scan-id') {
      applyNoStoreHeaders(res);
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = await handleScanIdDocument(
        body as ScanIdRequestBody,
        authHeader,
        req.headers.cookie
      );
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/ai/security-audit') {
      applyNoStoreHeaders(res);
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const out = await handleAiSecurityAudit(authHeader);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/saas/verify-super-admin') {
      applyNoStoreHeaders(res);
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const out = await handleVerifyPlatformAdmin(authHeader);
      sendJson(res, out.status, out.body);
      return;
    }

    // Chapa Payment Gateway Proxy & Signed Webhooks
    if (routePath === '/api/chapa/status') {
      applyNoStoreHeaders(res);
      if (method !== 'GET') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const out = handleChapaStatus(resolveRequestOrigin(req));
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/chapa/initialize') {
      applyNoStoreHeaders(res);
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = await handleChapaInitialize(
        body as ChapaInitializePayload,
        resolveRequestOrigin(req)
      );
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/chapa/verify') {
      applyNoStoreHeaders(res);
      if (method !== 'GET' && method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      let params: ChapaVerifyParams = {};
      if (method === 'POST') {
        params = (await parseJsonBody(req)) as ChapaVerifyParams;
      } else {
        const txRef =
          getQueryParam(parsedUrl, req.query, 'tx_ref') ??
          getQueryParam(parsedUrl, req.query, 'txRef');
        const amountRaw =
          getQueryParam(parsedUrl, req.query, 'expectedAmountEtb') ??
          getQueryParam(parsedUrl, req.query, 'amount');
        const currency =
          getQueryParam(parsedUrl, req.query, 'expectedCurrency') ??
          getQueryParam(parsedUrl, req.query, 'currency');
        params = {
          txRef,
          expectedAmountEtb: amountRaw !== undefined && amountRaw !== '' ? Number(amountRaw) : undefined,
          expectedCurrency: currency,
        };
      }
      const out = await handleChapaVerify(params);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/chapa/webhook') {
      applyNoStoreHeaders(res);
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const rawBody = await readRawBody(req);
      const out = await handleChapaWebhook(
        rawBody,
        req.headers as Record<string, string | string[] | undefined>
      );
      sendJson(res, out.status, out.body);
      return;
    }

    // SMS Gateway Routes
    if (routePath === '/api/sms/status') {
      const out = handleSmsStatus();
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/sms/balance') {
      const provider = getQueryParam(parsedUrl, req.query, 'provider') as
        | ServerSmsProvider
        | undefined;
      const out = await handleSmsBalance(provider);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/sms/send') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = await handleSmsSend(body as Parameters<typeof handleSmsSend>[0]);
      sendJson(res, out.status, out.body);
      return;
    }

    // Enterprise Session Management & Account Lockout
    if (routePath === '/api/session/create') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = handleSessionCreate(
        body as Parameters<typeof handleSessionCreate>[0],
        isSecureRequest(req)
      );
      applyNoStoreHeaders(res, out.setCookie);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/session/validate') {
      if (method !== 'GET') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const out = handleSessionValidate(req.headers.cookie);
      applyNoStoreHeaders(res, out.setCookie);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/session/refresh') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = handleSessionRefresh(
        req.headers.cookie,
        body as { timeoutMinutes?: number },
        isSecureRequest(req)
      );
      applyNoStoreHeaders(res, out.setCookie);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/session/logout') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const out = handleSessionLogout(req.headers.cookie, isSecureRequest(req));
      applyNoStoreHeaders(res, out.setCookie);
      sendJson(res, out.status, out.body);
      return;
    }

    if (routePath === '/api/session/login-attempt') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'Method Not Allowed' });
        return;
      }
      const body = await parseJsonBody(req);
      const out = handleLoginAttempt(body as Parameters<typeof handleLoginAttempt>[0]);
      applyNoStoreHeaders(res);
      sendJson(res, out.status, out.body);
      return;
    }

    sendJson(res, 404, { error: `Unknown API route: ${routePath}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    applyNoStoreHeaders(res);
    sendJson(res, 500, { code: 'API_HANDLER_ERROR', error: message });
  }
}
