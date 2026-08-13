import { create } from 'zustand';
import { jobsApi } from '../api/client';
import type { JobDetail, JobStatus, JobSummary } from '../api/types';

const terminal: JobStatus[] = ['completed', 'cancelled', 'failed'];
export const isTerminal = (status?: JobStatus) => Boolean(status && terminal.includes(status));

type State = {
  jobs: JobSummary[];
  activeJobId: string | null;
  detail: JobDetail | null;
  listLoading: boolean;
  detailLoading: boolean;
  creating: boolean;
  cancelling: boolean;
  error: string | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  requestVersion: number;
  loadJobs: () => Promise<void>;
  selectJob: (id: string) => Promise<void>;
  createJob: (rawUrls: string) => Promise<boolean>;
  cancelActive: () => Promise<void>;
  stopPolling: () => void;
};

export const useJobsStore = create<State>((set, get) => {
  const stopPolling = () => {
    const timer = get().pollTimer;
    if (timer) clearTimeout(timer);
    set({ pollTimer: null, requestVersion: get().requestVersion + 1 });
  };

  const refreshDetail = async (id: string, version: number, schedule = true) => {
    try {
      const detail = await jobsApi.get(id);
      if (get().activeJobId !== id || get().requestVersion !== version) return;
      set((state) => ({
        detail,
        detailLoading: false,
        jobs: state.jobs.map((job) => job.id === id ? { ...job, ...detail } : job),
      }));
      if (schedule && !isTerminal(detail.status)) {
        const timer = setTimeout(() => void refreshDetail(id, version), 1500);
        if (get().activeJobId === id && get().requestVersion === version) set({ pollTimer: timer });
      }
    } catch (error) {
      if (get().activeJobId === id && get().requestVersion === version) {
        set({ detailLoading: false, error: error instanceof Error ? error.message : 'Не удалось получить задание' });
        if (schedule) {
          const timer = setTimeout(() => void refreshDetail(id, version), 1500);
          if (get().activeJobId === id && get().requestVersion === version) set({ pollTimer: timer });
        }
      }
    }
  };

  return {
    jobs: [], activeJobId: null, detail: null, listLoading: false, detailLoading: false,
    creating: false, cancelling: false, error: null, pollTimer: null, requestVersion: 0,
    stopPolling,
    loadJobs: async () => {
      set({ listLoading: true, error: null });
      try { set({ jobs: await jobsApi.list(), listLoading: false }); }
      catch (error) { set({ listLoading: false, error: error instanceof Error ? error.message : 'Не удалось загрузить список' }); }
    },
    selectJob: async (id) => {
      stopPolling();
      const version = get().requestVersion;
      set({ activeJobId: id, detail: null, detailLoading: true, cancelling: false, error: null });
      await refreshDetail(id, version);
    },
    createJob: async (rawUrls) => {
      const urls = rawUrls.split('\n').map((url) => url.trim()).filter(Boolean);
      if (!urls.length) { set({ error: 'Добавьте хотя бы один URL.' }); return false; }
      stopPolling();
      set({ creating: true, error: null });
      try {
        const { jobId } = await jobsApi.create(urls);
        set({ creating: false });
        await get().loadJobs();
        await get().selectJob(jobId);
        return true;
      } catch (error) { set({ creating: false, error: error instanceof Error ? error.message : 'Не удалось создать задание' }); return false; }
    },
    cancelActive: async () => {
      const id = get().activeJobId;
      if (!id) return;
      stopPolling();
      const version = get().requestVersion;
      set({ cancelling: true, error: null });
      try {
        const detail = await jobsApi.cancel(id);
        if (get().activeJobId === id && get().requestVersion === version) set({ detail, cancelling: false });
        await get().loadJobs();
      } catch (error) { if (get().activeJobId === id && get().requestVersion === version) set({ cancelling: false, error: error instanceof Error ? error.message : 'Не удалось отменить задание' }); }
    },
  };
});
