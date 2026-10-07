'use client';

import React from 'react';
import { FileCode2, GitFork, Terminal } from 'lucide-react';
import CodeInspector from './CodeInspector';
import CfgExplorer from './CfgExplorer';
import TechnicalDetails from './TechnicalDetails';

interface CodeRange {
  start_line: number;
  end_line: number;
  start_byte: number;
  end_byte: number;
}

interface CFGGraph {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[];
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
  student_cfg?: CFGGraph;
  ref_cfg?: CFGGraph;
}

interface InspectorWorkspaceProps {
  activeTab: 'code' | 'cfg' | 'technical';
  onTabChange: (tab: 'code' | 'cfg' | 'technical') => void;
  studentCode: string;
  refCode: string;
  selectedStudentRange: CodeRange | null;
  selectedRefRange: CodeRange | null;
  onSelectStudentRange: (range: CodeRange | null) => void;
  onSelectRefRange: (range: CodeRange | null) => void;
  activeResult: ModelAnalysisResult | null;
  modelName: string;
  sieveThreshold: number;
  forceAnalysis: boolean;
  language?: string;
}

export default function InspectorWorkspace({
  activeTab,
  onTabChange,
  studentCode,
  refCode,
  selectedStudentRange,
  selectedRefRange,
  onSelectStudentRange,
  onSelectRefRange,
  activeResult,
  modelName,
  sieveThreshold,
  forceAnalysis,
  language = 'cpp',
}: InspectorWorkspaceProps) {
  return (
    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '1.25rem' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
      }}>
        <div style={{ display: 'flex' }}>
          {(
            [
              { id: 'code', icon: FileCode2, label: 'Code inspector' },
              { id: 'cfg',  icon: GitFork,   label: 'Control flow' },
              { id: 'technical', icon: Terminal, label: 'Debug' },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={`tab-btn ${activeTab === id ? 'active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        <span style={{
          fontSize: '0.7rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
        }}>
          {modelName}
        </span>
      </div>

      {/* Tab contents */}
      {activeTab === 'code' && (
        <CodeInspector
          studentCode={studentCode}
          refCode={refCode}
          selectedStudentRange={selectedStudentRange}
          selectedRefRange={selectedRefRange}
          modelName={modelName}
          language={language}
        />
      )}

      {activeTab === 'cfg' && activeResult && (
        <CfgExplorer
          studentCfg={activeResult.student_cfg || { nodes: [], edges: [] }}
          refCfg={activeResult.ref_cfg || { nodes: [], edges: [] }}
          onSelectStudentNode={onSelectStudentRange}
          onSelectRefNode={onSelectRefRange}
        />
      )}

      {activeTab === 'technical' && (
        <TechnicalDetails
          activeResult={activeResult}
          modelName={modelName}
          sieveThreshold={sieveThreshold}
          forceAnalysis={forceAnalysis}
        />
      )}
    </div>
  );
}
