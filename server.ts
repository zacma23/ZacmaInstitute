import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  handleAiChat,
  handleCronReminders,
  handleDispatchExternal,
  handleHealth,
  handleRecordReminderRun,
  handleSetupStatus,
  recordScheduledHeartbeat,
} from './server/handlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const out = handleHealth();
    res.status(out.status).json(out.body);
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const out = await handleAiChat(req.body);
    res.status(out.status).json(out.body);
  });

  app.get('/api/setup/status', async (_req: Request, res: Response) => {
    const out = await handleSetupStatus(__dirname);
    res.status(out.status).json(out.body);
  });

  app.get('/api/cron/reminders', async (req: Request, res: Response) => {
    const out = await handleCronReminders(req.headers.authorization);
    res.status(out.status).json(out.body);
  });

  app.post('/api/reminders/dispatch-external', (req: Request, res: Response) => {
    const out = handleDispatchExternal(req.body);
    res.status(out.status).json(out.body);
  });

  app.post('/api/reminders/record-run', (req: Request, res: Response) => {
    const out = handleRecordReminderRun(req.body);
    res.status(out.status).json(out.body);
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
    recordScheduledHeartbeat();
  }, 1000 * 60 * 30);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZACMA Portal server listening on http://0.0.0.0:${PORT}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start ZACMA Portal server:', err);
  process.exit(1);
});
