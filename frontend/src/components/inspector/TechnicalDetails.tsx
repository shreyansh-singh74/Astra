'use client';

import React from 'react';
import { Terminal, Cpu, Hash } from 'lucide-react';

interface ModelAnalysisResult {
  final_score: number;
  token_score: number;
  ast_score: number;
  cfg_score: number;
  semantic_score: number;
  flag: string | null;
  diagnostics?: string;
}

interface TechnicalDetailsProps {
  activeResult: ModelAnalysisResult | null;
  modelName: string;
  sieveThreshold: number;
  forceAnalysis: boolean;
}

export default function TechnicalDetails({
  activeResult,
  modelName,
  sieveThreshold,
  forceAnalysis,
}: TechnicalDetailsProps) {
  if (!activeResult) return null;

  return (
    <div className="card animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
        <Terminal size={18} className="text-accent-primary" />
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
          Raw Pipeline Diagnostics & Debug Log ({modelName})
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Tier Parameters */}
        <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Cpu size={14} /> Extraction Parameters
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Sieve Threshold:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{(sieveThreshold * 100).toFixed(0)}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Force Scan Bypass:</span>
              <span style={{ color: forceAnalysis ? 'var(--accent-warning)' : 'var(--text-primary)', fontWeight: 600 }}>
                {forceAnalysis ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>K-Gram Size (K):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>20</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Winnowing Window (W):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>10</span>
            </div>
          </div>
        </div>

        {/* Algorithm Weights & Raw Scores */}
        <div style={{ background: 'var(--bg-base)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Hash size={14} /> Raw Tier Similarity Weights
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Token Winnowing (20%):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeResult.token_score.toFixed(4)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>AST Normalization (20%):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeResult.ast_score.toFixed(4)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>CFG WL-Kernel (20%):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeResult.cfg_score.toFixed(4)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>CodeBERT Semantic (40%):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activeResult.semantic_score.toFixed(4)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostics string console output */}
      <div style={{ marginTop: '1.25rem' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Diagnostic Console Trace:
        </div>
        <pre style={{
          backgroundColor: 'var(--bg-base)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1rem',
          fontSize: '0.8rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.5'
        }}>
          {activeResult.diagnostics || "No diagnostic log available."}
        </pre>
      </div>
    </div>
  );
}
