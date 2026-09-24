'use client';

import React from 'react';
import { Bot, Play, Cpu } from 'lucide-react';

export interface DemoPreset {
  name: string;
  label: string;
  description: string;
  code: string;
}

interface DemoPresetsProps {
  testSubmissions: DemoPreset[];
  activeCode: string;
  onSelectDemo: (preset: DemoPreset) => void;
  isComparing: boolean;
}

export default function DemoPresets({
  testSubmissions,
  activeCode,
  onSelectDemo,
  isComparing,
}: DemoPresetsProps) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.65rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem'
      }}>
        <Cpu size={13} />
        Or Run Pre-Loaded Obfuscation Demos
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
        {testSubmissions.map((preset, idx) => {
          const isActive = activeCode === preset.code;
          return (
            <div
              key={idx}
              onClick={() => !isComparing && onSelectDemo(preset)}
              style={{
                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-surface)',
                border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                cursor: isComparing ? 'wait' : 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Bot size={18} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {preset.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {preset.name}
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Play size={12} /> Load & Scan
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
