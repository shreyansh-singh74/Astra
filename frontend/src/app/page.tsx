'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../components/layout/Navbar';
import PipelineSettingsDrawer from '../components/settings/PipelineSettingsDrawer';
import EmptyState from '../components/upload/EmptyState';
import { DemoPreset } from '../components/upload/DemoPresets';
import AnalysisOverview from '../components/analysis/AnalysisOverview';
import InspectorWorkspace from '../components/inspector/InspectorWorkspace';
import { RefreshCw } from 'lucide-react';

interface CodeRange {
  start_line: number;
  end_line: number;
  start_byte: number;
  end_byte: number;
}

interface AIModel {
  key: string;
  name: string;
  code: string;
}

interface Assignment {
  id: string;
  name: string;
  description: string;
  ai_vault: Record<string, AIModel>;
}

export default function Dashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);

  // Submission State
  const [studentCode, setStudentCode] = useState<string>('');
  const [activeFilename, setActiveFilename] = useState<string | null>(null);
  const [selectedModelKey, setSelectedModelKey] = useState<string>('gpt4o');
  
  // Pipeline Parameters
  const [sieveThreshold, setSieveThreshold] = useState<number>(0.10);
  const [forceAnalysis, setForceAnalysis] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Analysis Report & Execution
  const [isComparing, setIsComparing] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [report, setReport] = useState<any>(null);

  // Active Inspector Tab
  const [activeTab, setActiveTab] = useState<'code' | 'cfg' | 'technical'>('code');
  const [selectedStudentRange, setSelectedStudentRange] = useState<CodeRange | null>(null);
  const [selectedRefRange, setSelectedRefRange] = useState<CodeRange | null>(null);

  // Pre-loaded obfuscation demo test cases
  const testSubmissions: DemoPreset[] = [
    {
      name: "student_gpt4o_renamed.cpp",
      label: "GPT-4o Renamed Variables",
      description: "Identifiers and helper names scrubbed & renamed.",
      code: `#include <vector>\n#include <cmath>\n#include <algorithm>\n\nint getManhattanDistance(std::pair<int, int> a, std::pair<int, int> b) {\n    return std::abs(a.first - b.first) + std::abs(a.second - b.second);\n}\n\nbool isPathFeasible(std::vector<std::pair<int, int>> points, std::vector<std::pair<int, int>> powerStations) {\n    int chargeRemaining = 100;\n    \n    for (size_t idx = 0; idx < points.size() - 1; ++idx) {\n        chargeRemaining -= getManhattanDistance(points[idx], points[idx+1]);\n        if (chargeRemaining <= 0) return false;\n        \n        auto searchIt = std::find(powerStations.begin(), powerStations.end(), points[idx+1]);\n        if (searchIt != powerStations.end()) {\n            chargeRemaining = 100;\n        }\n    }\n    return true;\n}`
    },
    {
      name: "student_claude35_arrays.cpp",
      label: "Claude 3.5 Array De-clustered",
      description: "Data structure altered into raw array checks.",
      code: `#include <vector>\n#include <cmath>\n\nbool checkStation(std::pair<int, int> spot, const std::vector<std::pair<int, int>>& locations) {\n    for (const auto& loc : locations) {\n        if (loc.first == spot.first && loc.second == spot.second) return true;\n    }\n    return false;\n}\n\nbool evaluateRoute(std::vector<std::pair<int, int>> coordinates, std::vector<std::pair<int, int>> stations) {\n    int juice = 100;\n    \n    for (size_t i = 1; i < coordinates.size(); ++i) {\n        int dist = std::abs(coordinates[i].first - coordinates[i-1].first) + std::abs(coordinates[i].second - coordinates[i-1].second);\n        juice -= dist;\n        \n        if (juice <= 0) {\n            return false;\n        }\n        \n        if (checkStation(coordinates[i], stations)) {\n            juice = 100;\n        }\n    }\n    return true;\n}`
    },
    {
      name: "student_gemini15_loops.cpp",
      label: "Gemini 1.5 Flat Logic",
      description: "Control flow flattened with nested for-loops.",
      code: `#include <vector>\n#include <cmath>\n\nbool checkCartRoute(std::vector<std::pair<int, int>>& path, std::vector<std::pair<int, int>>& chargers) {\n    int energy = 100;\n    \n    for(int i = 0; i < (int)path.size() - 1; i++) {\n        energy -= (std::abs(path[i].first - path[i+1].first) + std::abs(path[i].second - path[i+1].second));\n        if(energy <= 0) return false;\n        \n        for(const auto& pad : chargers) {\n            if(pad.first == path[i+1].first && pad.second == path[i+1].second) {\n                energy = 100;\n                break;\n            }\n        }\n    }\n    return true;\n}`
    }
  ];

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/assignments');
      const data = await res.json();
      setAssignments(data);
      if (data.length > 0) {
        setActiveAssignment(data[0]);
      }
    } catch (e) {
      console.error("Backend communication error:", e);
    }
  };

  const executeForensicScan = async (codeToAnalyze: string) => {
    if (!codeToAnalyze) return;
    setIsComparing(true);
    try {
      const res = await fetch('http://localhost:8000/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_code: codeToAnalyze,
          assignment_id: activeAssignment?.id || 'assignment_1',
          sieve_threshold: sieveThreshold,
          force: forceAnalysis,
        }),
      });
      const data = await res.json();
      setReport(data);
      setSelectedStudentRange(null);
      setSelectedRefRange(null);
    } catch (e) {
      console.error("Forensic scan pipeline execution error:", e);
    } finally {
      setIsComparing(false);
    }
  };

  const handleDemoSelect = (preset: DemoPreset) => {
    setStudentCode(preset.code);
    setActiveFilename(preset.name);
    executeForensicScan(preset.code);
  };

  const handleFileLoaded = (codeText: string, filename: string) => {
    setStudentCode(codeText);
    setActiveFilename(filename);
    executeForensicScan(codeText);
  };

  const refCode = activeAssignment?.ai_vault?.[selectedModelKey]?.code || '';
  const activeResult = report?.results?.[selectedModelKey] || null;
  const activeModelName = activeAssignment?.ai_vault?.[selectedModelKey]?.name || selectedModelKey;

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        assignments={assignments}
        activeAssignment={activeAssignment}
        onSelectAssignment={setActiveAssignment}
        onRefresh={fetchAssignments}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Slide-Over Settings Drawer */}
      <PipelineSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sieveThreshold={sieveThreshold}
        onSieveThresholdChange={setSieveThreshold}
        forceAnalysis={forceAnalysis}
        onForceAnalysisChange={setForceAnalysis}
      />

      {/* Main Content Area */}
      {report && studentCode ? (
        <div className="animate-fade-in">
          {/* Slim file bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 0',
            marginBottom: '1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Submission</span>
              <span style={{ color: 'var(--text-faint)' }}>/</span>
              <span style={{
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}>
                {activeFilename || 'custom'}
              </span>
              {isComparing && (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  marginLeft: '0.5rem',
                }}>
                  <RefreshCw className="animate-spin" size={11} />
                  scanning…
                </span>
              )}
            </div>
            <button
              className="btn btn-ghost"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              onClick={() => { setReport(null); setStudentCode(''); }}
            >
              ← new file
            </button>
          </div>

          <AnalysisOverview
            report={report}
            models={activeAssignment?.ai_vault || {}}
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
