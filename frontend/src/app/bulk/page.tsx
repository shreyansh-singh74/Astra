'use client';

import React, { useEffect, useState } from 'react';
import { UploadCloud, Play, Download, Trash2, RefreshCw, Users } from 'lucide-react';
import { apiGet, apiPost, apiDelete, apiUpload, apiDownloadUrl } from '@/lib/api';
import {
  Assignment,
  Submission,
  BulkJobResult,
  JobState,
  SingleReport,
  BulkVerdict,
} from '@/lib/types';
import AnalysisOverview from '@/components/analysis/AnalysisOverview';
import InspectorWorkspace from '@/components/inspector/InspectorWorkspace';

type SortKey = 'student' | 'score' | 'flag';

export default function BulkPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [job, setJob] = useState<JobState | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drillReport, setDrillReport] = useState<SingleReport | null>(null);
  const [drillCode, setDrillCode] = useState<string>('');
  const [drillTab, setDrillTab] = useState<'code' | 'cfg' | 'technical'>('code');
  const [drillModel, setDrillModel] = useState<string>('');

  useEffect(() => {
    apiGet<Assignment[]>('/api/assignments').then((data) => {
      setAssignments(data);
      if (data.length > 0 && assignmentId === null) setAssignmentId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (assignmentId !== null) refreshSubmissions(assignmentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const refreshSubmissions = async (aid: number) => {
    try {
      const subs = await apiGet<Submission[]>(`/api/assignments/${aid}/submissions`);
      setSubmissions(subs);
    } catch (e) {
      setError(`Failed to load submissions: ${e}`);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || assignmentId === null) return;
    setUploading(true);
    setError(null);
    try {
      await apiUpload(`/api/assignments/${assignmentId}/submissions`, Array.from(files));
      await refreshSubmissions(assignmentId);
    } catch (e) {
      setError(`Upload failed: ${e}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/api/submissions/${id}`);
      setSubmissions((s) => s.filter((x) => x.id !== id));
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  };

  const runScan = async () => {
    if (assignmentId === null) return;
    setError(null);
    setSelectedId(null);
    setDrillReport(null);
    try {
      const { job_id } = await apiPost<{ job_id: string }>('/api/analyze/bulk', {
        assignment_id: assignmentId,
        force: true,
      });
      setPolling(true);
      const poll = async () => {
        try {
          const state = await apiGet<JobState>(`/api/jobs/${job_id}`);
          setJob(state);
          if (state.status === 'done' || state.status === 'failed') {
            setPolling(false);
            if (state.status === 'failed') setError(`Bulk scan failed: ${state.error}`);
            return;
          }
          setTimeout(poll, 1200);
        } catch (e) {
          setPolling(false);
          setError(`Job polling failed: ${e}`);
        }
      };
      poll();
    } catch (e) {
      setError(`Could not start bulk scan: ${e}`);
    }
  };

  const result: BulkJobResult | null = job?.status === 'done' ? job.result : null;

  const verdicts: BulkVerdict[] = result
    ? Object.values(result.vault_verdicts).sort((a, b) => {
        if (sortKey === 'student') return (a.student_name || '').localeCompare(b.student_name || '');
        if (sortKey === 'flag') return Number(b.is_flagged) - Number(a.is_flagged);
        return b.max_score - a.max_score;
      })
    : [];

  const openDrilldown = async (v: BulkVerdict) => {
    setSelectedId(String(v.submission_id));
    setDrillModel('');
    try {
      const [sub, rep] = await Promise.all([
        apiGet<Submission & { code: string }>(`/api/submissions/${v.submission_id}`),
        apiGet<{ verdict: { results?: Record<string, SingleReport['results'][string]> }; id: number }>(`/api/reports/${v.report_id}`),
      ]);
      setDrillCode(sub.code || '');
      const storedResults = (rep.verdict?.results || v.results || {}) as SingleReport['results'];
      const keys = Object.keys(storedResults);
      const first = keys[0] || '';
      setDrillModel(first);
      // Normalize stored compact report into SingleReport shape for reuse
      const assignment = assignments.find((a) => a.id === assignmentId);
      const vaultDict: Record<string, { key: string; name: string; code: string }> = {};
      (assignment?.vault || []).forEach((r) => {
        vaultDict[r.model_key] = { key: r.model_key, name: r.model_name, code: r.code || '' };
      });
      setDrillReport({
        report_id: v.report_id,
        submission: { id: v.submission_id, student_name: v.student_name, filename: v.filename, language: v.language },
        is_flagged: v.is_flagged,
        flagged_reasons: v.flagged_reasons,
        results: storedResults,
      });
      setDrillVault(vaultDict);
    } catch (e) {
      setError(`Drill-down failed: ${e}`);
    }
  };

  const [drillVault, setDrillVault] = useState<Record<string, { key: string; name: string; code: string }>>({});

  const heatColor = (v: number) => {
    if (v >= 0.7) return 'var(--accent-red)';
    if (v >= 0.5) return 'var(--accent-amber)';
    if (v >= 0.3) return '#8a6d1b';
    return 'var(--border-strong)';
  };

  return (
    <div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Bulk scan & collusion</h1>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Upload a class set (.cpp / .py / .java or .zip), run one background scan, then review vault scores and student↔student clusters.
      </p>

      {error && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent-red)' }}>
          <span style={{ fontSize: '0.8rem', color: '#e87070' }}>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select
          value={assignmentId ?? ''}
          onChange={(e) => setAssignmentId(Number(e.target.value))}
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', fontSize: '0.8rem', borderRadius: 'var(--radius-md)', padding: '0.4rem 0.6rem', outline: 'none' }}
        >
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <label className="btn" style={{ cursor: 'pointer' }}>
          <UploadCloud size={13} /> {uploading ? 'Uploading…' : 'Upload files / .zip'}
          <input type="file" multiple accept=".cpp,.cxx,.cc,.c,.h,.hpp,.py,.java,.zip" style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files)} disabled={uploading} />
        </label>
        <button className="btn btn-ghost" onClick={() => assignmentId !== null && refreshSubmissions(assignmentId)}>
          <RefreshCw size={13} /> Refresh
        </button>
        <button className="btn btn-primary" onClick={runScan} disabled={polling || submissions.length === 0}>
          <Play size={13} /> {polling ? `Scanning… ${Math.round((job?.progress || 0) * 100)}%` : `Run bulk scan (${submissions.length})`}
        </button>
        {polling && (
          <div className="progress-track" style={{ minWidth: '200px', flex: 1 }}>
            <div className="progress-fill" style={{ width: `${Math.round((job?.progress || 0) * 100)}%`, backgroundColor: 'var(--accent-blue)' }} />
          </div>
        )}
      </div>

      {/* Submission table */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: 0, overflow: 'hidden' }}>
        <div className="card-title" style={{ padding: '1rem 1.25rem 0' }}>
          <Users size={14} /> Submissions ({submissions.length})
        </div>
        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ padding: '0.6rem 1.25rem' }}>Student</th>
              <th>File</th>
              <th>Lang</th>
              <th>Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.55rem 1.25rem', color: 'var(--text-primary)' }}>{s.student_name}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{s.filename}</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{s.language}</td>
                <td style={{ color: 'var(--text-muted)' }}>{s.code_size ?? '—'}</td>
                <td style={{ textAlign: 'right', paddingRight: '1rem' }}>
                  <button className="btn btn-ghost" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDelete(s.id)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>No submissions yet — upload files or a .zip above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Results */}
      {result && (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span className="section-label">Per-student vault scores — {result.scanned} scanned, {result.flagged_count} flagged</span>
            <span style={{ flex: 1 }} />
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Sort:{' '}
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}>
                <option value="score">max score</option>
                <option value="flag">flagged first</option>
                <option value="student">name</option>
              </select>
            </label>
            <a className="btn btn-ghost" href={apiDownloadUrl(`/api/collusion/${result.collusion_report_id}/export`)}>
              <Download size={13} /> Collusion CSV
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {verdicts.map((v) => (
              <button
                key={v.submission_id}
                onClick={() => openDrilldown(v)}
                style={{
                  all: 'unset', display: 'block', cursor: 'pointer',
                  background: String(v.submission_id) === selectedId ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  border: `1px solid ${String(v.submission_id) === selectedId ? 'var(--border-strong)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{v.student_name}</span>
                  {v.is_flagged ? <span className="status-tag status-tag-red">flagged</span> : <span className="status-tag status-tag-green">clear</span>}
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: v.max_score >= 0.7 ? '#e87070' : v.max_score >= 0.35 ? '#d4880a' : '#5ec99a' }}>
                  {(v.max_score * 100).toFixed(1)}<span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)' }}>%</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.3rem' }}>
                  {v.filename} · {v.language} · {v.flagged_reasons.length > 0 ? v.flagged_reasons[0].slice(0, 80) : 'no flags'}
                </div>
              </button>
            ))}
          </div>

          {/* Collusion heatmap + clusters */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-title">Student↔student collusion matrix (threshold {result.collusion.threshold})</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.3rem', minWidth: '90px' }}></th>
                    {result.collusion.students.map((s) => (
                      <th key={s.id} style={{ padding: '0.3rem', color: 'var(--text-muted)', fontWeight: 500, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.student_name}>{s.student_name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.collusion.matrix.map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: '0.3rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{result.collusion.students[i]?.student_name}</td>
                      {row.map((val, j) => (
                        <td key={j} title={`${result.collusion.students[i]?.student_name} ↔ ${result.collusion.students[j]?.student_name}: ${val}`} style={{ padding: '0.15rem' }}>
                          <div style={{ width: '34px', height: '22px', borderRadius: '3px', background: i === j ? 'transparent' : heatColor(val), opacity: i === j ? 1 : 0.35 + val * 0.65, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: '#fff', border: '1px solid var(--border-subtle)' }}>
                            {i === j ? '·' : val.toFixed(2)}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {result.collusion.clusters.map((c, idx) => (
              <div key={idx} className="card" style={{ borderColor: 'rgba(201,64,64,0.35)' }}>
                <div className="card-title" style={{ color: '#e87070' }}>Cluster {idx + 1} — these {c.members.length} students cluster together</div>
                <div style={{ fontSize: '0.82rem', marginBottom: '0.5rem' }}>{c.members.join(' · ')}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  peak {c.peak_internal_score.toFixed(3)} · avg {c.avg_internal_score.toFixed(3)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {result.collusion.pairs.filter((p) => c.member_ids.includes(p.a_id) && c.member_ids.includes(p.b_id)).slice(0, 4).map((p) => (
                    <div key={`${p.a_id}-${p.b_id}`}>{p.a_name} ↔ {p.b_name}: {p.final_score.toFixed(3)} — {p.diagnostics}</div>
                  ))}
                </div>
              </div>
            ))}
            {result.collusion.clusters.length === 0 && (
              <div className="card"><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No collusion clusters above threshold — class looks independent.</span></div>
            )}
          </div>

          {/* Drill-down reuses the Scan inspector */}
          {drillReport && (
            <div className="card" style={{ marginBottom: '2rem' }}>
              <div className="card-title">
                Drill-down — {drillReport.submission.student_name} ({drillReport.submission.filename})
                <span style={{ flex: 1 }} />
                <a className="btn btn-ghost" style={{ fontSize: '0.72rem' }} href={apiDownloadUrl(`/api/reports/${drillReport.report_id}/export`)}>
                  <Download size={12} /> CSV
                </a>
              </div>
              <AnalysisOverview report={drillReport} models={drillVault} selectedModelKey={drillModel} onSelectModelKey={setDrillModel} onSelectTab={setDrillTab} />
              <InspectorWorkspace
                activeTab={drillTab}
                onTabChange={setDrillTab}
                studentCode={drillCode}
                refCode={drillVault[drillModel]?.code || ''}
                selectedStudentRange={null}
                selectedRefRange={null}
                onSelectStudentRange={() => {}}
                onSelectRefRange={() => {}}
                activeResult={drillReport.results[drillModel] || null}
                modelName={drillVault[drillModel]?.name || drillModel}
                sieveThreshold={0.1}
                forceAnalysis={true}
                language={drillReport.submission.language === 'python' ? 'python' : drillReport.submission.language === 'java' ? 'java' : 'cpp'}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
