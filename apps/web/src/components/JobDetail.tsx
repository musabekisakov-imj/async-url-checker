import type { JobDetail as Detail } from '../api/types';
import { isTerminal } from '../store/jobsStore';

const labels = {
  pending: 'Готовим проверку',
  in_progress: 'Проверяем адреса',
  completed: 'Проверка завершена',
  cancelled: 'Задание отменено',
  failed: 'Проверка не выполнена',
};
const urlLabels = { pending: 'В очереди', in_progress: 'Проверяем', success: 'Доступен', error: 'Ошибка', cancelled: 'Отменён' };
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const urlNoun = (count: number) => {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'адресов';
  if (mod10 === 1) return 'адрес';
  if (mod10 >= 2 && mod10 <= 4) return 'адреса';
  return 'адресов';
};

type Props = { detail: Detail | null; loading: boolean; cancelling: boolean; onCancel: () => void };

export function JobDetail({ detail, loading, cancelling, onCancel }: Props) {
  if (loading && !detail) return <section className="detail detail-loading" aria-label="Загружаем задание">
    <div className="skeleton skeleton-label" /><div className="skeleton skeleton-title" />
    <div className="skeleton-metrics"><i /><i /><i /></div><div className="skeleton skeleton-line" />
  </section>;

  if (!detail) return <section className="detail-empty">
    <div className="empty-orbit" aria-hidden="true"><i /><i /><i /></div>
    <span className="eyebrow">Рабочая область</span>
    <strong>Выберите задание</strong>
    <p>Здесь появятся прогресс, HTTP-коды и время ответа каждого адреса.</p>
  </section>;

  const done = detail.urls.filter((url) => ['success', 'error', 'cancelled'].includes(url.status)).length;
  const percentage = detail.urls.length ? Math.round(done / detail.urls.length * 100) : 0;

  return <section className="detail" aria-live="polite">
    <header className="detail-head">
      <div className="detail-title">
        <div className="detail-kicker"><span className={`status-dot ${detail.status}`} /><span className="mono">#{detail.id}</span></div>
        <h1>{labels[detail.status]}</h1>
        <p>Создано {formatDate(detail.createdAt)} · {detail.totalUrls} {urlNoun(detail.totalUrls)}</p>
      </div>
      {!isTerminal(detail.status) && <button className="cancel" onClick={onCancel} disabled={cancelling}><span>{cancelling ? 'Отменяем…' : 'Отменить задание'}</span><i aria-hidden="true">×</i></button>}
    </header>

    <div className="telemetry" aria-label="Статистика задания">
      <div><span>Обработано</span><strong className="mono">{done}<small> / {detail.totalUrls}</small></strong></div>
      <div><span>Доступно</span><strong className="mono success-text">{detail.successCount}</strong></div>
      <div><span>Ошибки</span><strong className="mono error-text">{detail.errorCount}</strong></div>
    </div>

    <div className="progress-block">
      <div className="progress-copy"><span>Общий прогресс</span><strong className="mono">{percentage}%</strong></div>
      <div className="trace" role="progressbar" aria-label="Прогресс проверки" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><div className="trace-fill" style={{ width: `${percentage}%` }} /></div>
    </div>

    <div className="results-wrap">
      <div className="results-header"><span>№</span><span>Адрес</span><span>Состояние</span><span>Ответ / время</span></div>
      <ol className="results">
        {detail.urls.map((item, index) => <li key={item.id ?? `${item.url}-${index}`} className={`result ${item.status}`}>
          <span className="index mono">{String(index + 1).padStart(2, '0')}</span>
          <a href={item.url} target="_blank" rel="noreferrer" className="url" title={item.url}><span>{item.url}</span><i aria-hidden="true">↗</i></a>
          <span className={`url-status ${item.status}`}><i />{urlLabels[item.status]}</span>
          <span className="result-meta mono" title={item.error ?? undefined}>{item.httpStatus != null ? `HTTP ${item.httpStatus}` : item.error ?? '—'}{item.durationMs != null && <small>{item.durationMs} ms</small>}</span>
        </li>)}
      </ol>
    </div>
  </section>;
}
