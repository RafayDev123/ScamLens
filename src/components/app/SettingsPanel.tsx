"use client";

import { Copy, KeyRound, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { btn, Card, input } from "@/components/ui";

interface Prefs { theme: string; autoSaveHistory: boolean; retentionDays: number; notifyProductUpdates: boolean; notifySecurityAlerts: boolean }
interface Key { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message ?? "Request failed");
  return j?.data;
}

export function SettingsPanel({ email, name }: { email: string; name: string | null }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [displayName, setDisplayName] = useState(name ?? "");
  const [keys, setKeys] = useState<Key[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, k] = await Promise.all([call("/api/account", "GET"), call("/api/account/api-keys", "GET")]);
      setPrefs(a.preferences ?? { theme: "dark", autoSaveHistory: true, retentionDays: 90, notifyProductUpdates: false, notifySecurityAlerts: true });
      setKeys(k.keys);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed to load settings" });
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<string | void>) {
    setMsg(null);
    try {
      const t = await fn();
      if (t) setMsg({ ok: true, text: t });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Action failed" });
    }
  }
  const savePrefs = (patch: Partial<Prefs> & { displayName?: string }) => act(async () => {
    const r = await call("/api/account", "PATCH", patch);
    setPrefs(r.preferences);
    return "Settings saved.";
  });

  if (!prefs) return <p className="text-sm text-muted" role="status">{msg?.text ?? "Loading settings…"}</p>;
  const check = "h-5 w-5 accent-[var(--accent)]";
  return (
    <div className="space-y-6">
      <div aria-live="polite">{msg && <p role={msg.ok ? "status" : "alert"} className={`rounded-md border p-3 text-sm ${msg.ok ? "border-ok/40 bg-ok/10" : "border-danger/50 bg-danger/10 text-danger"}`}>{msg.text}</p>}</div>

      <Card as="section" className="space-y-3 p-5"><h2 className="font-semibold">Profile</h2>
        <p className="text-sm text-muted">Email: <span className="mono text-fg">{email}</span></p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void savePrefs({ displayName }); }}><label className="sr-only" htmlFor="dn">Display name</label><input id="dn" className={input} value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" /><button className={btn.secondary}>Save name</button></form>
      </Card>

      <Card as="section" className="space-y-4 p-5"><h2 className="font-semibold">Privacy &amp; history</h2>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className={check} checked={prefs.autoSaveHistory} onChange={(e) => void savePrefs({ autoSaveHistory: e.target.checked })} /><span><b>Save scans to my history.</b> <span className="text-muted">When off, reports are temporary (24 h) unless you press “Save to history”.</span></span></label>
        <div className="flex flex-wrap items-center gap-3 text-sm"><label htmlFor="ret"><b>Retention</b> <span className="text-muted">(days before saved reports are deleted)</span></label><input id="ret" type="number" min={1} max={365} className={`${input} w-28`} defaultValue={prefs.retentionDays} onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 365 && v !== prefs.retentionDays) void savePrefs({ retentionDays: v }); }} /></div>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <a className={btn.secondary} href="/api/account/export" download>Export all my data (JSON)</a>
          <button className={btn.danger} onClick={() => confirm("Delete ALL scan history permanently?") && void act(async () => `${(await call("/api/account", "DELETE", { scope: "history" })).deleted} record(s) deleted.`)}><Trash2 size={16} aria-hidden />Delete all history</button>
        </div>
      </Card>

      <Card as="section" className="space-y-3 p-5"><h2 className="font-semibold">Notifications</h2>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className={check} checked={prefs.notifySecurityAlerts} onChange={(e) => void savePrefs({ notifySecurityAlerts: e.target.checked })} /><span>Account security alerts</span></label>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className={check} checked={prefs.notifyProductUpdates} onChange={(e) => void savePrefs({ notifyProductUpdates: e.target.checked })} /><span>Product updates</span></label>
        <p className="text-xs text-muted">Preferences are stored; messages are only sent when the operator has configured an email provider.</p>
      </Card>

      <Card as="section" className="space-y-3 p-5"><h2 className="flex items-center gap-2 font-semibold"><KeyRound size={16} aria-hidden />API keys</h2>
        <p className="text-sm text-muted">Use keys with <code className="mono">Authorization: Bearer …</code>. See <a className="text-accent underline" href="/developers">API docs</a>. A key is shown once.</p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void act(async () => { const r = await call("/api/account/api-keys", "POST", { name: keyName }); setNewKey(r.key); setKeyName(""); await load(); }); }}><label className="sr-only" htmlFor="kn">Key name</label><input id="kn" className={input} required maxLength={60} value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="Key name, e.g. “CI pipeline”" /><button className={btn.primary}>Create key</button></form>
        {newKey && <div className="rounded-md border border-warn/50 bg-warn/10 p-3 text-sm"><p className="font-medium">Copy your new key now – it will not be shown again.</p><div className="mt-2 flex gap-2"><input readOnly aria-label="New API key" value={newKey} className={`${input} mono text-xs`} onFocus={(e) => e.currentTarget.select()} /><button className={btn.secondary} onClick={() => void navigator.clipboard.writeText(newKey)} aria-label="Copy key"><Copy size={16} aria-hidden /></button></div></div>}
        {keys.length === 0 ? <p className="text-sm text-muted">No active keys.</p> : <ul className="divide-y divide-line rounded-md border border-line">{keys.map((k) => <li key={k.id} className="flex items-center justify-between gap-2 p-3 text-sm"><span><b>{k.name}</b> <span className="mono text-xs text-muted">{k.prefix}…</span><br /><span className="text-xs text-muted">Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</span></span><button className={btn.danger} onClick={() => void act(async () => { await call(`/api/account/api-keys?id=${k.id}`, "DELETE"); await load(); return "Key revoked."; })}>Revoke</button></li>)}</ul>}
      </Card>

      <Card as="section" className="space-y-3 border-danger/40 p-5"><h2 className="font-semibold text-danger">Delete account</h2>
        <p className="text-sm text-muted">Permanently deletes your account, history, reports, share links and API keys.</p>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (confirm("Delete your account permanently?")) void act(async () => { await call("/api/account", "DELETE", { scope: "account", password: pw }); window.location.href = "/"; }); }}><label className="sr-only" htmlFor="dpw">Confirm password</label><input id="dpw" type="password" autoComplete="current-password" className={input} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Confirm your password" /><button className={btn.danger}>Delete account</button></form>
      </Card>
    </div>
  );
}
