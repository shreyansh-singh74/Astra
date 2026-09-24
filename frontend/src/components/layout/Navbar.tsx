'use client';

import React from 'react';
import { SlidersHorizontal, RefreshCw, Layers, ChevronDown } from 'lucide-react';

export interface AIModel {
  key: string;
  name: string;
  code: string;
}

export interface Assignment {
  id: string;
  name: string;
  description: string;
  ai_vault: Record<string, AIModel>;
}

interface NavbarProps {
  assignments: Assignment[];
  activeAssignment: Assignment | null;
  onSelectAssignment: (assignment: Assignment) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export default function Navbar({
  assignments,
  activeAssignment,
  onSelectAssignment,
  onRefresh,
  onOpenSettings,
}: NavbarProps) {
  return (
    <header style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1.5rem',
      paddingBottom: '1rem',
      borderBottom: '1px solid var(--border-default)',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}>
              Astra
            </span>
            <span style={{
              fontSize: '0.67rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.02em',
              marginTop: '1px',
            }}>
              forensic console
            </span>
          </div>
        </div>

        {/* Assignment selector — minimal inline pill */}
        {assignments.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'var(--bg-elevated)',
            padding: '0.3rem 0.6rem 0.3rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            cursor: 'pointer',
          }}>
            <Layers size={12} style={{ color: 'var(--text-muted)' }} />
            <select
              value={activeAssignment?.id || ''}
              onChange={(e) => {
                const found = assignments.find(a => a.id === e.target.value);
                if (found) onSelectAssignment(found);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {assignments.map(a => (
                <option key={a.id} value={a.id} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
          </div>
        )}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Live indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          padding: '0.3rem 0.65rem',
          marginRight: '0.25rem',
        }}>
          <span className="status-dot status-dot-green pulse" />
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>live</span>
        </div>

        <button className="btn btn-ghost" onClick={onRefresh} title="Reload AI Vault">
          <RefreshCw size={13} /> Refresh
        </button>

        <button className="btn" onClick={onOpenSettings} title="Pipeline Settings">
          <SlidersHorizontal size={13} /> Settings
        </button>
      </div>
    </header>
  );
}
