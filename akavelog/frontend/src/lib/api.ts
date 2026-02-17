const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export type ConfigField = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
};

export type InputTypeInfo = {
  type: string;
  description: string;
  fields: ConfigField[];
};

export type InputItem = {
  id: string;
  type: string;
  title: string;
  configuration: Record<string, unknown>;
  created_at: string;
  state: string;
};

export type LogEntry = {
  entry: {
    timestamp: string;
    service: string;
    level: string;
    message: string;
    tags?: Record<string, string>;
  };
  received_at: string;
};

export type UploadStatus = {
  batcher_enabled: boolean;
  last_upload_at: string;
  last_upload_key: string;
  last_upload_count: number;
  pending_count: number;
};

export async function getInputTypes(): Promise<{ types: string[] }> {
  const r = await fetch(`${API}/inputs/types`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getTypeInfo(typeName: string): Promise<InputTypeInfo> {
  const r = await fetch(`${API}/inputs/types/${encodeURIComponent(typeName)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getInputs(): Promise<{ inputs: InputItem[] }> {
  const r = await fetch(`${API}/inputs`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function createInput(body: {
  type: string;
  title?: string;
  description?: string;
  listen?: string;
  config?: Record<string, unknown>;
}): Promise<InputItem> {
  const r = await fetch(`${API}/inputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getRecentLogs(): Promise<{ logs: LogEntry[] }> {
  const r = await fetch(`${API}/logs/recent`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getUploadStatus(): Promise<UploadStatus> {
  const r = await fetch(`${API}/logs/status`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function getIngestUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return `${base || ''}/api/ingest/${path}`.replace(/\/+/g, '/');
}

export async function sendTestLog(ingestPath: string, payload: object): Promise<void> {
  const url = `${API}/ingest/${ingestPath}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
}
