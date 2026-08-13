import { useEffect } from 'react';
import { JobDetail } from './components/JobDetail';
import { JobForm } from './components/JobForm';
import { JobsList } from './components/JobsList';
import { useJobsStore } from './store/jobsStore';

export default function App() {
  const store = useJobsStore();
  useEffect(() => { void store.loadJobs(); return () => store.stopPolling(); }, []); // store singleton actions stable
  return <>
    <a className="skip-link" href="#main-content">К основному содержимому</a>
    <div className="app-frame">
      <header className="topbar">
        <a className="brand" href="/" aria-label="URL Inspector — главная">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="brand-copy"><strong>URL Inspector</strong><small>Асинхронная проверка доступности</small></span>
        </a>
        <div className="topbar-meta">
          <span className="endpoint mono">HEAD · /api/jobs</span>
          <span className={`connection ${store.error ? 'offline' : ''}`}><i />{store.error ? 'API недоступен' : 'API подключён'}</span>
        </div>
      </header>

      <main className="shell" id="main-content">
        <aside className="control-column" aria-label="Управление проверками">
          <JobForm creating={store.creating} onCreate={store.createJob} />
          <JobsList jobs={store.jobs} activeId={store.activeJobId} loading={store.listLoading} onSelect={(id) => void store.selectJob(id)} />
        </aside>
        <section className="workspace" aria-label="Детали задания">
          <div className="workspace-top">
            <span><i className="workspace-index mono">02</i> Мониторинг задания</span>
            <span className="workspace-note mono">обновление каждые 1,5 с</span>
          </div>
          {store.error && <div role="alert" className="error-banner"><span>{store.error}</span><button onClick={() => useJobsStore.setState({ error: null })} aria-label="Закрыть сообщение">×</button></div>}
          <JobDetail detail={store.detail} loading={store.detailLoading} cancelling={store.cancelling} onCancel={() => void store.cancelActive()} />
        </section>
      </main>
    </div>
  </>;
}
