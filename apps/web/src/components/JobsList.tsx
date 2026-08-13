import type { JobSummary } from '../api/types';

const labels = { pending: 'Ожидает', in_progress: 'В работе', completed: 'Завершено', cancelled: 'Отменено', failed: 'Сбой' };
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

export function JobsList({ jobs, activeId, loading, onSelect }: { jobs: JobSummary[]; activeId: string | null; loading: boolean; onSelect: (id: string) => void }) {
  return <section className="jobs-panel" aria-label="Последние задания">
    <header className="jobs-heading"><div><span className="eyebrow">История</span><h2>Последние задания</h2></div><span className="jobs-total mono">{jobs.length}</span></header>
    {loading && !jobs.length && <div className="jobs-skeleton" aria-label="Загружаем задания"><i /><i /><i /></div>}
    {!loading && !jobs.length && <div className="empty jobs-empty"><span className="empty-glyph" aria-hidden="true">↳</span><strong>Запусков пока нет</strong><p>Добавьте URL выше, и первое задание появится здесь.</p></div>}
    <div className="jobs-list">
      {jobs.map((job) => <button key={job.id} className={`job-row ${activeId === job.id ? 'selected' : ''}`} onClick={() => onSelect(job.id)} aria-pressed={activeId === job.id}>
        <span className={`job-mark ${job.status}`} aria-hidden="true" />
        <span className="job-copy"><span className="job-id mono">#{job.id.slice(0, 8)}</span><time className="job-date" dateTime={job.createdAt}>{formatDate(job.createdAt)}</time></span>
        <span className="job-outcome mono" aria-label={`${job.successCount} успешно, ${job.errorCount} с ошибкой`}><b>{job.successCount}</b><i>/</i><b className={job.errorCount ? 'has-errors' : ''}>{job.errorCount}</b></span>
        <span className={`status ${job.status}`}>{labels[job.status]}</span>
        <span className="job-total mono">{job.totalUrls} URL</span>
      </button>)}
    </div>
  </section>;
}
