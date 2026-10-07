'use client';

import React from 'react';
import VerdictBanner from './VerdictBanner';
import MultiModelMatrix from './MultiModelMatrix';
import MetricGaugeCard from './MetricGaugeCard';

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
  diagnostics?: string;
  status?: string;
  student_cfg?: { nodes: unknown[]; edges: unknown[] };
  ref_cfg?: { nodes: unknown[]; edges: unknown[] };
}

interface ReportData {
  assignment_id?: string | number;
  report_id?: number;
  is_flagged: boolean;
  flagged_reasons: string[];
  results: Record<string, ModelAnalysisResult>;
}

interface AnalysisOverviewProps {
  report: ReportData;
  models: Record<string, AIModel>;
  selectedModelKey: string;
  onSelectModelKey: (key: string) => void;
  onSelectTab: (tabKey: 'code' | 'cfg' | 'technical') => void;
}

export default function AnalysisOverview({
  report,
  models,
  selectedModelKey,
  onSelectModelKey,
  onSelectTab,
}: AnalysisOverviewProps) {
  const activeResult = report.results[selectedModelKey];
  const modelKeys = Object.keys(models);

  let highestScore = 0;
  let flaggedCount = 0;
  modelKeys.forEach(k => {
    const res = report.results[k];
    if (res) {
      if (res.final_score > highestScore) highestScore = res.final_score;
      if (res.flag) flaggedCount++;
    }
  });

  return (
    <div className="animate-fade-in" style={{ marginBottom: '1.75rem' }}>
      <VerdictBanner
        isFlagged={report.is_flagged}
        flaggedReasons={report.flagged_reasons}
        highestSimilarityScore={highestScore}
        totalModels={modelKeys.length}
        flaggedCount={flaggedCount}
      />

      <MultiModelMatrix
        models={models}
        results={report.results}
        selectedModelKey={selectedModelKey}
        onSelectModel={onSelectModelKey}
      />

      {activeResult && (
        <div>
          {/* Evidence chain header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '0.75rem',
            marginTop: '1.25rem',
          }}>
            <span className="section-label">
              Evidence chain — {models[selectedModelKey]?.name ?? selectedModelKey}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Click to open inspector
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '0.6rem',
          }}>
            <MetricGaugeCard
              label="Fused fingerprint"
              weightLabel="20T + 20A + 20C + 40S"
              score={activeResult.final_score}
              description="Overall weighted multi-tier plagiarism confidence."
              accentColor="var(--accent-blue)"
              onInspectTarget={() => onSelectTab('code')}
            />
            <MetricGaugeCard
              label="Token winnowing"
              weightLabel="20% weight"
              score={activeResult.token_score}
              description="Scrubbed k-gram hash overlap ignoring layout."
              accentColor="var(--accent-blue)"
              onInspectTarget={() => onSelectTab('code')}
            />
            <MetricGaugeCard
              label="AST structure"
              weightLabel="20% weight"
              score={activeResult.ast_score}
              description="Syntax tree similarity after normalization."
              accentColor="var(--accent-amber)"
              onInspectTarget={() => onSelectTab('code')}
            />
            <MetricGaugeCard
              label="CFG isomorphism"
              weightLabel="20% weight"
              score={activeResult.cfg_score}
              description="Control flow topology via WL-kernel."
              accentColor="var(--accent-purple)"
              onInspectTarget={() => onSelectTab('cfg')}
            />
            <MetricGaugeCard
              label="CodeBERT semantic"
              weightLabel="40% weight"
              score={activeResult.semantic_score}
              description="Neural vector similarity for conceptual intent."
              accentColor="var(--accent-green)"
              onInspectTarget={() => onSelectTab('code')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
