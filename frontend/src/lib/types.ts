export interface TierScores {
  token_score: number;
  ast_score: number;
  cfg_score: number;
  semantic_score: number;
  final_score: number;
  flag: string | null;
  status?: string;
  diagnostics?: string;
  student_ast_code?: string;
  ref_ast_code?: string;
  student_cfg?: CFGGraph;
  ref_cfg?: CFGGraph;
}

export interface CFGGraph {
  nodes: CFGNode[];
  edges: CFGEdge[];
}

export interface CFGNode {
  id: string;
  type: string;
  label: string;
  start_byte: number;
  end_byte: number;
  start_line: number;
  end_line: number;
  code: string;
}

export interface CFGEdge {
  source: string;
  target: string;
}

export type LanguageKey = 'cpp' | 'python' | 'java';

export interface VaultRef {
  id: number;
  model_key: string;
  model_name: string;
  source: 'seed' | 'manual' | 'openrouter';
  language: string;
  code?: string;
  created_at?: string;
}

export interface Assignment {
  id: number;
  name: string;
  description: string;
  problem_statement: string;
  created_at?: string;
  vault?: VaultRef[];
  submission_count?: number;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_name: string;
  filename: string;
  language: string;
  code_size?: number;
  code?: string;
  created_at?: string;
}

export interface SingleReport {
  report_id: number;
  submission: { id: number; student_name: string; filename: string; language: string };
  is_flagged: boolean;
  flagged_reasons: string[];
  results: Record<string, TierScores>;
}

export interface BulkVerdict {
  report_id: number;
  submission_id: number;
  student_name: string;
  filename: string;
  language: string;
  is_flagged: boolean;
  flagged_reasons: string[];
  max_score: number;
  results: Record<string, TierScores>;
}

export interface CollusionStudent {
  id: number;
  student_name: string;
  filename: string;
  language: string;
}

export interface CollusionPair {
  a_id: number;
  b_id: number;
  a_name: string;
  b_name: string;
  token_score: number;
  ast_score: number;
  cfg_score: number;
  semantic_score: number;
  final_score: number;
  diagnostics?: string;
}

export interface CollusionCluster {
  member_ids: number[];
  members: string[];
  avg_internal_score: number;
  peak_internal_score: number;
}

export interface CollusionResult {
  students: CollusionStudent[];
  pairs: CollusionPair[];
  matrix: number[][];
  clusters: CollusionCluster[];
  threshold: number;
}

export interface BulkJobResult {
  assignment_id: number;
  assignment_name: string;
  scanned: number;
  flagged_count: number;
  vault_verdicts: Record<string, BulkVerdict>;
  collusion: CollusionResult;
  collusion_report_id: number;
}

export interface JobState {
  id: string;
  kind: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  result: BulkJobResult | null;
  error: string | null;
}

export interface AppSettings {
  has_api_key: boolean;
  weights: { token: number; ast: number; cfg: number; semantic: number };
  sieve_threshold: number;
  collusion_threshold: number;
  default_models: string[];
}

export interface CuratedModel {
  slug: string;
  name: string;
  vendor: string;
}

export interface ReportSummary {
  id: number;
  submission_id: number;
  assignment_id: number;
  mode: string;
  max_score: number;
  is_flagged: number | boolean;
  created_at: string;
  student_name: string;
  filename: string;
}

export const LANGUAGE_OPTIONS: { key: LanguageKey; label: string; monaco: string; ext: string }[] = [
  { key: 'cpp', label: 'C++', monaco: 'cpp', ext: '.cpp' },
  { key: 'python', label: 'Python', monaco: 'python', ext: '.py' },
  { key: 'java', label: 'Java', monaco: 'java', ext: '.java' },
];

export function monacoForLanguage(lang: string): string {
  const found = LANGUAGE_OPTIONS.find((l) => l.key === (lang || '').toLowerCase());
  return found ? found.monaco : 'cpp';
}

export function detectLanguageFromFilename(filename: string): LanguageKey {
  const n = (filename || '').toLowerCase();
  if (n.endsWith('.py')) return 'python';
  if (n.endsWith('.java')) return 'java';
  return 'cpp';
}
