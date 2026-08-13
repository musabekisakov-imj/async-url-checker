import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { JobService, type HeadRequest } from './job-service.js';

const pause = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));
const settled = async (service: JobService, id: string) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const job = service.get(id)!;
    if (['completed', 'cancelled', 'failed'].includes(job.status)) return job;
    await pause();
  }
  throw new Error('job did not settle');
};

describe('jobs API', () => {
  it('reports service health', async () => {
    await request(createApp()).get('/health').expect(200, { status: 'ok' });
  });

  it('creates, lists and returns completed URL statistics', async () => {
    const head: HeadRequest = async (url) => ({ status: url.includes('bad') ? 500 : 204 });
    const service = new JobService(head, async () => {}, 100, () => 0);
    const app = createApp(service);
    const created = await request(app).post('/api/jobs').send({ urls: ['https://ok.test', 'https://bad.test'] }).expect(201);
    const id = created.body.jobId as string;
    const job = await settled(service, id);
    expect(job.status).toBe('completed');
    const detail = await request(app).get(`/api/jobs/${id}`).expect(200);
    expect(detail.body).toMatchObject({ totalUrls: 2, successCount: 1, errorCount: 1 });
    expect(detail.body.urls[1]).toMatchObject({ status: 'error', httpStatus: 500, error: 'HTTP 500' });
    const list = await request(app).get('/api/jobs').expect(200);
    expect(list.body[0]).toMatchObject({ id, totalUrls: 2, successCount: 1, errorCount: 1 });
  });

  it('validates body and returns 404 for unknown jobs', async () => {
    const app = createApp(new JobService(async () => ({ status: 200 }), async () => {}, 100, () => 0));
    await request(app).post('/api/jobs').send({ urls: ['ftp://invalid.test'] }).expect(400);
    await request(app).get('/api/jobs/missing').expect(404);
    await request(app).delete('/api/jobs/missing').expect(404);
  });

  it('cancels unstarted URLs and never starts them', async () => {
    let active = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const head: HeadRequest = async () => { active += 1; await gate; active -= 1; return { status: 200 }; };
    const service = new JobService(head, async () => {}, 1000, () => 0);
    const app = createApp(service);
    const create = await request(app).post('/api/jobs').send({ urls: Array.from({ length: 8 }, (_, i) => `https://test${i}.dev`) });
    const id = create.body.jobId as string;
    await pause();
    expect(active).toBe(5);
    await request(app).delete(`/api/jobs/${id}`).expect(200);
    release();
    const job = await settled(service, id);
    expect(job.status).toBe('cancelled');
    expect(job.urls.filter((item) => item.status === 'cancelled')).toHaveLength(3);
  });

  it('limits HEAD requests to five per job', async () => {
    let active = 0;
    let maxActive = 0;
    const head: HeadRequest = async () => {
      active += 1; maxActive = Math.max(maxActive, active);
      await pause(2); active -= 1; return { status: 200 };
    };
    const service = new JobService(head, async () => {}, 100, () => 0);
    const job = service.create(Array.from({ length: 12 }, (_, i) => `https://test${i}.dev`));
    await settled(service, job.id);
    expect(maxActive).toBe(5);
    expect(service.list()[0]).toMatchObject({ totalUrls: 12, successCount: 12, errorCount: 0 });
  });
});
