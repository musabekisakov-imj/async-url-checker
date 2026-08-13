import { randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import type { Job } from './types.js';

export interface JobUpdate<T> {
  job: Job;
  value: T;
}

export interface JobStore {
  create(job: Job): Promise<void>;
  get(id: string): Promise<Job | undefined>;
  list(): Promise<Job[]>;
  update<T>(id: string, updater: (job: Job) => JobUpdate<T> | undefined): Promise<T | undefined>;
}

const clone = (job: Job): Job => structuredClone(job);

export class MemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, Job>();

  async create(job: Job): Promise<void> {
    this.jobs.set(job.id, clone(job));
  }

  async get(id: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    return job ? clone(job) : undefined;
  }

  async list(): Promise<Job[]> {
    return [...this.jobs.values()].map(clone);
  }

  async update<T>(id: string, updater: (job: Job) => JobUpdate<T> | undefined): Promise<T | undefined> {
    const current = this.jobs.get(id);
    if (!current) return undefined;
    const update = updater(clone(current));
    if (!update) return undefined;
    this.jobs.set(id, clone(update.job));
    return update.value;
  }
}

const JOB_TTL_SECONDS = 7 * 24 * 60 * 60;
const LOCK_TTL_MS = 5_000;
const LOCK_ATTEMPTS = 200;
const INDEX_KEY = 'url-checker:jobs';
const jobKey = (id: string) => `url-checker:job:${id}`;
const lockKey = (id: string) => `url-checker:lock:${id}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RedisJobStore implements JobStore {
  constructor(private readonly redis: Redis) {}

  async create(job: Job): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.set(jobKey(job.id), job, { ex: JOB_TTL_SECONDS });
    pipeline.lpush(INDEX_KEY, job.id);
    pipeline.ltrim(INDEX_KEY, 0, 49);
    await pipeline.exec();
  }

  async get(id: string): Promise<Job | undefined> {
    return (await this.redis.get<Job>(jobKey(id))) ?? undefined;
  }

  async list(): Promise<Job[]> {
    const ids = await this.redis.lrange<string>(INDEX_KEY, 0, 49);
    const jobs = await Promise.all(ids.map((id) => this.get(id)));
    return jobs.filter((job): job is Job => Boolean(job));
  }

  async update<T>(id: string, updater: (job: Job) => JobUpdate<T> | undefined): Promise<T | undefined> {
    const token = randomUUID();
    const key = lockKey(id);

    for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
      const acquired = await this.redis.set(key, token, { nx: true, px: LOCK_TTL_MS });
      if (acquired) {
        try {
          const current = await this.get(id);
          if (!current) return undefined;
          const update = updater(current);
          if (!update) return undefined;
          await this.redis.set(jobKey(id), update.job, { ex: JOB_TTL_SECONDS });
          return update.value;
        } finally {
          await this.redis.eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
            [key],
            [token],
          );
        }
      }
      await pause(25);
    }

    throw new Error(`Timed out acquiring job lock for ${id}`);
  }
}

export function createRuntimeJobStore(): JobStore {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return new MemoryJobStore();
  return new RedisJobStore(new Redis({ url, token }));
}
