'use client';

import React, { useState, useEffect } from 'react';
import PipelineSettingsDrawer from '../components/settings/PipelineSettingsDrawer';
import EmptyState from '../components/upload/EmptyState';
import { DemoPreset } from '../components/upload/DemoPresets';
import AnalysisOverview from '../components/analysis/AnalysisOverview';
import InspectorWorkspace from '../components/inspector/InspectorWorkspace';
import { RefreshCw, ClipboardPaste, Languages } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import {
  Assignment,
  LanguageKey,
  LANGUAGE_OPTIONS,
  detectLanguageFromFilename,
  monacoForLanguage,
} from '@/lib/types';

interface CodeRange {
  start_line: number;
  end_line: number;
  start_byte: number;
  end_byte: number;
}

export default function ScanPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<number | null>(null);
  const activeAssignment = assignments.find((a) => a.id === activeAssignmentId) || null;

  const [studentCode, setStudentCode] = useState<string>('');
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [language, setLanguage] = useState<LanguageKey>('cpp');
  const [selectedModelKey, setSelectedModelKey] = useState<string>('');

  const [sieveThreshold, setSieveThreshold] = useState<number>(0.1);
  const [forceAnalysis, setForceAnalysis] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [isComparing, setIsComparing] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');

  const testSubmissions: DemoPreset[] = [
    {
      name: 'student_gpt4o_renamed.cpp',
      label: 'GPT-4o Renamed Variables',
      description: 'Identifiers and helper names scrubbed & renamed.',
      code: `#include <vector>\n#include <cmath>\n#include <algorithm>\n\nint getManhattanDistance(std::pair<int, int> a, std::pair<int, int> b) {\n    return std::abs(a.first - b.first) + std::abs(a.second - b.second);\n}\n\nbool isPathFeasible(std::vector<std::pair<int, int>> points, std::vector<std::pair<int, int>> powerStations) {\n    int chargeRemaining = 100;\n    for (size_t idx = 0; idx < points.size() - 1; ++idx) {\n        chargeRemaining -= getManhattanDistance(points[idx], points[idx+1]);\n        if (chargeRemaining <= 0) return false;\n        auto searchIt = std::find(powerStations.begin(), powerStations.end(), points[idx+1]);\n        if (searchIt != powerStations.end()) {\n            chargeRemaining = 100;\n        }\n    }\n    return true;\n}`,
    },
    {
      name: 'student_claude35_arrays.cpp',
      label: 'Claude 3.5 Array De-clustered',
      description: 'Data structure altered into raw array checks.',
      code: `#include <vector>\n#include <cmath>\n\nbool checkStation(std::pair<int, int> spot, const std::vector<std::pair<int, int>>& locations) {\n    for (const auto& loc : locations) {\n        if (loc.first == spot.first && loc.second == spot.second) return true;\n    }\n    return false;\n}\n\nbool evaluateRoute(std::vector<std::pair<int, int>> coordinates, std::vector<std::pair<int, int>> stations) {\n    int juice = 100;\n    for (size_t i = 1; i < coordinates.size(); ++i) {\n        int dist = std::abs(coordinates[i].first - coordinates[i-1].first) + std::abs(coordinates[i].second - coordinates[i-1].second);\n        juice -= dist;\n        if (juice <= 0) return false;\n        if (checkStation(coordinates[i], stations)) juice = 100;\n    }\n    return true;\n}`,
    },
    {
      name: 'student_gemini15_loops.cpp',
      label: 'Gemini 1.5 Flat Logic',
      description: 'Control flow flattened with nested for-loops.',
      code: `#include <vector>\n#include <cmath>\n\nbool checkCartRoute(std::vector<std::pair<int, int>>& path, std::vector<std::pair<int, int>>& chargers) {\n    int energy = 100;\n    for(int i = 0; i < (int)path.size() - 1; i++) {\n        energy -= (std::abs(path[i].first - path[i+1].first) + std::abs(path[i].second - path[i+1].second));\n        if(energy <= 0) return false;\n        for(const auto& pad : chargers) {\n            if(pad.first == path[i+1].first && pad.second == path[i+1].second) {\n                energy = 100;\n                break;\n            }\n        }\n    }\n    return true;\n}`,
    },
  ];

  useEffect(() => {
    fetchAssignments();
    fetchSettings();
  }, []);

  const fetchAssignments = async () => {
    try {
      const data = await apiGet<Assignment[]>('/api/assignments');
      setAssignments(data);
      if (data.length > 0 && activeAssignmentId === null) {
        setActiveAssignmentId(data[0].id);
      }
    } catch (e) {
      setError(`Backend communication error: ${e}`);
    }
  };

  const fetchSettings = async () => {
    try {
      const s = await apiGet<{ sieve_threshold: number }>('/api/settings');
      if (typeof s.sieve_threshold === 'number') setSieveThreshold(s.sieve_threshold);
    } catch {
      /* keep defaults */
    }
  };

  const executeForensicScan = async (codeToAnalyze: string, lang: LanguageKey) => {
    if (!codeToAnalyze || !activeAssignment) return;
    setIsComparing(true);
    setError(null);
    try {
      const data = await apiPost('/api/compare', {
        student_code: codeToAnalyze,
        assignment_id: String(activeAssignment.id),
        sieve_threshold: sieveThreshold,
        force: forceAnalysis,
        language: lang,
      });
      setReport(data);
      const keys = Object.keys((data as { results?: Record<string, unknown> }).results || {});
      if (keys.length > 0) setSelectedModelKey(keys[0]);
      setSelectedStudentRange(null);
      setSelectedRefRange(null);
    } catch (e) {
      setError(`Forensic scan failed: ${e}`);
    } finally {
      setIsComparing(false);
    }
  };

  const handleDemoSelect = (preset: DemoPreset) => {
    const lang = detectLanguageFromFilename(preset.name);
    setStudentCode(preset.code);
    setActiveFilename(preset.name);
    setLanguage(lang);
    executeForensicScan(preset.code, lang);
  };

  const handleFileLoaded = (codeText: string, filename: string) => {
    const lang = detectLanguageFromFilename(filename);
    setStudentCode(codeText);
    setActiveFilename(filename);
    setLanguage(lang);
    executeForensicScan(codeText, lang);
  };

  const handlePasteScan = () => {
    if (!pasteText.trim()) return;
    const filename = `pasted.${language === 'python' ? 'py' : language === 'java' ? 'java' : 'cpp'}`;
    setStudentCode(pasteText);
    setActiveFilename(filename);
    setPasteOpen(false);
    executeForensicScan(pasteText, language);
  };

  const [activeTab, setActiveTab] = useState<'code' | 'cfg' | 'technical'>('code');
  const [selectedStudentRange, setSelectedStudentRange] = useState<CodeRange | null>(null);
  const [selectedRefRange, setSelectedRefRange] = useState<CodeRange | null>(null);

  const vaultDict: Record<string, { key: string; name: string; code: string }> = {};
  (activeAssignment?.vault || []).forEach((r) => {
    vaultDict[r.model_key] = { key: r.model_key, name: r.model_name, code: r.code || '' };
  });
  const refCode = vaultDict[selectedModelKey]?.code || '';
  const activeResult = report?.results?.[selectedModelKey] || null;
  const activeModelName = vaultDict[selectedModelKey]?.name || selectedModelKey;
  const monacoLang = monacoForLanguage(language);

  return (
    <div>
      <PipelineSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sieveThreshold={sieveThreshold}
        onSieveThresholdChange={setSieveThreshold}
        forceAnalysis={forceAnalysis}
        onForceAnalysisChange={setForceAnalysis}
      />

      {/* Assignment + language bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={activeAssignmentId ?? ''}
          onChange={(e) => {
            setActiveAssignmentId(Number(e.target.value));
            setReport(null);
            setStudentCode('');
          }}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            borderRadius: 'var(--radius-md)',
            padding: '0.4rem 0.6rem',
            outline: 'none',
          }}
        >
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {a.vault?.length ?? 0} refs
            </option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <Languages size={13} />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageKey)}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              borderRadius: 'var(--radius-md)',
              padding: '0.4rem 0.6rem',
              outline: 'none',
            }}
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <button className="btn btn-ghost" onClick={() => setPasteOpen((v) => !v)}>
          <ClipboardPaste size={13} /> Paste code
        </button>
        <button className="btn btn-ghost" onClick={fetchAssignments}>
          <RefreshCw size={13} /> Refresh
        </button>
        <button className="btn" onClick={() => setIsSettingsOpen(true)}>
          Pipeline settings
        </button>
      </div>

      {pasteOpen && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-title">Paste code ({language})</div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            placeholder={language === 'python' ? 'def solve(...): ...' : language === 'java' ? 'public class Solution { ... }' : 'bool solve(...) { ... }'}
            style={{
              width: '100%',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              padding: '0.75rem',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handlePasteScan} disabled={!pasteText.trim() || isComparing}>
              {isComparing ? 'Scanning…' : 'Scan pasted code'}
            </button>
            <button className="btn btn-ghost" onClick={() => setPasteOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent-red)' }}>
          <span style={{ fontSize: '0.8rem', color: '#e87070' }}>{error}</span>
        </div>
      )}

      {report && studentCode ? (
        <div className="animate-fade-in">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 0',
              marginBottom: '1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Submission</span>
              <span style={{ color: 'var(--text-faint)' }}>/</span>
              <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {activeFilename || 'custom'} · {monacoLang}
              </span>
              {isComparing && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  <RefreshCw className="animate-spin" size={11} />
                  scanning…
                </span>
              )}
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              onClick={() => {
                setReport(null);
                setStudentCode('');
              }}
            >
              ← new file
            </button>
          </div>

          <AnalysisOverview
            report={report}
            models={vaultDict}
            selectedModelKey={selectedModelKey}
            onSelectModelKey={setSelectedModelKey}
            onSelectTab={setActiveTab}
          />

          <InspectorWorkspace
            activeTab={activeTab}
            onTabChange={setActiveTab}
            studentCode={studentCode}
            refCode={refCode}
            selectedStudentRange={selectedStudentRange}
            selectedRefRange={selectedRefRange}
            onSelectStudentRange={setSelectedStudentRange}
            onSelectRefRange={setSelectedRefRange}
            activeResult={activeResult}
            modelName={activeModelName}
            sieveThreshold={sieveThreshold}
            forceAnalysis={forceAnalysis}
            language={monacoLang}
          />
        </div>
      ) : (
        <EmptyState
          testSubmissions={testSubmissions}
          activeCode={studentCode}
          onSelectDemo={handleDemoSelect}
          onFileLoaded={handleFileLoaded}
          isComparing={isComparing}
        />
      )}
    </div>
  );
}
