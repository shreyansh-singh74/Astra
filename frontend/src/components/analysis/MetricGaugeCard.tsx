'use client';

import React from 'react';

interface MetricGaugeCardProps {
  label: string;
  weightLabel: string;
  score: number;
  description: string;
  accentColor?: string;
  onInspectTarget?: () => void;
}

export default function MetricGaugeCard({
  label,
  weightLabel,
  score,
  description,
  accentColor = 'var(--accent-blue)',
  onInspectTarget,
}: MetricGaugeCardProps) {
  const pct = (score * 100).toFixed(1);

  const riskLevel = score >= 0.70 ? 'high' : score >= 0.35 ? 'mid' : 'low';
  const riskColor = riskLevel === 'high'
    ? 'var(--accent-red)'
    : riskLevel === 'mid'
    ? 'var(--accent-amber)'
    : 'var(--text-muted)';

  return (
    <div
      onClick={onInspectTarget}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.1rem',
        cursor: onInspectTarget ? 'pointer' : 'default',
        transition: 'border-color 0.12s',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
      }}
    >
      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}>
          {label}
        </span>
        <span style={{
          fontSize: '0.65rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-faint)',
        }}>
          {weightLabel}
        </span>
      </div>

      {/* Score + bar */}
      <div>
        <div style={{
          fontSize: '1.45rem',
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
          letterSpacing: '-0.025em',
          color: riskLevel === 'low' ? 'var(--text-secondary)' : riskColor,
          lineHeight: 1,
          marginBottom: '0.5rem',
        }}>
          {pct}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '1px' }}>%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.min(score * 100, 100)}%`, backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: '0.73rem',
        color: 'var(--text-muted)',
        lineHeight: '1.4',
      }}>
        {description}
      </p>

      {/* Footer */}
      {onInspectTarget && (
        <div style={{
          paddingTop: '0.5rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>Trace evidence</span>
          <span style={{ color: accentColor }}>→</span>
        </div>
      )}
    </div>
  );
}
