'use client';

import React from 'react';
import { Sparkles, Layers } from 'lucide-react';
import DemoPresets, { DemoPreset } from './DemoPresets';
import UploadDropzone from './UploadDropzone';

interface EmptyStateProps {
  testSubmissions: DemoPreset[];
  activeCode: string;
  onSelectDemo: (preset: DemoPreset) => void;
  onFileLoaded: (codeText: string, filename: string) => void;
  isComparing: boolean;
}

export default function EmptyState({
  testSubmissions,
  activeCode,
  onSelectDemo,
  onFileLoaded,
  isComparing,
}: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto', padding: '2rem 0' }}>
      {/* Intro Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: '9999px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          <Sparkles size={14} />
          Multi-Tier Source Forensic Pipeline
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Detect Obfuscated AI-Assisted Plagiarism
        </h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0.5rem auto 0 auto', lineHeight: '1.5' }}>
          Upload student C++ source code to analyze similarity against pre-loaded AI model reference files (GPT-4o, Claude 3.5, Gemini 1.5, DeepSeek) using token winnowing, AST normalization, Control Flow Graph (CFG) topology, and CodeBERT semantic embeddings.
        </p>
      </div>

      {/* Step 1: Upload Card */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <h3 className="card-title" style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
          <Layers size={18} className="text-accent-primary" />
          Step 1: Provide Student Code Submission
        </h3>

        <UploadDropzone onFileLoaded={onFileLoaded} isComparing={isComparing} />

        <DemoPresets
          testSubmissions={testSubmissions}
          activeCode={activeCode}
          onSelectDemo={onSelectDemo}
          isComparing={isComparing}
        />
      </div>

      {/* Pipeline explanation card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-info)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            1. Token Winnowing (20%)
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Scrubs comments and parses K-grams with sliding window MD5 hashes to detect literal text duplication.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-warning)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            2. AST Normalization (20%)
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Replaces custom variable and function names with standardized tokens (var_0, func_0) to bypass renaming tricks.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-purple)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            3. CFG Isomorphism (20%)
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Evaluates control flow graph execution paths (loops, branches) using the Weisfeiler-Lehman graph kernel.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-success)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            4. CodeBERT Vectors (40%)
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Extracts 768-dimensional deep neural embeddings to compare conceptual intent and semantic meaning.
          </p>
        </div>
      </div>
    </div>
  );
}
