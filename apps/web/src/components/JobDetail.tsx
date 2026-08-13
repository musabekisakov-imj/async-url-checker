import type { JobDetail as Detail } from '../api/types';
import { isTerminal } from '../store/jobsStore';

const labels = { pending: 'Ожидает очереди', in_progress: 'Проверяем', completed: 'Проверка завершена', cancelled: 'Задание отменено', failed: 'Ошибка задания' };
const urlLabels = { pending: 'QUEUE', in_progress: 'HEAD', success: 'OK', error: 'ERR', cancelled: 'STOP' };

export function JobDetail({ detail, loading, cancelling, onCancel }: { detail: Detail | null; loading: boolean; cancelling: boolean; onCancel: () => void }) {
  if (loading && !detail) return <section className="detail-empty">Подключаемся к заданию<span className="cursor">_</span></section>;
  if (!detail) return <section className="detail-empty"><strong>Выберите запуск</strong><span>Детали проверки появятся здесь.</span></section>;
  const done = detail.urls.filter((url) => ['success', 'error', 'cancelled'].includes(url.status)).length;
  const percentage = detail.urls.length ? Math.round(done / detail.urls.length * 100) : 0;
  return <section className="detail" aria-live="polite">
    <header className="detail-head">
      <div><div className="section-label"><span>АКТИВНОЕ ЗАДАНИЕ</span><span className="mono">#{detail.id}</span></div><h1>{labels[detail.status]}</h1></div>
      {!isTerminal(detail.status) && <button className="cancel" onClick={onCancel} disabled={cancelling}>{cancelling ? 'Отменяем…' : 'Отменить'}</button>}
    </header>
    <div className="telemetry"><div><span>ПРОГРЕСС</span><strong className="mono">{done} / {detail.totalUrls}</strong></div><div><span>УСПЕШНО</span><strong className="mono success-text">{detail.successCount}</strong></div><div><span>ОШИБКИ</span><strong className="mono error-text">{detail.errorCount}</strong></div></div>
    <div className="trace" role="progressbar" aria-label="Прогресс проверки" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><div className="trace-fill" style={{ width: `${percentage}%` }} /></div>
    <div className="results-header"><span>АДРЕС</span><span>СОСТОЯНИЕ</span><span>ОТВЕТ / ВРЕМЯ</span></div>
    <ul className="results">
      {detail.urls.map((item, index) => <li key={item.id ?? `${item.url}-${index}`} className={`result ${item.status}`}>
        <span className="index mono">{String(index + 1).padStart(2, '0')}</span><a href={item.url} target="_blank" rel="noreferrer" className="url">{item.url}</a>
        <span className={`url-status ${item.status} mono`}>{urlLabels[item.status]}</span>
        <span className="result-meta mono">{item.httpStatus ?? item.error ?? '—'}{item.durationMs != null && <small> · {item.durationMs}ms</small>}</span>
      </li>)}
    </ul>
  </section>;
}
