import type { JobSummary } from '../api/types';

const labels = { pending: 'Ожидает', in_progress: 'В работе', completed: 'Завершено', cancelled: 'Отменено', failed: 'Сбой' };
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export function JobsList({ jobs, activeId, loading, onSelect }: { jobs: JobSummary[]; activeId: string | null; loading: boolean; onSelect: (id: string) => void }) {
  return <section className="jobs-panel" aria-label="Последние задания">
    <div className="section-label"><span>ПОСЛЕДНИЕ ЗАПУСКИ</span><span className="mono">GET /api/jobs</span></div>
    {loading && !jobs.length && <p className="muted">Загружаем журнал…</p>}
    {!loading && !jobs.length && <p className="empty">Запусков пока нет. Введите адреса слева.</p>}
    <div className="jobs-list">
      {jobs.map((job) => <button key={job.id} className={`job-row ${activeId === job.id ? 'selected' : ''}`} onClick={() => onSelect(job.id)} aria-pressed={activeId === job.id}>
        <span className="job-mark" aria-hidden="true" />
        <span className="job-copy"><span className="job-id mono">{job.id.slice(0, 8)}</span><span className="job-date">{formatDate(job.createdAt)}</span></span>
        <span className={`status ${job.status}`}>{labels[job.status]}</span>
        <span className="job-count mono" aria-label={`${job.successCount} успешно, ${job.errorCount} с ошибкой, всего ${job.totalUrls}`}><span>{job.successCount}/{job.errorCount}<small> OK/ERR</small></span><small>{job.totalUrls} URL</small></span>
      </button>)}
    </div>
  </section>;
}
