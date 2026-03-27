export interface CorrectiveAction {
  id: string;
  action: string;
  responsible: string;
  deadlineDate: string;
  deadlineTime: string;
  successMetric: string;
  // Implementation fields
  fixDone?: string;
  pilotLine?: string;
  fixBy?: string;
  fixTime?: string;
  retrained?: string;
  sopUpdated?: string;
  trial?: string;
}

export interface PDCARecord {
  id: string;
  date: string;
  time: string;
  detectedBy: string;
  line: string;
  defect: string;
  piecesAffected: string;
  containment: string;
  whatDefect: string;
  operation: string;
  startedWhen: string;
  dhuBefore: number | null;
  piecesInspected: string;
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  fishbone: string;
  correctiveActions: CorrectiveAction[];
  targetDHU: number | null;
  monitorPeriod: string;
  monitorStartTime?: string;
  monitorEndTime?: string;
  piecesChecked: string;
  defectsAfter: string;
  dhuAfter: number | null;
  targetMet: string;
  supervisorReview: string;
  verifyNotes: string;
  rollout: string;
  rolloutLines: string;
  boardUpdated: string;
  briefing: string;
  finalSOP: string;
  closedBy: string;
  lessons: string;
  feedWeekly: string;
  responseTime: number;
  status: 'Open' | 'Closed';
  currentStep?: number;
  createdAt: string;
  closedAt?: string;
  authorUid?: string;
}

export type FishboneCategory = 'Man' | 'Machine' | 'Method' | 'Material' | 'Environment' | 'Measurement';
