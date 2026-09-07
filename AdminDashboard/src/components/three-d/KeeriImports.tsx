"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  cancelKeeriImportBatch,
  fetchKeeriImportBatches,
  queueKeeriImportBatch,
  retryKeeriImportBatch,
  type KeeriImportBatch,
} from "@/lib/three-d-api";
import { dateLabel, ErrorMessage } from "./Fields";

const active = (batch: KeeriImportBatch) => batch.status === "queued" || batch.status === "running";
const statusLabel = (batch: KeeriImportBatch) => ({
  queued: "Waiting for import worker",
  running: "Importing approved inputs",
  completed: "Import complete",
  failed: "Import needs attention",
  cancelled: "Import cancelled",
})[batch.status];
const progressKey = (batch: KeeriImportBatch) => `${batch.status}:${batch.counts.imported}:${batch.counts.unchanged}`;

export default function KeeriImports({ enabled, onInputsChanged, onConfigRefresh }: {
  enabled: boolean;
  onInputsChanged: () => Promise<void>;
  onConfigRefresh: () => Promise<void>;
}) {
  const [batches, setBatches] = useState<KeeriImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const mounted = useRef(false);
  const lock = useRef(false);
  const requestId = useRef(0);
  const pendingRequest = useRef<AbortController | null>(null);
  const observedProgress = useRef(new Map<string, string>());
  const enqueueKeys = useRef(new Map<string, string>());
  const callbacks = useRef({ onInputsChanged, onConfigRefresh });
  callbacks.current = { onInputsChanged, onConfigRefresh };

  const load = useCallback(async () => {
    const request = ++requestId.current;
    pendingRequest.current?.abort();
    const controller = new AbortController();
    pendingRequest.current = controller;
    if (!enabled) {
      setLoading(false);
      setLoadError(null);
      setBatches([]);
      return;
    }
    try {
      const result = await fetchKeeriImportBatches(controller.signal);
      if (!mounted.current || request !== requestId.current || controller.signal.aborted) return;
      let changed = false;
      for (const batch of result.batches) {
        const previous = observedProgress.current.get(batch.id);
        if (previous ? previous !== progressKey(batch) : batch.counts.imported + batch.counts.unchanged > 0) changed = true;
        observedProgress.current.set(batch.id, progressKey(batch));
      }
      setBatches(result.batches);
      setLoadError(null);
      if (changed) await callbacks.current.onInputsChanged();
    } catch (cause) {
      if (mounted.current && request === requestId.current && !controller.signal.aborted)
        setLoadError(cause instanceof Error ? cause.message : "Recent imports could not be loaded.");
    } finally {
      if (mounted.current && request === requestId.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    if (enabled) setLoading(true);
    async function poll() {
      await load();
      if (!cancelled && enabled) timer = setTimeout(() => void poll(), 4000);
    }
    void poll();
    return () => {
      cancelled = true;
      mounted.current = false;
      clearTimeout(timer);
      requestId.current += 1;
      pendingRequest.current?.abort();
    };
  }, [load, enabled]);

  async function run(key: string, operation: () => Promise<{ batch: KeeriImportBatch }>) {
    if (lock.current) return;
    lock.current = true;
    requestId.current += 1;
    pendingRequest.current?.abort();
    setBusy(key);
    setActionError(null);
    try {
      const { batch } = await operation();
      if (!mounted.current) return;
      const previous = observedProgress.current.get(batch.id);
      const changed = previous ? previous !== progressKey(batch) : batch.counts.imported + batch.counts.unchanged > 0;
      observedProgress.current.set(batch.id, progressKey(batch));
      setBatches(current => [batch, ...current.filter(item => item.id !== batch.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20));
      if (changed) await callbacks.current.onInputsChanged();
      await load();
    } catch (cause) {
      if (!mounted.current) return;
      setActionError(cause instanceof Error ? cause.message : "The import action could not be completed.");
      await Promise.all([load(), callbacks.current.onConfigRefresh()]);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function enqueue(cursor?: string) {
    const key = cursor ?? "__new_scan__";
    const idempotencyKey = enqueueKeys.current.get(key) ?? crypto.randomUUID();
    enqueueKeys.current.set(key, idempotencyKey);
    return run(cursor ? "next-page" : "new-scan", async () => {
      const response = await queueKeeriImportBatch(idempotencyKey, cursor);
      enqueueKeys.current.delete(key);
      return response;
    });
  }

  const latest = batches[0];
  const hasActive = batches.some(active);
  const unavailable = !enabled || !!busy || loading || !!loadError || hasActive;
  return (
    <section className="glass-card space-y-4 p-4" aria-label="Keeri imports">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Approved inputs from Keeri</h3>
          <p className="mt-1 max-w-2xl text-xs text-admin-text-muted">Each import saves one page of approved products and their original images. Imports continue after you leave this page. Production and publishing stay in Maple.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {latest?.nextCursor && latest.listLoadedAt && !hasActive && <Button variant="secondary" size="sm" disabled={unavailable} isLoading={busy === "next-page"} onClick={() => void enqueue(latest.nextCursor!)}><Download className="h-3.5 w-3.5" />Import next page</Button>}
          <Button variant="secondary" size="sm" disabled={unavailable} isLoading={busy === "new-scan"} onClick={() => void enqueue()}><Download className="h-3.5 w-3.5" />{latest ? "Start a new scan" : "Import from Keeri"}</Button>
          <Button variant="ghost" size="sm" disabled={!!busy} aria-label="Refresh Keeri imports" onClick={() => { void Promise.all([load(), callbacks.current.onConfigRefresh()]); }}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <ErrorMessage message={actionError} />
      <ErrorMessage message={loadError} />
      {loading && <p role="status" className="text-xs text-admin-text-muted">Loading saved imports…</p>}
      {!enabled && <p className="text-xs text-admin-text-muted">Connect Keeri to load saved imports and approved product inputs. Manual products can be prepared now.</p>}
      {enabled && !loading && !loadError && !batches.length && <p className="text-xs text-admin-text-muted">No imports yet. Import a page of approved products to begin.</p>}
      {batches.length > 0 && <div className="space-y-3">
        {batches.map((batch, index) => (
          <details key={batch.id} open={index === 0 ? true : undefined} className="rounded-xl border border-admin-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {statusLabel(batch)} · {dateLabel(batch.createdAt)}
            </summary>
            <div className="mt-3 space-y-3 text-xs text-admin-text-muted">
              <div className="flex flex-wrap items-center gap-2"><Badge variant={batch.status === "completed" ? "success" : batch.status === "failed" ? "warning" : "default"}>{statusLabel(batch)}</Badge><span>{batch.cursor ? "Continuation page" : "First page of scan"}</span></div>
              {batch.status === "queued" && <p>The import is saved. It will start when the Maple import worker is running.</p>}
              <p>{batch.counts.imported} imported · {batch.counts.unchanged} unchanged · {batch.counts.failed} failed · {batch.counts.cancelled} cancelled{batch.listLoadedAt ? ` · ${batch.counts.total} total` : active(batch) ? " · Waiting for the product list" : " · Product list was not fetched"}</p>
              {batch.counts.total > 0 && <progress className="h-2 w-full accent-admin-accent" aria-label="Products processed" max={batch.counts.total} value={batch.counts.imported + batch.counts.unchanged + batch.counts.failed + batch.counts.cancelled} />}
              <p>{(batch.bytesReserved / 1024 / 1024).toFixed(1)} MB of {(batch.maxBytes / 1024 / 1024).toFixed(0)} MB import download allowance used. Retries keep the same allowance.</p>
              {batch.errorMessage && <p className="text-admin-danger">{batch.errorMessage}</p>}
              {batch.status === "cancelled" && <p>Files already imported stay in Maple. Start a new scan to check the remaining products.</p>}
              {batch.status === "completed" && <p>{batch.nextCursor ? "More products are available. Import the next page to continue this scan." : "The last page was reached. Start a new scan when you want to check for updates."}</p>}
              {(batch.status === "failed" || batch.items.some(item => item.status === "failed")) && <p>Retry keeps successful imports and only attempts eligible failures. Products changed since approval need a new scan after Keeri approval is updated.</p>}
              {batch.items.length > 0 && <ul className="max-h-56 space-y-2 overflow-y-auto">
                {batch.items.map(item => <li key={item.id} className="rounded-lg bg-admin-bg/40 p-2"><p className="break-all font-medium text-admin-text">{item.name || item.code || item.modelId} · {item.status}</p>{item.errorMessage && <p className="mt-1 text-admin-danger">{item.errorMessage}</p>}{item.errorCode === "SOURCE_CHANGED" && <p className="mt-1">A new approved revision is needed. This item cannot be retried from the old scan.</p>}</li>)}
              </ul>}
              <div className="flex flex-wrap gap-2">
                {batch.canRetry && <Button variant="secondary" size="sm" disabled={!enabled || !!busy || hasActive} isLoading={busy === `retry-${batch.id}`} onClick={() => void run(`retry-${batch.id}`, () => retryKeeriImportBatch(batch.id))}>Retry failed products</Button>}
                {batch.canCancel && <Button variant="ghost" size="sm" disabled={!!busy} isLoading={busy === `cancel-${batch.id}`} onClick={() => void run(`cancel-${batch.id}`, () => cancelKeeriImportBatch(batch.id))}>Cancel remaining import</Button>}
              </div>
            </div>
          </details>
        ))}
      </div>}
    </section>
  );
}
