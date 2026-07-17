'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, AlertTriangle, Play, RefreshCw, BarChart2, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import SplitView from '../components/SplitView';
import CfgVisualizer from '../components/CfgVisualizer';

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
  
  // Submission and controls
  const [studentCode, setStudentCode] = useState<string>('');
  const [selectedModelKey, setSelectedModelKey] = useState<string>('gpt4o');
  const [sieveThreshold, setSieveThreshold] = useState<number>(0.10);
  const [forceAnalysis, setForceAnalysis] = useState<boolean>(true); // Default true to allow comprehensive analysis on mock uploads
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [dragActive, setDragActive] = useState<boolean>(false);
  
  // Results
  const [report, setReport] = useState<any>(null);
  const [selectedStudentRange, setSelectedStudentRange] = useState<CodeRange | null>(null);
  const [selectedRefRange, setSelectedRefRange] = useState<CodeRange | null>(null);

  // Pre-compiled list of local test files that can be auto-loaded for easy demo
  const testSubmissions = [
    {
      name: "student_gpt4o_renamed.cpp",
      label: "GPT-4o Renamed",
      code: `#include <vector>\n#include <cmath>\n#include <algorithm>\n\nint getManhattanDistance(std::pair<int, int> a, std::pair<int, int> b) {\n    return std::abs(a.first - b.first) + std::abs(a.second - b.second);\n}\n\nbool isPathFeasible(std::vector<std::pair<int, int>> points, std::vector<std::pair<int, int>> powerStations) {\n    int chargeRemaining = 100;\n    \n    for (size_t idx = 0; idx < points.size() - 1; ++idx) {\n        chargeRemaining -= getManhattanDistance(points[idx], points[idx+1]);\n        if (chargeRemaining <= 0) return false;\n        \n        auto searchIt = std::find(powerStations.begin(), powerStations.end(), points[idx+1]);\n        if (searchIt != powerStations.end()) {\n            chargeRemaining = 100;\n        }\n    }\n    return true;\n}`
    },
    {
      name: "student_claude35_arrays.cpp",
      label: "Claude 3.5 (Array De-clustered)",
      code: `#include <vector>\n#include <cmath>\n\nbool checkStation(std::pair<int, int> spot, const std::vector<std::pair<int, int>>& locations) {\n    for (const auto& loc : locations) {\n        if (loc.first == spot.first && loc.second == spot.second) return true;\n    }\n    return false;\n}\n\nbool evaluateRoute(std::vector<std::pair<int, int>> coordinates, std::vector<std::pair<int, int>> stations) {\n    int juice = 100;\n    \n    for (size_t i = 1; i < coordinates.size(); ++i) {\n        int dist = std::abs(coordinates[i].first - coordinates[i-1].first) + std::abs(coordinates[i].second - coordinates[i-1].second);\n        juice -= dist;\n        \n        if (juice <= 0) {\n            return false;\n        }\n        \n        if (checkStation(coordinates[i], stations)) {\n            juice = 100;\n        }\n    }\n    return true;\n}`
    },
    {
      name: "student_gemini15_loops.cpp",
      label: "Gemini 1.5 Flat Logic",
      code: `#include <vector>\n#include <cmath>\n\nbool checkCartRoute(std::vector<std::pair<int, int>>& path, std::vector<std::pair<int, int>>& chargers) {\n    int energy = 100;\n    \n    for(int i = 0; i < (int)path.size() - 1; i++) {\n        energy -= (std::abs(path[i].first - path[i+1].first) + std::abs(path[i].second - path[i+1].second));\n        if(energy <= 0) return false;\n        \n        for(const auto& pad : chargers) {\n            if(pad.first == path[i+1].first && pad.second == path[i+1].second) {\n                energy = 100;\n                break;\n            }\n        }\n    }\n    return true;\n}`
    }
  ];

  // Fetch initial assignments and vault files
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
      console.error("Error communicating with backend:", e);
    }
  };

  const handleCompare = async (codeToSubmit?: string) => {
    const finalCode = codeToSubmit !== undefined ? codeToSubmit : studentCode;
    if (!finalCode) return;
    
    setIsComparing(true);
    try {
      const res = await fetch('http://localhost:8000/api/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_code: finalCode,
          assignment_id: activeAssignment?.id || 'assignment_1',
          sieve_threshold: sieveThreshold,
          force: forceAnalysis,
        }),
      });
      const data = await res.json();
      setReport(data);
      // Reset highlights
      setSelectedStudentRange(null);
      setSelectedRefRange(null);
    } catch (e) {
      console.error("Error running comparison pipeline:", e);
    } finally {
      setIsComparing(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const text = await file.text();
      setStudentCode(text);
      handleCompare(text);
    }
  };

  const handleDemoSelect = (code: string) => {
    setStudentCode(code);
    handleCompare(code);
  };

  // Extract current scores for the active selected model comparison
  const activeResult = report?.results?.[selectedModelKey];
  const refCode = activeAssignment?.ai_vault?.[selectedModelKey]?.code || '';

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-section">
          <div className="logo-icon">🔍</div>
          <div>
            <h1 className="logo-text">CodeSleuth AI</h1>
            <p className="logo-tagline">Source Forensic Diagnostics Pipeline</p>
          </div>
        </div>
        
        {/* Quick info */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ textRendering: 'optimizeLegibility', textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
            <div style={{ fontSize: '0.9rem', color: 'var(--accent-success)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--accent-success)', borderRadius: '50%' }}></span>
              Local Vault Connected
            </div>
          </div>
          <button className="btn btn-secondary" onClick={fetchAssignments} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {activeAssignment ? (
        <div className="dashboard-grid">
          {/* Left Sidebar: Submission Loading and Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h2 className="card-title">
                <FileText size={18} color="var(--accent-primary)" />
                Assignment Profile
              </h2>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {activeAssignment.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxHeight: '100px', overflowY: 'auto' }}>
                {activeAssignment.description}
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">
                <Upload size={18} color="var(--accent-primary)" />
                Upload Submission
              </h2>
              
              {/* Dropzone */}
              <div 
                className={`dropzone ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="dropzone-icon">📄</div>
                <div className="dropzone-title">Drop student file here</div>
                <div className="dropzone-desc">supports C++ (.cpp) source</div>
              </div>

              {/* Demo Selection */}
              <div style={{ marginTop: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Pre-Loaded Obfuscation Demos
                </span>
                <div className="list-container">
                  {testSubmissions.map((sub, idx) => {
                    const isActive = studentCode === sub.code;
                    return (
                      <div 
                        key={idx}
                        className={`list-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleDemoSelect(sub.code)}
                      >
                        <div>
                          <div className="list-item-title">{sub.label}</div>
                          <div className="list-item-sub">{sub.name}</div>
                        </div>
                        {isActive && <CheckCircle2 size={16} color="var(--accent-primary)" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="card-title">⚙️ Pipeline Settings</h2>
              
              <div className="switch-row" style={{ marginBottom: '0.75rem' }}>
                <span className="switch-label">Dual-Sieve Winnow Threshold</span>
                <input 
                  type="number" 
                  step="0.05"
                  min="0.05"
                  max="0.50"
                  value={sieveThreshold}
                  onChange={(e) => setSieveThreshold(parseFloat(e.target.value))}
                  style={{ width: '60px', padding: '0.2rem', background: '#1c1f2f', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff', fontSize: '0.85rem' }}
                />
              </div>

              <div className="switch-row">
                <span className="switch-label">Bypass Sieve (Force Analyze)</span>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={forceAnalysis}
                    onChange={(e) => setForceAnalysis(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <button 
                className="btn" 
                onClick={() => handleCompare()} 
                disabled={isComparing || !studentCode}
                style={{ width: '100%', marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isComparing ? (
                  <>
                    <RefreshCw className="animate-spin" size={16} /> Running Scans...
                  </>
                ) : (
                  <>
                    <Play size={16} /> Execute Forensics Loop
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Main Analytics Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {report ? (
              <>
                {/* Obfuscation Alert Banner */}
                {report.is_flagged && (
                  <div className="alert-banner alert-banner-danger">
                    <ShieldAlert size={24} color="var(--accent-secondary)" style={{ flexShrink: 0 }} />
                    <div>
                      <div className="alert-title" style={{ color: 'var(--accent-secondary)' }}>
                        AI PLAGIARISM DETECTED
                      </div>
                      <div className="alert-desc">
                        {report.flagged_reasons.map((reason: string, idx: number) => (
                          <div key={idx} style={{ marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                            • {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Reference Tabs Selector */}
                <div className="tabs">
                  {Object.keys(activeAssignment.ai_vault).map(key => {
                    const model = activeAssignment.ai_vault[key];
                    const modelFlag = report.results[key]?.flag;
                    const isActive = selectedModelKey === key;
                    
                    return (
                      <div 
                        key={key} 
                        className={`tab-item ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedModelKey(key);
                          setSelectedStudentRange(null);
                          setSelectedRefRange(null);
                        }}
                      >
                        {model.name}
                        {modelFlag && (
                          <span style={{ marginLeft: '0.4rem', display: 'inline-block', width: '6px', height: '6px', background: 'var(--accent-secondary)', borderRadius: '50%' }}></span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Active Comparison Metrics */}
                {activeResult ? (
                  <>
                    {/* Diagnostic specific alerts */}
                    {activeResult.flag && (
                      <div className="alert-banner" style={{ margin: '0 0 1rem 0', background: 'rgba(236, 72, 153, 0.08)', border: '1px solid rgba(236, 72, 153, 0.25)' }}>
                        <AlertTriangle size={18} color="var(--accent-secondary)" />
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>
                            {activeResult.flag}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            {activeResult.diagnostics}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="metric-grid">
                      <div className="metric-card" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                        <span className="metric-label">Fused Fingerprint</span>
                        <span className="metric-value" style={{ color: 'var(--accent-primary)' }}>
                          {activeResult.final_score.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">Token Winnowing</span>
                        <span className="metric-value">
                          {activeResult.token_score.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">AST Structure</span>
                        <span className="metric-value">
                          {activeResult.ast_score.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">CFG WL-Kernel</span>
                        <span className="metric-value">
                          {activeResult.cfg_score.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1 })}
                        </span>
                      </div>
                      <div className="metric-card">
                        <span className="metric-label">CodeBERT Semantic</span>
                        <span className="metric-value" style={{ color: 'var(--accent-success)' }}>
                          {activeResult.semantic_score.toLocaleString(undefined, { style: 'percent', minimumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>

                    <div className="comparison-layout">
                      {/* Split Monaco Editors */}
                      <SplitView
                        studentCode={studentCode}
                        refCode={refCode}
                        selectedStudentRange={selectedStudentRange}
                        selectedRefRange={selectedRefRange}
                      />

                      {/* Interactive CFG panels */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <BarChart2 size={16} /> Interactive Control Flow Graph (CFG)
                          </h3>
                          <span className="decorations-info">Click any node below to sync highlighting</span>
                        </div>
                        <CfgVisualizer
                          studentCfg={activeResult.student_cfg}
                          refCfg={activeResult.ref_cfg}
                          onSelectStudentNode={setSelectedStudentRange}
                          onSelectRefNode={setSelectedRefRange}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    Selecting reference model comparison...
                  </div>
                )}
              </>
            ) : (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', borderStyle: 'dashed', textAlign: 'center' }}>
                <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</span>
                <h3>Forensics Report Empty</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0.5rem 0 1.5rem 0' }}>
                  Load a pre-loaded obfuscation demo on the left or drop a student file to trigger the multi-tier forensic comparison loops.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn" onClick={() => handleDemoSelect(testSubmissions[0].code)}>
                    Load GPT-4o Demo
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleDemoSelect(testSubmissions[1].code)}>
                    Load Claude 3.5 Demo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
          <RefreshCw className="animate-spin" size={32} color="var(--accent-primary)" />
          <span>Connecting to CodeSleuth backend API...</span>
        </div>
      )}
      
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
