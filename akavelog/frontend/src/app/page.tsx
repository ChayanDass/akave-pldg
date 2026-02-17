'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createInput,
  getInputs,
  getRecentLogs,
  getTypeInfo,
  getUploadStatus,
  sendTestLog,
  type InputItem,
  type InputTypeInfo,
  type LogEntry,
  type UploadStatus as UploadStatusType,
} from '@/lib/api';

export default function DemoPage() {
  const [inputs, setInputs] = useState<InputItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatusType | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [httpTypeInfo, setHttpTypeInfo] = useState<InputTypeInfo | null>(null);
  const [newTitle, setNewTitle] = useState('my-http-input');
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  const loadInputs = useCallback(async () => {
    try {
      const { inputs: list } = await getInputs();
      setInputs(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inputs');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const { logs: list } = await getRecentLogs();
      setLogs(list);
    } catch {
      // ignore
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const st = await getUploadStatus();
      setUploadStatus(st);
    } catch {
      setUploadStatus(null);
    }
  }, []);

  useEffect(() => {
    loadInputs();
  }, [loadInputs]);

  useEffect(() => {
    getTypeInfo('http')
      .then((info) => {
        setHttpTypeInfo(info);
        const initial: Record<string, string> = {};
        info.fields.forEach((f) => {
          initial[f.name] = f.example ?? '';
        });
        setFormValues(initial);
      })
      .catch(() => setHttpTypeInfo(null));
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      loadLogs();
      loadStatus();
    }, 2000);
    return () => clearInterval(t);
  }, [loadLogs, loadStatus]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const config: Record<string, unknown> = {};
      Object.entries(formValues).forEach(([k, v]) => {
        const trimmed = typeof v === 'string' ? v.trim() : v;
        if (trimmed !== '') config[k] = trimmed;
      });
      await createInput({
        type: 'http',
        title: newTitle.trim() || undefined,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      await loadInputs();
      setNewTitle('');
      if (httpTypeInfo) {
        const reset: Record<string, string> = {};
        httpTypeInfo.fields.forEach((f) => {
          reset[f.name] = f.example ?? '';
        });
        setFormValues(reset);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleSendTest = async (ingestPath: string) => {
    try {
      await sendTestLog(ingestPath, {
        service: 'demo-ui',
        message: `Test log at ${new Date().toISOString()}`,
        level: 'info',
        tags: { source: 'web' },
      });
      await loadLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    }
  };

  const ingestPath = (input: InputItem) => {
    const cfg = input.configuration as { description?: string };
    return (cfg?.description as string) || 'raw';
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-4 p-4 bg-[var(--bg)]">
      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <header className="border-b border-[var(--border)] pb-2">
          <h1 className="text-xl font-semibold text-[var(--accent)]">Akavelog Demo</h1>
          <p className="text-sm text-[var(--muted)]">Create HTTP input, send logs, watch uploads to Akave O3</p>
        </header>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        {/* Create HTTP input — form driven by backend type config */}
        <section className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-medium text-[var(--muted)] mb-3">1. Create HTTP input</h2>
          {!httpTypeInfo ? (
            <p className="text-sm text-[var(--muted)]">Loading input config…</p>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--muted)]">Title</span>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="my-http-input"
                  className="rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm w-40"
                />
              </label>
              {httpTypeInfo.fields.map((field) => (
                <label key={field.name} className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--muted)]">
                    {field.description}
                    {field.required ? ' *' : ''}
                  </span>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={formValues[field.name] ?? ''}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                    }
                    placeholder={field.example}
                    className="rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm w-40"
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-[var(--accent)] text-[var(--bg)] px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create input'}
              </button>
            </form>
          )}
        </section>

        {/* Inputs list */}
        <section className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 flex-1 min-h-0 flex flex-col">
          <h2 className="text-sm font-medium text-[var(--muted)] mb-3">2. Your inputs</h2>
          {inputs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Create an input above. Then use “Send test log” to post to /ingest/raw.</p>
          ) : (
            <ul className="space-y-2 overflow-auto">
              {inputs.map((inp) => (
                <li
                  key={inp.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <span className="font-mono text-[var(--accent)]">{inp.title}</span>
                  <span className="text-[var(--muted)]">/ingest/{ingestPath(inp)}</span>
                  <span className="text-xs text-[var(--success)]">{inp.state}</span>
                  <button
                    type="button"
                    onClick={() => handleSendTest(ingestPath(inp))}
                    className="rounded bg-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--bg)] px-2 py-1 text-xs"
                  >
                    Send test log
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Incoming logs */}
        <section className="rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 flex-1 min-h-[200px] flex flex-col">
          <h2 className="text-sm font-medium text-[var(--muted)] mb-3">3. Incoming logs (last 200)</h2>
          <div className="flex-1 overflow-auto rounded-lg bg-[var(--bg)] border border-[var(--border)] p-2 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-[var(--muted)]">Logs will appear here after you send to /ingest/raw. Polling every 2s.</p>
            ) : (
              <ul className="space-y-1">
                {[...logs].reverse().map((l, i) => (
                  <li key={i} className="border-b border-[var(--border)]/50 pb-1">
                    <span className="text-[var(--muted)]">{new Date(l.received_at).toLocaleTimeString()}</span>
                    {' '}
                    <span className="text-[var(--warn)]">{l.entry.service}</span>
                    {' '}
                    <span className="text-[var(--accent)]">{l.entry.level}</span>
                    {' '}
                    {l.entry.message}
                    {l.entry.tags && Object.keys(l.entry.tags).length > 0 && (
                      <span className="text-[var(--muted)]"> {JSON.stringify(l.entry.tags)}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Side panel: upload status */}
      <aside className="w-full md:w-80 shrink-0 rounded-xl bg-[var(--card)] border border-[var(--border)] p-4 h-fit">
        <h2 className="text-sm font-medium text-[var(--muted)] mb-3">Upload status (O3)</h2>
        {!uploadStatus ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : (
          <div className="space-y-3 text-sm">
            <p>
              Batcher:{' '}
              <span className={uploadStatus.batcher_enabled ? 'text-[var(--success)]' : 'text-[var(--muted)]'}>
                {uploadStatus.batcher_enabled ? 'On' : 'Off'}
              </span>
            </p>
            {uploadStatus.batcher_enabled && (
              <>
                <p className="text-[var(--muted)]">
                  Last upload: {uploadStatus.last_upload_count} logs
                </p>
                {uploadStatus.last_upload_at && (
                  <p className="text-xs text-[var(--muted)]">
                    {new Date(uploadStatus.last_upload_at).toLocaleString()}
                  </p>
                )}
                {uploadStatus.last_upload_key && (
                  <p className="text-xs font-mono text-[var(--accent)] break-all">
                    {uploadStatus.last_upload_key}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
