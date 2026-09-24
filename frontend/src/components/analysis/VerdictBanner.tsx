'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface VerdictBannerProps {
  isFlagged: boolean;
  flaggedReasons: string[];
  highestSimilarityScore: number;
  totalModels: number;
  flaggedCount: number;
}

export default function VerdictBanner({
  isFlagged,
  flaggedReasons,
  highestSimilarityScore,
  totalModels,
  flaggedCount,
}: VerdictBannerProps) {
  const pct = (highestSimilarityScore * 100).toFixed(1);

  if (!isFlagged) {
    return (
      <div className="animate-fade-in" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderLeft: '3px solid var(--accent-green)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No significant AI signatures detected
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Peak similarity {pct}% across {totalModels} reference models — within acceptable range.
            </div>
          </div>
        </div>
        <span className="status-tag status-tag-green">Clear</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderLeft: '3px solid var(--accent-red)',
      borderRadius: 'var(--radius-lg)',
      padding: '1rem 1.25rem',
      marginBottom: '1.25rem',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <ShieldAlert size={18} style={{ color: 'var(--accent-red)', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              AI obfuscation signatures detected
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Peak confidence{' '}
              <span style={{ color: 'var(--accent-red)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{pct}%</span>
              {' '}· {flaggedCount} of {totalModels} models flagged
            </div>
          </div>
        </div>
        <span className="status-tag status-tag-red" style={{ flexShrink: 0 }}>High Risk</span>
      </div>

      {/* Detected patterns — compact list */}
      {flaggedReasons.length > 0 && (
        <div style={{
          marginTop: '0.85rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <div className="section-label" style={{ marginBottom: '0.45rem' }}>Detected patterns</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {flaggedReasons.map((reason, idx) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.55rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}>
                <span style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: 'var(--accent-red)',
                  flexShrink: 0,
                  marginBottom: '-1px',
                  alignSelf: 'center',
                }} />
                {reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
