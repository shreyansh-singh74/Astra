'use client';

import React from 'react';
import { X, Settings2, Info } from 'lucide-react';

interface PipelineSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sieveThreshold: number;
  onSieveThresholdChange: (val: number) => void;
  forceAnalysis: boolean;
  onForceAnalysisChange: (val: boolean) => void;
}

export default function PipelineSettingsDrawer({
  isOpen,
  onClose,
  sieveThreshold,
  onSieveThresholdChange,
  forceAnalysis,
  onForceAnalysisChange,
}: PipelineSettingsDrawerProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end',
    }}>
      <div 
        className="animate-slide-in"
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-color)',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings2 size={18} className="text-accent-primary" />
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Pipeline Parameters</h2>
            </div>
            <button className="btn btn-ghost" onClick={onClose} style={{ padding: '0.3rem' }}>
              <X size={18} />
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.4' }}>
            Adjust parameters governing the multi-tier forensic extraction loop. Changes apply to subsequent analysis scans.
          </p>

          {/* Sieve Threshold Setting */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Token Sieve Cutoff Threshold
              </label>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                {(sieveThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.50"
              step="0.05"
              value={sieveThreshold}
              onChange={(e) => onSieveThresholdChange(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', marginTop: '0.65rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>Submissions with token similarity below this threshold skip expensive AST/CFG/CodeBERT analysis unless forced.</span>
            </div>
          </div>

          {/* Bypass Sieve Force Switch */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Bypass Sieve (Force Full Scan)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Force AST, CFG, and CodeBERT scans even if token overlap is negligible.
                </div>
              </div>
              <input
                type="checkbox"
                checked={forceAnalysis}
                onChange={(e) => onForceAnalysisChange(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>

        {/* Footer button */}
        <button className="btn" onClick={onClose} style={{ width: '100%', padding: '0.75rem' }}>
          Apply & Close
        </button>
      </div>
    </div>
  );
}
