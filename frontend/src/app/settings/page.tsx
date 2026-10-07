'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound, CheckCircle, Save } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { AppSettings, CuratedModel } from '@/lib/types';

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [weights, setWeights] = useState({ token: 20, ast: 20, cfg: 20, semantic: 40 });
  const [sieve, setSieve] = useState(0.1);
  const [collusion, setCollusion] = useState(0.6);
  const [defaultModels, setDefaultModels] = useState<string[]>([]);
  const [keyInput, setKeyInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [curated, setCurated] = useState<CuratedModel[]>([]);

  useEffect(() => {
    apiGet<AppSettings>('/api/settings').then((s) => {
      setSettings(s);
      setWeights({
        token: Math.round(s.weights.token * 100),
        ast: Math.round(s.weights.ast * 100),
        cfg: Math.round(s.weights.cfg * 100),
        semantic: Math.round(s.weights.semantic * 100),
      });
      setSieve(s.sieve_threshold);
      setCollusion(s.collusion_threshold);
      setDefaultModels(s.default_models || []);
    }).catch((e) => setError(`Failed to load settings: ${e}`));
    apiGet<{ curated: CuratedModel[] }>('/api/openrouter/models').then((m) => setCurated(m.curated || [])).catch(() => {});
    apiGet<{ has_key: boolean }>('/api/openrouter/status').then((s) => setStatus(s.has_key ? 'Key configured ✓' : 'No key configured')).catch(() => {});
  }, []);

  const total = weights.token + weights.ast + weights.cfg + weights.semantic;

  const save = async () => {
    setError(null);
    if (total !== 100) {
      setError(`Tier weights must sum to 100% (currently ${total}%).`);
      return;
    }
    try {
      const updated = await apiPut<AppSettings>('/api/settings', {
        weights: { token: weights.token / 100, ast: weights.ast / 100, cfg: weights.cfg / 100, semantic: weights.semantic / 100 },
        sieve_threshold: sieve,
        collusion_threshold: collusion,
        default_models: defaultModels,
      });
      setSettings(updated);
      setStatus('Settings saved ✓');
    } catch (e) {
      setError(`Save failed: ${e}`);
    }
  };

  const saveKey = async () => {
    setError(null);
    try {
      await apiPost('/api/openrouter/key', { api_key: keyInput.trim() });
      setKeyInput('');
      setStatus('Key configured ✓');
      const s = await apiGet<AppSettings>('/api/settings');
      setSettings(s);
    } catch (e) {
      setError(`Key rejected: ${e}`);
    }
  };

  const removeKey = async () => {
    await apiDelete('/api/openrouter/key');
    setStatus('No key configured');
  };

  const slider = (key: keyof typeof weights, label: string) => (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 700 }}>{weights[key]}%</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={weights[key]} onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent-blue)' }} />
    </div>
  );

  return (
    <div style={{ maxWidth: '860px' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Settings</h1>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        OpenRouter key, default generation models, fusion weights, and detection thresholds.
      </p>
      {error && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent-red)' }}>
          <span style={{ fontSize: '0.8rem', color: '#e87070' }}>{error}</span>
        </div>
      )}
      {status && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CheckCircle size={13} /> {status}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title"><KeyRound size={14} /> OpenRouter API key</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Free to create at openrouter.ai — required for the “Fetch AI answers” feature. Stored server-side in SQLite.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} type="password" placeholder="sk-or-v1-…" style={inputStyle} />
          <button className="btn btn-primary" onClick={saveKey} disabled={!keyInput.trim()}>Test & save</button>
          <button className="btn btn-ghost" onClick={removeKey}>Remove</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Default generation models</div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Pre-selected in Assignments → Fetch AI answers (pick 2–3).</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
          {curated.map((m) => (
            <label key={m.slug} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.78rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.45rem 0.6rem', cursor: 'pointer', background: defaultModels.includes(m.slug) ? 'var(--bg-elevated)' : 'transparent' }}>
              <input type="checkbox" checked={defaultModels.includes(m.slug)} onChange={(e) => setDefaultModels(e.target.checked ? [...defaultModels, m.slug].slice(0, 4) : defaultModels.filter((x) => x !== m.slug))} />
              <span><strong>{m.name}</strong> <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{m.slug}</span></span>
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Tier fusion weights (must sum to 100%)</div>
        {slider('token', 'Token winnowing')}
        {slider('ast', 'AST normalization')}
        {slider('cfg', 'CFG isomorphism')}
        {slider('semantic', 'CodeBERT semantic')}
        <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: total === 100 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
          Total: {total}%
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title">Thresholds</div>
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 600 }}>Sieve threshold (skip deep scan below this token overlap)</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 700 }}>{Math.round(sieve * 100)}%</span>
          </div>
          <input type="range" min={0.05} max={0.5} step={0.05} value={sieve} onChange={(e) => setSieve(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-blue)' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
            <span style={{ fontWeight: 600 }}>Collusion threshold (flag student pairs above this)</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', fontWeight: 700 }}>{Math.round(collusion * 100)}%</span>
          </div>
          <input type="range" min={0.3} max={0.95} step={0.05} value={collusion} onChange={(e) => setCollusion(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-blue)' }} />
        </div>
        <div style={{ marginTop: '0.85rem' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            Force-scan default is per-scan (Scan / Bulk pages pass force=true). Sieve and collusion thresholds above are server defaults.
          </label>
        </div>
      </div>

      <button className="btn btn-primary" onClick={save} style={{ width: '100%', padding: '0.7rem' }}>
        <Save size={14} /> Save all settings
      </button>
      {settings && (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.6rem', fontFamily: 'var(--font-mono)' }}>
          Server: weights {JSON.stringify(settings.weights)} · sieve {settings.sieve_threshold} · collusion {settings.collusion_threshold} · key {settings.has_api_key ? 'set' : 'missing'}
        </p>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
  padding: '0.5rem 0.65rem',
  outline: 'none',
};
