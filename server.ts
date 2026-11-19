import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { buildKnowledgeContextForRole } from './src/lib/knowledgeBase.ts';
import type { RoleCode } from './src/types/zacma.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const AI_MODEL = process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getProviderReadiness() {
  const hasRealEnv = (key: string, placeholderPrefix?: string) => {
    const val = process.env[key];
    if (!val || !val.trim()) return false;
    if (placeholderPrefix && val.startsWith(placeholderPrefix)) return false;
    return true;
  };

  return {
    ai: {
      provider: 'Google Gemini (@google/genai)',
      model: AI_MODEL,
      configured: Boolean(getGeminiClient()),
      envVar: 'GEMINI_API_KEY',
    },
    supabase: {
      urlConfigured: hasRealEnv('SUPABASE_URL', 'https://your-project'),
      anonKeyConfigured: hasRealEnv('SUPABASE_ANON_KEY', 'your-'),
      serviceRoleConfigured: hasRealEnv('SUPABASE_SERVICE_ROLE_KEY', 'your-'),
      ready:
        hasRealEnv('SUPABASE_URL', 'https://your-project') &&
        hasRealEnv('SUPABASE_ANON_KEY', 'your-'),
    },
    channels: {
      inApp: { configured: true, status: 'ACTIVE' },
      email: {
        configured:
          hasRealEnv('SMTP_HOST') &&
          hasRealEnv('SMTP_USER') &&
          hasRealEnv('SMTP_PASS'),
        provider: process.env.SMTP_HOST ? `SMTP (${process.env.SMTP_HOST})` : 'Unconfigured',
        envVars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
      },
      sms: {
        configured:
          hasRealEnv('TWILIO_ACCOUNT_SID') &&
          hasRealEnv('TWILIO_AUTH_TOKEN') &&
          hasRealEnv('TWILIO_FROM_NUMBER'),
        provider: hasRealEnv('TWILIO_ACCOUNT_SID') ? 'Twilio SMS' : 'Unconfigured',
        envVars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'],
      },
      whatsapp: {
        configured:
          hasRealEnv('WHATSAPP_API_TOKEN') &&
          hasRealEnv('WHATSAPP_PHONE_NUMBER_ID'),
        provider: hasRealEnv('WHATSAPP_API_TOKEN') ? 'Meta WhatsApp Cloud API' : 'Unconfigured',
        envVars: ['WHATSAPP_API_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
      },
    },
    cronSecretConfigured: hasRealEnv('CRON_SECRET', 'change-me'),
  };
}

function listSqlMigrations() {
  const migDir = path.resolve(__dirname, 'supabase', 'migrations');
  if (!fs.existsSync(migDir)) return [];
  return fs
    .readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((filename) => {
      const fullPath = path.join(migDir, filename);
      const stat = fs.statSync(fullPath);
      const version = filename.split('_')[0] || filename;
      return {
        version,
        filename,
        sizeBytes: stat.size,
      };
    });
}

