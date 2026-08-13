import { randomUUID } from 'node:crypto';
import { waitUntil } from '@vercel/functions';
import { createRuntimeJobStore, type JobStore, MemoryJobStore } from './job-store.js';
import type { Job, JobSummary } from './types.js';

export type HeadRequest = (url: string, signal: AbortSignal) => Promise<{ status: number }>;
export type Delay = (ms: number) => Promise<void>;
export type BackgroundTask = (task: Promise<void>) => void;

interface UrlClaim {
  index: number;
  url: string;
}

interface UrlOutcome {
  status: 'success' | 'error';
  httpStatus?: number;
  error?: string;
  finishedAt: string;
  durationMs: number;
}

const wait: Delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runLocally: BackgroundTask = (task) => { void task; };
const terminal = new Set(['completed', 'cancelled', 'failed']);

export class JobService {
  constructor(
    private readonly head: HeadRequest = async (url, signal) => {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal });
      return { status: response.status };
    },
    private readonly delay: Delay = wait,
    private readonly timeoutMs = 10_000,
    private readonly randomDelayMs: () => number = () => Math.floor(Math.random() * 10_001),
    private readonly store: JobStore = new MemoryJobStore(),
    private readonly background: BackgroundTask = runLocally,
  ) {}

  async create(urls: string[]): Promise<Job> {
    const job: Job = {
      id: randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      urls: urls.map((url) => ({ url, status: 'pending' })),
    };
    await this.store.create(job);
    this.background(this.process(job.id));
    return job;
  }

  async list(): Promise<JobSummary[]> {
    const jobs = await this.store.list();
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((job) => this.summary(job));
  }

  async get(id: string): Promise<Job | undefined> {
    return this.store.get(id);
  }

  async detail(id: string): Promise<(Job & Omit<JobSummary, 'id' | 'createdAt' | 'status'>) | undefined> {
    const job = await this.store.get(id);
    if (!job) return undefined;
    const { totalUrls, successCount, errorCount } = this.summary(job);
    return { ...job, totalUrls, successCount, errorCount };
  }

  async cancel(id: string): ReturnType<JobService['detail']> {
    return this.store.update(id, (job) => {
      if (terminal.has(job.status)) return { job, value: this.withStats(job) };
      const finishedAt = new Date().toISOString();
      job.status = 'cancelled';
      job.urls.forEach((item) => {
        if (item.status === 'pending') {
          item.status = 'cancelled';
          item.finishedAt = finishedAt;
        }
      });
      this.finishIfDone(job, finishedAt);
      return { job, value: this.withStats(job) };
    });
  }

  private summary(job: Job): JobSummary {
    return {
      id: job.id,
      createdAt: job.createdAt,
      status: job.status,
      totalUrls: job.urls.length,
      successCount: job.urls.filter((item) => item.status === 'success').length,
      errorCount: job.urls.filter((item) => item.status === 'error').length,
    };
  }

  private withStats(job: Job): Job & Omit<JobSummary, 'id' | 'createdAt' | 'status'> {
    const { totalUrls, successCount, errorCount } = this.summary(job);
    return { ...job, totalUrls, successCount, errorCount };
  }

  private async process(id: string): Promise<void> {
    try {
      await Promise.all(Array.from({ length: 5 }, () => this.worker(id)));
      await this.store.update(id, (job) => {
        this.finishIfDone(job);
        return { job, value: undefined };
      });
    } catch {
      await this.store.update(id, (job) => {
        if (!terminal.has(job.status)) {
          job.status = 'failed';
          const finishedAt = new Date().toISOString();
          job.finishedAt = finishedAt;
          job.durationMs = Date.parse(finishedAt) - Date.parse(job.startedAt ?? job.createdAt);
        }
        return { job, value: undefined };
      });
    }
  }

  private async worker(id: string): Promise<void> {
    while (true) {
      const claim = await this.claimNext(id);
      if (!claim) return;
      const outcome = await this.check(claim.url);
      await this.complete(id, claim.index, outcome);
    }
  }

  private async claimNext(id: string): Promise<UrlClaim | null> {
    return (await this.store.update<UrlClaim | null>(id, (job) => {
      if (terminal.has(job.status)) return { job, value: null };
      const index = job.urls.findIndex((item) => item.status === 'pending');
      if (index < 0) return { job, value: null };
      const startedAt = new Date().toISOString();
      if (job.status === 'pending') {
        job.status = 'in_progress';
        job.startedAt = startedAt;
      }
      job.urls[index].status = 'in_progress';
      job.urls[index].startedAt = startedAt;
      return { job, value: { index, url: job.urls[index].url } };
    })) ?? null;
  }

  private async check(url: string): Promise<UrlOutcome> {
    const startedAt = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let status: UrlOutcome['status'] = 'error';
    let httpStatus: number | undefined;
    let message: string | undefined;

    try {
      const response = await this.head(url, controller.signal);
      httpStatus = response.status;
      if (response.status >= 200 && response.status < 400) status = 'success';
      else message = `HTTP ${response.status}`;
    } catch (error) {
      message = controller.signal.aborted
        ? `Request timed out after ${this.timeoutMs}ms`
        : error instanceof Error ? error.message : 'Unknown request error';
    } finally {
      clearTimeout(timeout);
    }

    await this.delay(this.randomDelayMs());
    const finishedAt = new Date().toISOString();
    return {
      status,
      httpStatus,
      error: message,
      finishedAt,
      durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    };
  }

  private async complete(id: string, index: number, outcome: UrlOutcome): Promise<void> {
    await this.store.update(id, (job) => {
      const item = job.urls[index];
      if (!item || item.status !== 'in_progress') return { job, value: undefined };
      Object.assign(item, outcome);
      this.finishIfDone(job, outcome.finishedAt);
      return { job, value: undefined };
    });
  }

  private finishIfDone(job: Job, now = new Date().toISOString()): void {
    if (job.urls.some((item) => item.status === 'pending' || item.status === 'in_progress')) return;
    if (!terminal.has(job.status)) job.status = 'completed';
    job.finishedAt ??= now;
    job.durationMs ??= Date.parse(job.finishedAt) - Date.parse(job.startedAt ?? job.createdAt);
  }
}

export function createRuntimeJobService(): JobService {
  const background: BackgroundTask = process.env.VERCEL ? (task) => { waitUntil(task); } : runLocally;
  return new JobService(undefined, undefined, undefined, undefined, createRuntimeJobStore(), background);
}
