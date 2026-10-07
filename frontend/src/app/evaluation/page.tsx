'use client';

import React, { useEffect, useState } from 'react';
import { FlaskConical, Database, Play } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';

type Counts = { exists: boolean; total: number; human: number; ai: number };

export default function EvaluationPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setCounts(await apiGet<Counts>('/api/evaluation/status'));
    } catch (e) {
      setError(`Status failed: ${e}`);
    }
  };

  useEffect(() => { refresh(); }, []);

  const run = async (kind: 'dataset/build' | 'baseline' | 'stylometrics') => {
    setBusy(kind); setError(null); setResult(null);
    try {
      const res = await apiPost<any>(`/api/evaluation/${kind}`);
      setResult({ kind, ...res });
      await refresh();
    } catch (e) {
      setError(`${kind} failed: ${e}`);
    } finally {
      setBusy(null);
    }
  };

  const overall = result?.metrics?.overall;

  return (
    <div style={{ maxWidth: '860px' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Evaluation harness</h1>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        How the Scan numbers work: dataset → baseline (Token+AST+CFG+CodeBERT fusion) → stylometrics.
        Small-n results are smoke tests only — need ≥300 human samples to claim 1% FPR.
      </p>
      {error && <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent-red)' }}><span style={{ fontSize: '0.8rem', color: '#e87070' }}>{error}</span></div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title"><Database size={14} /> Benchmark dataset</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {counts ? `${counts.total} samples (${counts.human} human, ${counts.ai} AI)` : 'Loading…'}
        </p>
        <button className="btn" onClick={() => run('dataset/build')} disabled={busy !== null}><Play size={13} /> {busy === 'dataset/build' ? 'Building…' : 'Rebuild from storage/'}</button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title"><FlaskConical size={14} /> Run evaluators</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => run('baseline')} disabled={busy !== null}>{busy === 'baseline' ? 'Running…' : 'Run Astra baseline'}</button>
          <button className="btn btn-primary" onClick={() => run('stylometrics')} disabled={busy !== null}>{busy === 'stylometrics' ? 'Running…' : 'Run stylometrics'}</button>
        </div>
      </div>

      {overall && (
        <div className="card">
          <div className="card-title">Results — {result.kind}</div>
          {overall.unreliable_small_n && (
            <p style={{ fontSize: '0.8rem', color: '#e8a13c', fontWeight: 600 }}>⚠ {overall.warning}</p>
          )}
          <pre style={{ fontSize: '0.75rem', background: 'var(--bg-base)', padding: '0.75rem', borderRadius: '8px', overflowX: 'auto' }}>
            {JSON.stringify(result.metrics, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
