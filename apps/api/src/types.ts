export type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
export type UrlStatus = 'pending' | 'in_progress' | 'success' | 'error' | 'cancelled';

export interface UrlCheck {
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
}

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  urls: UrlCheck[];
}

export interface JobSummary {
  id: string;
  createdAt: string;
  status: JobStatus;
  totalUrls: number;
  successCount: number;
  errorCount: number;
}
