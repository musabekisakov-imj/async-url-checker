import { randomUUID } from 'node:crypto';
import type { Job, JobSummary, UrlCheck } from './types.js';

export type HeadRequest = (url: string, signal: AbortSignal) => Promise<{ status: number }>;
export type Delay = (ms: number) => Promise<void>;

const wait: Delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class JobService {
  private readonly jobs = new Map<string, Job>();

  constructor(
    private readonly head: HeadRequest = async (url, signal) => {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal });
      return { status: response.status };
    },
    private readonly delay: Delay = wait,
    private readonly timeoutMs = 10_000,
    private readonly randomDelayMs: () => number = () => Math.floor(Math.random() * 10_001),
  ) {}

  create(urls: string[]): Job {
    const job: Job = {
      id: randomUUID(), status: 'pending', createdAt: new Date().toISOString(),
      urls: urls.map((url) => ({ url, status: 'pending' })),
    };
    this.jobs.set(job.id, job);
    setTimeout(() => { void this.process(job); }, 0);
    return job;
  }

  list(): JobSummary[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((job) => this.summary(job));
  }

  get(id: string): Job | undefined { return this.jobs.get(id); }

  detail(id: string): (Job & Omit<JobSummary, 'id' | 'createdAt' | 'status'>) | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    const { totalUrls, successCount, errorCount } = this.summary(job);
    return { ...job, totalUrls, successCount, errorCount };
  }

  cancel(id: string): ReturnType<JobService['detail']> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return this.detail(id);
    job.status = 'cancelled';
    job.urls.filter((item) => item.status === 'pending').forEach((item) => { item.status = 'cancelled'; });
    this.finishIfDone(job);
    return this.detail(id);
  }

  private summary(job: Job): JobSummary {
    return {
      id: job.id, createdAt: job.createdAt, status: job.status, totalUrls: job.urls.length,
      successCount: job.urls.filter((item) => item.status === 'success').length,
      errorCount: job.urls.filter((item) => item.status === 'error').length,
    };
  }

  private async process(job: Job): Promise<void> {
    if (job.status === 'cancelled') return;
    job.status = 'in_progress';
    job.startedAt = new Date().toISOString();
    try {
      await Promise.all(Array.from({ length: Math.min(5, job.urls.length) }, () => this.worker(job)));
      this.finishIfDone(job);
    } catch {
      job.status = 'failed';
      const finishedAt = new Date().toISOString();
      job.finishedAt = finishedAt;
      job.durationMs = Date.parse(finishedAt) - Date.parse(job.startedAt ?? finishedAt);
    }
  }

  private async worker(job: Job): Promise<void> {
    while (job.status !== 'cancelled') {
      const item = job.urls.find((candidate) => candidate.status === 'pending');
      if (!item) return;
      await this.check(item);
    }
  }

  private async check(item: UrlCheck): Promise<void> {
    item.status = 'in_progress';
    item.startedAt = new Date().toISOString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.head(item.url, controller.signal);
      await this.delay(this.randomDelayMs());
      item.httpStatus = response.status;
      if (response.status >= 200 && response.status < 400) {
        item.status = 'success';
      } else {
        item.status = 'error';
        item.error = `HTTP ${response.status}`;
      }
    } catch (error) {
      await this.delay(this.randomDelayMs());
      item.status = 'error';
      item.error = controller.signal.aborted
        ? `Request timed out after ${this.timeoutMs}ms`
        : error instanceof Error ? error.message : 'Unknown request error';
    } finally {
      clearTimeout(timeout);
      const finishedAt = new Date().toISOString();
      item.finishedAt = finishedAt;
      item.durationMs = Date.parse(finishedAt) - Date.parse(item.startedAt ?? finishedAt);
    }
  }

  private finishIfDone(job: Job): void {
    if (job.urls.some((item) => item.status === 'pending' || item.status === 'in_progress')) return;
    if (job.status !== 'cancelled') job.status = 'completed';
    const finishedAt = job.finishedAt ?? new Date().toISOString();
    job.finishedAt = finishedAt;
    if (job.startedAt) job.durationMs ??= Date.parse(finishedAt) - Date.parse(job.startedAt);
  }
}
