'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Sparkles, Upload, RefreshCw } from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Assignment, VaultRef, CuratedModel, AppSettings, LanguageKey } from '@/lib/types';

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Assignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', problem_statement: '', language: 'cpp' as LanguageKey });

  // vault add
  const [refName, setRefName] = useState('');
  const [refCode, setRefCode] = useState('');
  const [refLang, setRefLang] = useState<LanguageKey>('cpp');

  // openrouter generate
  const [curated, setCurated] = useState<CuratedModel[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [genLang, setGenLang] = useState<LanguageKey>('cpp');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ code: string; model: string; valid: boolean; error: string | null }[] | null>(null);
  const [defaultModels, setDefaultModels] = useState<string[]>([]);

  useEffect(() => {
    refresh();
    apiGet<{ curated: CuratedModel[]; has_key: boolean }>('/api/openrouter/models')
      .then((m) => {
        setCurated(m.curated || []);
        setHasKey(m.has_key);
      })
      .catch(() => {});
    apiGet<AppSettings>('/api/settings').then((s) => {
      setDefaultModels(s.default_models || []);
      if (s.default_models?.length) setPicked(s.default_models.slice(0, 3));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      const data = await apiGet<Assignment[]>('/api/assignments');
      setAssignments(data);
      if (data.length > 0 && activeId === null) {
        setActiveId(data[0].id);
        loadDetail(data[0].id);
      } else if (activeId !== null) {
        loadDetail(activeId);
      }
    } catch (e) {
      setError(`Failed to load assignments: ${e}`);
    }
  };

  const loadDetail = async (id: number) => {
    try {
      const d = await apiGet<Assignment>(`/api/assignments/${id}`);
      setDetail(d);
    } catch (e) {
      setError(`Failed to load assignment: ${e}`);
    }
  };

  const createAssignment = async () => {
    if (!form.name.trim()) {
      setError('Assignment name is required.');
      return;
    }
    setCreating(true);
    try {
      const created = await apiPost<Assignment>('/api/assignments', {
        name: form.name.trim(),
        description: form.description.trim(),
        problem_statement: form.problem_statement.trim() || form.description.trim(),
      });
      setForm({ name: '', description: '', problem_statement: '', language: 'cpp' });
      await refresh();
      setActiveId(created.id);
      await loadDetail(created.id);
    } catch (e) {
      setError(`Create failed: ${e}`);
    } finally {
      setCreating(false);
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    try {
      await apiPut(`/api/assignments/${detail.id}`, {
        name: detail.name,
        description: detail.description,
        problem_statement: detail.problem_statement,
      });
      await refresh();
    } catch (e) {
      setError(`Save failed: ${e}`);
    }
  };

  const deleteAssignment = async (id: number) => {
    if (!confirm('Delete this assignment and all its submissions/reports?')) return;
    try {
      await apiDelete(`/api/assignments/${id}`);
      setDetail(null);
      setActiveId(null);
      await refresh();
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  };

  const addReference = async () => {
    if (!detail || !refCode.trim()) return;
    try {
      await apiPost(`/api/assignments/${detail.id}/vault`, {
        model_name: refName.trim() || 'Manual reference',
        code: refCode,
        language: refLang,
      });
      setRefName('');
      setRefCode('');
      await loadDetail(detail.id);
      await refresh();
    } catch (e) {
      setError(`Add reference failed: ${e}`);
    }
  };

  const deleteRef = async (id: number) => {
    try {
      await apiDelete(`/api/vault/${id}`);
      if (detail) await loadDetail(detail.id);
      await refresh();
    } catch (e) {
      setError(`Delete reference failed: ${e}`);
    }
  };

  const togglePick = (slug: string) => {
    setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug].slice(0, 4)));
  };

  const generate = async () => {
    if (!detail || picked.length === 0) return;
    setGenerating(true);
    setGenResult(null);
    setError(null);
    try {
      const res = await apiPost<{ generated: { code: string; model: string; valid: boolean; error: string | null }[] }>(
        `/api/openrouter/assignments/${detail.id}/vault/generate`,
        { models: picked, language: genLang }
      );
      setGenResult(res.generated);
      await loadDetail(detail.id);
      await refresh();
    } catch (e) {
      setError(`Generation failed: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  const allModels = curated;
  const vault: VaultRef[] = detail?.vault || [];

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Assignments & AI vault</h1>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Create assignments, curate reference solutions, and fetch fresh AI answers via OpenRouter.
      </p>
      {error && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent-red)' }}>
          <span style={{ fontSize: '0.8rem', color: '#e87070' }}>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Left: list + create */}
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-title">Create assignment</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. HW2 — Dijkstra)" style={inputStyle} />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description" rows={2} style={inputStyle} />
            <textarea value={form.problem_statement} onChange={(e) => setForm({ ...form, problem_statement: e.target.value })} placeholder="Full problem statement (used for AI generation)" rows={4} style={inputStyle} />
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={createAssignment} disabled={creating}>
              <Plus size={13} /> {creating ? 'Creating…' : 'Create'}
            </button>
          </div>

          <div className="card">
            <div className="card-title">All assignments</div>
            {assignments.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1, justifyContent: 'flex-start', fontWeight: a.id === activeId ? 600 : 400, color: a.id === activeId ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  onClick={() => { setActiveId(a.id); loadDetail(a.id); }}
                >
                  {a.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({a.submission_count ?? 0} subs · {a.vault?.length ?? 0} refs)</span>
                </button>
                <button className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem' }} onClick={() => deleteAssignment(a.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: detail */}
        <div>
          {!detail ? (
            <div className="card"><span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Select an assignment.</span></div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-title">
                  Edit assignment
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-ghost" style={{ fontSize: '0.72rem' }} onClick={() => loadDetail(detail.id)}>
                    <RefreshCw size={12} /> Reload
                  </button>
                </div>
                <input value={detail.name} onChange={(e) => setDetail({ ...detail, name: e.target.value })} style={inputStyle} />
                <textarea value={detail.description} onChange={(e) => setDetail({ ...detail, description: e.target.value })} rows={2} style={inputStyle} />
                <textarea value={detail.problem_statement} onChange={(e) => setDetail({ ...detail, problem_statement: e.target.value })} rows={5} style={inputStyle} placeholder="Problem statement" />
                <button className="btn" onClick={saveDetail}>Save changes</button>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-title"><Upload size={14} /> Vault references ({vault.length})</div>
                {vault.map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                    <span className={`status-tag ${r.source === 'openrouter' ? 'status-tag-blue' : r.source === 'seed' ? 'status-tag-green' : 'status-tag-amber'}`}>{r.source}</span>
                    <span style={{ fontWeight: 600 }}>{r.model_name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{r.model_key} · {r.language} · {(r.code || '').split('\n').length} lines</span>
                    <span style={{ flex: 1 }} />
                    <button className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem' }} onClick={() => deleteRef(r.id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem' }}>
                  <input value={refName} onChange={(e) => setRefName(e.target.value)} placeholder="Reference name (e.g. TA solution)" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <select value={refLang} onChange={(e) => setRefLang(e.target.value as LanguageKey)} style={{ ...inputStyle, marginBottom: 0, width: '110px' }}>
                    <option value="cpp">C++</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                  </select>
                </div>
                <textarea value={refCode} onChange={(e) => setRefCode(e.target.value)} rows={5} placeholder="Paste reference code here…" style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }} />
                <button className="btn" onClick={addReference} disabled={!refCode.trim()}><Plus size={13} /> Add manual reference</button>
              </div>

              <div className="card">
                <div className="card-title"><Sparkles size={14} /> Fetch AI answers (OpenRouter)</div>
                {!hasKey ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    No OpenRouter key configured — add one in <a href="/settings" style={{ color: 'var(--accent-blue)' }}>Settings</a> to enable generation.
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Language:</label>
                      <select value={genLang} onChange={(e) => setGenLang(e.target.value as LanguageKey)} style={{ ...inputStyle, marginBottom: 0, width: '130px' }}>
                        <option value="cpp">C++</option>
                        <option value="python">Python</option>
                        <option value="java">Java</option>
                      </select>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pick 2–3 models (defaults: {defaultModels.join(', ') || '—'})</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', marginBottom: '0.85rem' }}>
                      {allModels.map((m) => (
                        <label key={m.slug} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.78rem', background: picked.includes(m.slug) ? 'var(--bg-elevated)' : 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.45rem 0.6rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={picked.includes(m.slug)} onChange={() => togglePick(m.slug)} />
                          <span><strong>{m.name}</strong> <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{m.slug}</span></span>
                        </label>
                      ))}
                    </div>
                    <button className="btn btn-primary" onClick={generate} disabled={generating || picked.length === 0}>
                      <Sparkles size={13} /> {generating ? 'Generating…' : `Generate from ${picked.length} model(s)`}
                    </button>
                    {genResult && (
                      <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {genResult.map((g, i) => (
                          <div key={i} style={{ fontSize: '0.78rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: '0.6rem' }}>
                            <span className={`status-tag ${g.valid ? 'status-tag-green' : 'status-tag-red'}`}>{g.valid ? 'added to vault' : 'failed'}</span>{' '}
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{g.model}</span>
                            {!g.valid && <div style={{ color: '#e87070', marginTop: '0.3rem' }}>{g.error}</div>}
                            {g.valid && <pre style={{ marginTop: '0.4rem', maxHeight: '160px', overflow: 'auto', background: 'var(--bg-base)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem' }}>{g.code.slice(0, 2000)}</pre>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
  padding: '0.5rem 0.65rem',
  marginBottom: '0.6rem',
  outline: 'none',
};
