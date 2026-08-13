import { FormEvent, useState } from 'react';

type Props = { creating: boolean; onCreate: (urls: string) => Promise<boolean> };

export function JobForm({ creating, onCreate }: Props) {
  const [urls, setUrls] = useState('https://example.com\nhttps://httpbin.org/status/200');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await onCreate(urls)) setUrls('');
  };
  return <form className="job-form" onSubmit={submit}>
    <div className="section-label"><span>НОВЫЙ ЗАПУСК</span><span className="mono">POST /api/jobs</span></div>
    <label htmlFor="urls">Адреса для проверки</label>
    <textarea id="urls" value={urls} onChange={(event) => setUrls(event.target.value)} placeholder={'https://example.com\nhttps://service.example/health'} spellCheck="false" />
    <div className="form-footer"><span>Один URL в строке</span><button type="submit" disabled={creating}>{creating ? 'Создаём…' : 'Запустить проверку'}</button></div>
  </form>;
}