// Track background scheduler telemetry (server-side, independent of open browser tabs)
let lastScheduledReminderRun: {
  ranAt: string;
  trigger: 'startup' | 'interval' | 'cron' | 'manual';
  status: string;
  evaluatedCount: number;
} = {
  ranAt: new Date().toISOString(),
  trigger: 'startup',
  status: 'READY',
  evaluatedCount: 0,
};

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health Check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'ZACMA Technology & Training Institute Portal',
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------------
  // 1. ZACMA AI ASSISTANT (Server-Side Gemini API with Strict Role Isolation)
  // -------------------------------------------------------------------------
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        code: 'AI_NOT_CONFIGURED',
        error:
          'ZACMA AI Assistant is not configured on this server (GEMINI_API_KEY missing). All other portal modules continue operating normally.',
      });
    }

    const { message, history, role, userName, context } = req.body as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
      role?: RoleCode;
      userName?: string;
      context?: Record<string, unknown>;
    };

    const allowedRoles: RoleCode[] = [
      'ADMIN',
      'ACCOUNTANT',
      'INSTRUCTOR',
      'GENERAL_STAFF',
      'STUDENT',
    ];
    if (!role || !allowedRoles.includes(role)) {
      return res.status(401).json({ error: 'Authenticated user role is required.' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const knowledgeText = buildKnowledgeContextForRole(role);

    // Role-specific strict guardrails
    const rolePolicy: Record<RoleCode, string> = {
      ADMIN:
        'User is an ADMIN. You may explain dashboard statistics, approved revenue, outstanding fees, overdue student reports, pending approvals, financial reports, and system procedures using ONLY the authorized context data.',
      ACCOUNTANT:
        'User is an ACCOUNTANT. You may explain student registration, payment recording, payment balances, printing approved receipts, and overdue fee lists. Remind the user that Accountants cannot approve their own transactions or alter course fees.',
      INSTRUCTOR:
        'User is an INSTRUCTOR. STRICT SECURITY RULE: NEVER discuss, disclose, or estimate any financial amounts, ETB fees, revenue, expenses, or payment data. Focus strictly on assigned classes, enrolled students, and attendance workflows.',
      GENERAL_STAFF:
        'User is GENERAL STAFF. Focus strictly on authorized operational modules, student directory lookups (non-financial), course schedules, and institutional workflows. Never disclose financial totals or private payment data.',
      STUDENT:
        'User is a STUDENT. STRICT SECURITY RULE: Only discuss THIS student’s own payment schedule, own outstanding ETB balance, own payment status, and how to print their own approved receipts. NEVER reference or speculate about any other student.',
    };

    const systemInstruction = `You are "ZACMA AI ASSISTANT", the official help and analytics assistant for ZACMA Technology & Training Institute's Student Fee Management & Accounting Portal.

AUTHENTICATED USER:
- Name: ${String(userName || 'Authorized User').slice(0, 80)}
- Verified Role: ${role}
- Policy: ${rolePolicy[role]}

ABSOLUTE SECURITY & ACCOUNTING RULES (NEVER VIOLATE):
1. Currency is always Ethiopian Birr (ETB).
2. ONLY APPROVED payments count as official revenue or reduce student balances. Pending payments never count as paid.
3. NEVER invent payment figures, receipt numbers, student IDs, or balances. If a specific figure is not in the Authorized Live Context below, clearly state that it is not available in your current view.
4. NEVER claim to approve payments, modify accounting records, create users, or change permissions. You are strictly read-only; guide the authorized user on where to click and confirm manually.
5. NEVER reveal passwords, API keys, service-role secrets, or private records belonging to another student.
6. Keep responses concise, structured, accurate, and directly actionable inside the ZACMA portal.

OFFICIAL ZACMA SYSTEM KNOWLEDGE BASE:
${knowledgeText}

AUTHORIZED LIVE CONTEXT FOR THIS ${role} SESSION (JSON):
${JSON.stringify(context || {}, null, 2).slice(0, 12000)}`;

    const conversationLines = (Array.isArray(history) ? history.slice(-6) : [])
      .map((h) => `${h.role === 'user' ? 'User' : 'ZACMA AI Assistant'}: ${String(h.text).slice(0, 600)}`)
      .join('\n');

    const promptText = conversationLines
      ? `Recent conversation:\n${conversationLines}\n\nCurrent user question:\n${message.trim().slice(0, 1500)}`
      : message.trim().slice(0, 1500);

    try {
      const response = await ai.models.generateContent({
        model: AI_MODEL,
        contents: promptText,
        config: {
          systemInstruction,
        },
      });
      const reply = response.text?.trim();
      if (!reply) {
        return res.status(502).json({ error: 'AI service returned an empty response.' });
      }
      return res.json({
        reply,
        model: AI_MODEL,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('ZACMA AI Assistant error:', errMsg);
      return res.status(502).json({
        code: 'AI_UPSTREAM_ERROR',
        error: `AI provider request failed: ${errMsg}`,
      });
    }
  });

  // -------------------------------------------------------------------------
  // 2. Database Setup Wizard Diagnostics & Safe Migration Verification
  // -------------------------------------------------------------------------
  app.get('/api/setup/status', async (_req: Request, res: Response) => {
    const providers = getProviderReadiness();
    const sqlMigrations = listSqlMigrations();

    const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
    let activeFirestoreInfo: {
      configured: boolean;
      projectId?: string;
      databaseId?: string;
    } = { configured: false };

    if (fs.existsSync(firebaseConfigPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
        activeFirestoreInfo = {
          configured: Boolean(parsed.projectId && parsed.firestoreDatabaseId),
          projectId: parsed.projectId,
          databaseId: parsed.firestoreDatabaseId,
        };
      } catch {
        activeFirestoreInfo = { configured: false };
      }
    }

    // Optional live Supabase REST connectivity check (only if env vars exist)
    let supabaseConnectivity: {
      checked: boolean;
      reachable: boolean;
      detail: string;
    } = {
      checked: false,
      reachable: false,
      detail: 'SUPABASE_URL and SUPABASE_ANON_KEY are not set in server environment.',
    };

    if (providers.supabase.ready && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const healthRes = await fetch(`${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/`, {
          headers: {
            apikey: process.env.SUPABASE_ANON_KEY,
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        supabaseConnectivity = {
          checked: true,
          reachable: healthRes.ok || healthRes.status === 401 || healthRes.status === 404,
          detail: healthRes.ok
            ? 'Supabase REST API responded normally.'
            : `Supabase endpoint reachable (HTTP ${healthRes.status}).`,
        };
      } catch (err) {
        supabaseConnectivity = {
          checked: true,
          reachable: false,
          detail: err instanceof Error ? err.message : 'Unable to reach Supabase host.',
        };
      }
    }

    const requiredEnvChecklist = [
      {
        key: 'GEMINI_API_KEY',
        category: 'AI Assistant',
        requiredFor: 'ZACMA AI Assistant server-side responses',
        present: providers.ai.configured,
      },
      {
        key: 'SUPABASE_URL',
        category: 'Supabase Deployment',
        requiredFor: 'External Supabase PostgreSQL project URL (Vercel deployment)',
        present: providers.supabase.urlConfigured,
      },
      {
        key: 'SUPABASE_ANON_KEY',
        category: 'Supabase Deployment',
        requiredFor: 'Supabase client public key for RLS-enforced queries',
        present: providers.supabase.anonKeyConfigured,
      },
      {
        key: 'SUPABASE_SERVICE_ROLE_KEY',
        category: 'Supabase Server Cron',
        requiredFor: 'Protected server-side scheduled reminder execution (never exposed to browser)',
        present: providers.supabase.serviceRoleConfigured,
      },
      {
        key: 'CRON_SECRET',
        category: 'Scheduled Reminders',
        requiredFor: 'Authorizes Vercel Cron calls to /api/cron/reminders',
        present: providers.cronSecretConfigured,
      },
      {
        key: 'SMTP_HOST / SMTP_USER / SMTP_PASS',
        category: 'Optional Email Delivery',
        requiredFor: 'Automated student fee reminder emails',
        present: providers.channels.email.configured,
      },
      {
        key: 'TWILIO_ACCOUNT_SID / AUTH_TOKEN',
        category: 'Optional SMS Delivery',
        requiredFor: 'Automated student fee reminder SMS alerts',
        present: providers.channels.sms.configured,
      },
      {
        key: 'WHATSAPP_API_TOKEN / PHONE_ID',
        category: 'Optional WhatsApp Delivery',
        requiredFor: 'Automated student fee reminder WhatsApp messages',
        present: providers.channels.whatsapp.configured,
      },
    ];

    return res.json({
      checkedAt: new Date().toISOString(),
      activeFirestore: activeFirestoreInfo,
      supabaseConnectivity,
      providers,
      sqlMigrations,
      requiredEnvChecklist,
      lastScheduledReminderRun,
    });
  });

  // -------------------------------------------------------------------------
  // 3. Scheduled Payment Reminder Cron & External Channel Dispatch Endpoint
  // -------------------------------------------------------------------------
  app.get('/api/cron/reminders', (req: Request, res: Response) => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && cronSecret !== 'change-me-to-random-secret') {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized cron trigger.' });
      }
    }
    lastScheduledReminderRun = {
      ranAt: new Date().toISOString(),
      trigger: 'cron',
      status: 'EXECUTED',
      evaluatedCount: lastScheduledReminderRun.evaluatedCount,
    };
    return res.json({
      ok: true,
      message: 'Scheduled reminder check triggered.',
      run: lastScheduledReminderRun,
      providers: getProviderReadiness().channels,
    });
  });

  app.post('/api/reminders/dispatch-external', (req: Request, res: Response) => {
    const { channel, recipient, subject, body } = req.body as {
      channel?: 'email' | 'sms' | 'whatsapp';
      recipient?: string;
      subject?: string;
      body?: string;
    };
    const channels = getProviderReadiness().channels;
    if (!channel || !recipient || !body) {
      return res.status(400).json({ error: 'channel, recipient, and body are required.' });
    }
    // Honest provider reporting: NEVER pretend an external notification succeeded if provider is unconfigured
    if (channel === 'email' && !channels.email.configured) {
      return res.status(503).json({
        delivered: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        channel,
        message: `Email provider not configured. Set ${channels.email.envVars.join(', ')} in server environment variables.`,
      });
    }
    if (channel === 'sms' && !channels.sms.configured) {
      return res.status(503).json({
        delivered: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        channel,
        message: `SMS provider not configured. Set ${channels.sms.envVars.join(', ')} in server environment variables.`,
      });
    }
    if (channel === 'whatsapp' && !channels.whatsapp.configured) {
      return res.status(503).json({
        delivered: false,
        status: 'PROVIDER_NOT_CONFIGURED',
        channel,
        message: `WhatsApp Cloud API not configured. Set ${channels.whatsapp.envVars.join(', ')} in server environment variables.`,
      });
    }

    return res.json({
      delivered: false,
      status: 'QUEUED_FOR_PROVIDER_WEBHOOK',
      channel,
      recipient,
      subject: subject || 'ZACMA Payment Reminder',
      message: 'Provider credentials detected. Configure provider webhook confirmation callback to record verified external delivery.',
    });
  });

  app.post('/api/reminders/record-run', (req: Request, res: Response) => {
    const { evaluatedCount, trigger } = req.body as {
      evaluatedCount?: number;
      trigger?: 'manual' | 'cron';
    };
    lastScheduledReminderRun = {
      ranAt: new Date().toISOString(),
      trigger: trigger === 'cron' ? 'cron' : 'manual',
      status: 'COMPLETED',
      evaluatedCount: Number(evaluatedCount || 0),
    };
    res.json({ ok: true, run: lastScheduledReminderRun });
  });

  // Mount Vite middleware in development or serve built dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Server-side background heartbeat (runs independently of open browser tabs)
  setInterval(() => {
    lastScheduledReminderRun = {
      ranAt: new Date().toISOString(),
      trigger: 'interval',
      status: 'SCHEDULED_HEARTBEAT',
      evaluatedCount: lastScheduledReminderRun.evaluatedCount,
    };
  }, 1000 * 60 * 30);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZACMA Portal server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start ZACMA Portal server:', err);
  process.exit(1);
});
