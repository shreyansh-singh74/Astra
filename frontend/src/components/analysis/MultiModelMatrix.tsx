'use client';

import React from 'react';

interface AIModel {
  key: string;
  name: string;
  code: string;
}

interface ModelAnalysisResult {
  final_score: number;
  token_score: number;
  ast_score: number;
  cfg_score: number;
  semantic_score: number;
  flag: string | null;
  diagnostics: string;
}

interface MultiModelMatrixProps {
  models: Record<string, AIModel>;
  results: Record<string, ModelAnalysisResult>;
  selectedModelKey: string;
  onSelectModel: (key: string) => void;
}

export default function MultiModelMatrix({
  models,
  results,
  selectedModelKey,
  onSelectModel,
}: MultiModelMatrixProps) {
  const modelKeys = Object.keys(models);

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Section header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '0.75rem',
      }}>
        <span className="section-label">Reference vault similarity</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Select a model to inspect
        </span>
      </div>

      {/* Model cards row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${modelKeys.length}, 1fr)`,
        gap: '0.6rem',
      }}>
        {modelKeys.map(key => {
          const model = models[key];
          const result = results[key];
          const isActive = selectedModelKey === key;
          const score = result?.final_score ?? 0;
          const pct = (score * 100).toFixed(1);
          const isFlagged = Boolean(result?.flag);
          const semantic = ((result?.semantic_score ?? 0) * 100).toFixed(0);

          // Bar color — only saturated when high
          let barColor = 'var(--accent-green)';
          let textColor = '#5ec99a';
          if (score >= 0.70) { barColor = 'var(--accent-red)';   textColor = '#e87070'; }
          else if (score >= 0.35) { barColor = 'var(--accent-amber)'; textColor = '#d4880a'; }

          return (
            <button
              key={key}
              onClick={() => onSelectModel(key)}
              style={{
                all: 'unset',
                display: 'block',
                background: isActive ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                border: `1px solid ${isActive ? 'var(--border-strong)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '0.85rem 1rem',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                position: 'relative',
              }}
            >
              {/* Model name + flag */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.6rem',
              }}>
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {model.name}
                </span>
                {isFlagged ? (
                  <span className="status-tag status-tag-red">flagged</span>
                ) : (
                  <span className="status-tag status-tag-green">clear</span>
                )}
              </div>

              {/* Score */}
              <div style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: textColor,
                letterSpacing: '-0.02em',
                marginBottom: '0.5rem',
              }}>
                {pct}<span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '1px' }}>%</span>
              </div>

              {/* Progress bar */}
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.min(score * 100, 100)}%`, backgroundColor: barColor }}
                />
              </div>

              {/* Footer meta */}
              <div style={{
                marginTop: '0.55rem',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
              }}>
                <span>semantic {semantic}%</span>
                <span style={{ color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                  {isActive ? '● active' : 'inspect →'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
