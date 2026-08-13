import { useEffect } from 'react';
import { JobDetail } from './components/JobDetail';
import { JobForm } from './components/JobForm';
import { JobsList } from './components/JobsList';
import { useJobsStore } from './store/jobsStore';

export default function App() {
  const store = useJobsStore();
  useEffect(() => { void store.loadJobs(); return () => store.stopPolling(); }, []); // store singleton actions stable
  return <main className="shell">
    <aside className="control-column"><header className="brand"><span className="brand-dot" /><span>URL / INSPECTOR</span><small>ASYNC HEAD PROBE</small></header>
      <JobForm creating={store.creating} onCreate={store.createJob} />
      <JobsList jobs={store.jobs} activeId={store.activeJobId} loading={store.listLoading} onSelect={(id) => void store.selectJob(id)} />
    </aside>
    <section className="workspace">
      <div className="workspace-top"><span className="mono">NETWORK OPERATIONS / 01</span><span className={`connection ${store.error ? 'offline' : ''}`}><i /> {store.error ? 'API ERROR' : 'API ONLINE'}</span></div>
      {store.error && <div role="alert" className="error-banner">{store.error}<button onClick={() => useJobsStore.setState({ error: null })} aria-label="Закрыть сообщение">×</button></div>}
      <JobDetail detail={store.detail} loading={store.detailLoading} cancelling={store.cancelling} onCancel={() => void store.cancelActive()} />
    </section>
  </main>;
}
