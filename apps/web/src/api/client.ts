import type { JobDetail, JobSummary } from './types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    throw new Error(body?.error || body?.message || `Ошибка сервера: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const jobsApi = {
  create: (urls: string[]) => request<{ jobId: string }>('/jobs', { method: 'POST', body: JSON.stringify({ urls }) }),
  list: () => request<JobSummary[]>('/jobs'),
  get: (id: string) => request<JobDetail>(`/jobs/${id}`),
  cancel: (id: string) => request<JobDetail>(`/jobs/${id}`, { method: 'DELETE' }),
};
