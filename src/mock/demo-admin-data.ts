// In-memory state for the Vite development API. All values are projected from
// shared/seed/seed-data.json and reset whenever the Vite process restarts.

import { createDemoData } from '../../shared/seed/seed-data.js';

const demo = createDemoData();

export type MockCompetitionClass = (typeof demo.competitionClasses)[number];
export type MockCategoryType = (typeof demo.categoryTypes)[number];
export type MockEvaluationType = (typeof demo.evaluationTypes)[number];
export type MockBrigade = (typeof demo.brigades)[number];
export type MockGroup = (typeof demo.groups)[number];
export type MockCategoryEntry = (typeof demo.categoryEntries)[number];
export interface MockAuditLog {
  id: string;
  timestamp: number;
  user: string;
  action: string;
  details: string | null;
}

export const mockCompetitionClasses = demo.competitionClasses;
export const mockCategoryTypes = demo.categoryTypes;
export const mockEvaluationTypes = demo.evaluationTypes;
export const mockBrigades = demo.brigades;
export const mockGroups = demo.groups;
export const mockCategoryEntries = demo.categoryEntries;
export const mockConfig = demo.config;
export const mockTvState: {
  mode: 'ROTATION' | 'FIXED' | 'MESSAGE' | 'WINNERS';
  selectedCategoryId: string | null;
  updatedAt: number;
  tvAnnouncement: null | { headline: string; message: string };
} = demo.tvState;
export const mockAuditLogs: MockAuditLog[] = demo.auditLogs;
