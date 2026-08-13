import { afterEach, describe, expect, it, vi } from 'vitest';
import { jobsApi } from '../api/client';
import type { JobDetail } from '../api/types';
import { useJobsStore } from './jobsStore';

vi.mock('../api/client', () => ({ jobsApi: { get: vi.fn(), list: vi.fn(), create: vi.fn(), cancel: vi.fn() } }));

const job = (id: string): JobDetail => ({ id, createdAt: '2026-01-01T00:00:00.000Z', status: 'completed', totalUrls: 1, successCount: 1, errorCount: 0, urls: [] });
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };

afterEach(() => {
  useJobsStore.getState().stopPolling();
  useJobsStore.setState({ jobs: [], activeJobId: null, detail: null, error: null, detailLoading: false, cancelling: false, listLoading: false, creating: false });
  vi.clearAllMocks();
});

describe('jobs store active selection', () => {
  it('drops old detail response after active job changes', async () => {
    const oldRequest = deferred<ReturnType<typeof job>>();
    vi.mocked(jobsApi.get).mockImplementationOnce(() => oldRequest.promise).mockResolvedValueOnce(job('new'));
    const oldSelection = useJobsStore.getState().selectJob('old');
    const newSelection = useJobsStore.getState().selectJob('new');
    await newSelection;
    oldRequest.resolve(job('old'));
    await oldSelection;
    expect(useJobsStore.getState().activeJobId).toBe('new');
    expect(useJobsStore.getState().detail?.id).toBe('new');
  });

  it('stops polling timer when selecting next job', async () => {
    vi.useFakeTimers();
    vi.mocked(jobsApi.get).mockResolvedValueOnce({ ...job('first'), status: 'in_progress' as const }).mockResolvedValueOnce(job('next'));
    await useJobsStore.getState().selectJob('first');
    expect(useJobsStore.getState().pollTimer).not.toBeNull();
    await useJobsStore.getState().selectJob('next');
    expect(useJobsStore.getState().pollTimer).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(jobsApi.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('retries polling after a transient request error', async () => {
    vi.useFakeTimers();
    vi.mocked(jobsApi.get).mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(job('retry'));
    await useJobsStore.getState().selectJob('retry');
    expect(useJobsStore.getState().error).toBe('Network error');
    await vi.advanceTimersByTimeAsync(1500);
    expect(useJobsStore.getState().detail?.id).toBe('retry');
    expect(jobsApi.get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
