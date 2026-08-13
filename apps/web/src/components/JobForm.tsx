import { FormEvent, useState } from 'react';

type Props = { creating: boolean; onCreate: (urls: string) => Promise<boolean> };

export function JobForm({ creating, onCreate }: Props) {
  const [urls, setUrls] = useState('https://example.com\nhttps://httpbin.org/status/200');
  const urlCount = urls.split('\n').filter((url) => url.trim()).length;
  const tooManyUrls = urlCount > 50;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onCreate(urls)) setUrls('');
  };
  return <section className="launch-panel">
    <header className="panel-heading">
      <div><span className="eyebrow">Новая проверка</span><h2>Какие адреса проверить?</h2></div>
      <span className="panel-number mono">01</span>
    </header>
    <form className="job-form" onSubmit={submit} aria-busy={creating}>
      <label htmlFor="urls">URL-адреса</label>
      <div className="textarea-shell">
        <textarea id="urls" value={urls} onChange={(event) => setUrls(event.target.value)} placeholder={'https://example.com\nhttps://service.example/health'} spellCheck="false" aria-describedby="urls-hint" aria-invalid={tooManyUrls} />
        <span className={`url-counter mono ${tooManyUrls ? 'over-limit' : ''}`}>{urlCount} / 50</span>
      </div>
      <p id="urls-hint" className={`form-hint ${tooManyUrls ? 'form-hint-error' : ''}`}>{tooManyUrls ? 'Можно проверить не больше 50 адресов за один запуск.' : 'По одному адресу в строке. Поддерживаются HTTP и HTTPS.'}</p>
      <button className="launch-button" type="submit" disabled={creating || urlCount === 0 || tooManyUrls}>
        <span>{creating ? 'Создаём задание…' : 'Запустить проверку'}</span><i aria-hidden="true">↗</i>
      </button>
    </form>
  </section>;
}
