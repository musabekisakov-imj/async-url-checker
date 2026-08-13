import express, { type Request, type Response } from 'express';
import { JobService } from './job-service.js';

const isUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

export function createApp(service = new JobService()) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/api/jobs', (req: Request, res: Response) => {
    const urls = req.body?.urls;
    if (!Array.isArray(urls) || urls.length === 0 || !urls.every(isUrl)) {
      return res.status(400).json({ error: 'urls must be a non-empty array of valid http/https URLs' });
    }
    const job = service.create(urls);
    return res.status(201).json({ jobId: job.id });
  });
  app.get('/api/jobs', (_req, res) => res.json(service.list()));
  app.get('/api/jobs/:id', (req, res) => {
    const job = service.detail(req.params.id);
    return job ? res.json(job) : res.status(404).json({ error: 'Job not found' });
  });
  app.delete('/api/jobs/:id', (req, res) => {
    const job = service.cancel(req.params.id);
    return job ? res.json(job) : res.status(404).json({ error: 'Job not found' });
  });
  return app;
}
