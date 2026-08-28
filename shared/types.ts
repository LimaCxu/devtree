export type SkillKey = 'python' | 'fastapi' | 'api' | 'llm' | 'testing' | 'database' | 'rag' | 'agents' | 'evaluation';

export type CapabilityState = '✓' | '△' | '✕';
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ScanStage = 'queued' | 'repositories' | 'evidence' | 'ai_review' | 'scoring' | 'completed' | 'failed';

export interface Evidence {
  capability: string;
  repository: string;
  path: string;
  line: number;
  summary: string;
  url: string;
  _snippet?: string;
}

export interface Skill {
  title: string;
  level: number;
  score: number;
  confidence: number;
  capabilities: Array<[CapabilityState, string]>;
  caps?: Array<[CapabilityState, string]>;
  repositoryCount: number;
  evidence: Evidence[];
  reason: string;
  next: string;
}

export interface DeveloperProfile {
  login: string;
  name: string;
  avatarUrl?: string;
  bio?: string | null;
  repositoryCount?: number;
  overallLevel?: number;
}

export interface AnalysisResult {
  profile: DeveloperProfile;
  scannedAt: string;
  filesInspected: number;
  repositories: Array<{ name: string; url: string; language: string | null; pushedAt: string }>;
  skills: Record<SkillKey, Skill>;
  aiReview: { used: boolean; model: string; reason?: string; reviewedAt?: string };
}

export interface ScanRecord {
  id: string;
  status: ScanStatus;
  stage: ScanStage;
  progress: number;
  result: AnalysisResult | null;
  error: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  connected: boolean;
  user: DeveloperProfile | null;
  oauthConfigured: boolean;
  unavailable?: boolean;
}
