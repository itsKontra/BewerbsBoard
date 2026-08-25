import { type CategoryEntry, type RunStatus, computeEntryScore } from './scoring.js';
import { parseGermanTimeToHundredths } from '../utils/time-parser.js';

export class EntryValidationError extends Error {
  readonly statusCode: number = 400;

  constructor(message: string) {
    super(message);
    this.name = 'EntryValidationError';
  }
}

export interface EntryUpdateInput {
  attackTimeStr?: string | null;
  attackTimeHundredths?: number | null;
  attackTimeErrors?: number | string | null;
  errors?: number | string | null; // legacy alias
  relayRaceHundredths?: number | null;
  relayRaceErrors?: number | string | null;
  runStatus?: string | null;
}

export interface EntryLifecycleContext {
  hasRelayRace: boolean;
  /** Function to provide the next start order position if transitioning from non-OPEN to OPEN */
  getNextOpenPosition?: () => number;
  /** Optional display context for audit entries */
  groupName?: string;
  categoryName?: string;
}

export interface EntryUpdateResult {
  /** The updated CategoryEntry to be persisted */
  nextEntry: CategoryEntry;
  /** Display score in hundredths of a second (or null if OPEN/DNF) */
  scoreHundredths: number | null;
  /** True when transitioning from OPEN to non-OPEN (triggering compaction of remaining open entries) */
  requiresCompaction: boolean;
  /** Standardized audit event payload */
  auditPayload: {
    operation: 'UPDATE';
    previous_value: Record<string, unknown>;
    new_value: Record<string, unknown>;
  };
}

export interface EntryDeletionResult {
  canDelete: boolean;
  errorMessage?: string;
  requiresCompaction: boolean;
  auditPayload: {
    operation: 'DELETE_CATEGORY_ENTRY';
    previous_value: Record<string, unknown>;
    new_value: null;
  };
}

// ---------------------------------------------------------------------------
// Field Parsers & Validators (Pure)
// ---------------------------------------------------------------------------

function parseAttackTime(input: EntryUpdateInput, previousTime: number | null): number | null {
  if ('attackTimeStr' in input) {
    const val = input.attackTimeStr;
    if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
    if (typeof val === 'string') {
      const parsed = parseGermanTimeToHundredths(val);
      if (parsed === null) {
        throw new EntryValidationError(
          'Invalid German decimal time format. Example valid inputs: 42, 42,3, 42,38 (0.01 to 999.99)'
        );
      }
      return parsed;
    }
  } else if ('attackTimeHundredths' in input) {
    return typeof input.attackTimeHundredths === 'number' ? input.attackTimeHundredths : null;
  }
  return previousTime;
}

function parseErrorCount(
  val: unknown,
  previousErrors: number | null,
  errorMessage: string
): number | null {
  if (val === undefined) return previousErrors;
  if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
  const numErrors = Number(val);
  if (isNaN(numErrors) || numErrors < 0 || !Number.isInteger(numErrors)) {
    throw new EntryValidationError(errorMessage);
  }
  return numErrors;
}

function extractAttackErrors(input: EntryUpdateInput, previousErrors: number | null): number | null {
  if ('attackTimeErrors' in input || 'errors' in input) {
    const val = 'attackTimeErrors' in input ? input.attackTimeErrors : input.errors;
    return parseErrorCount(val, previousErrors, 'Error count must be a non-negative integer');
  }
  return previousErrors;
}

function extractRelayHundredths(input: EntryUpdateInput, previousHundredths: number | null): number | null {
  if ('relayRaceHundredths' in input) {
    return typeof input.relayRaceHundredths === 'number' ? input.relayRaceHundredths : null;
  }
  return previousHundredths;
}

function extractRelayErrors(input: EntryUpdateInput, previousErrors: number | null): number | null {
  if ('relayRaceErrors' in input) {
    return parseErrorCount(input.relayRaceErrors, previousErrors, 'Relay error count must be a non-negative integer');
  }
  return previousErrors;
}

function determineTargetRunStatus(
  input: EntryUpdateInput,
  previousStatus: RunStatus,
  hasRelayRace: boolean,
  newAttackTime: number | null,
  newAttackErrors: number | null,
  newRelayHundredths: number | null,
  newRelayErrors: number | null
): RunStatus {
  if (input.runStatus) {
    if (!['OPEN', 'VALID', 'DNF'].includes(input.runStatus)) {
      throw new EntryValidationError('Invalid runStatus value');
    }
    return input.runStatus as RunStatus;
  }

  if (previousStatus === 'OPEN' && newAttackTime !== null && newAttackErrors !== null) {
    const needsRelay = hasRelayRace;
    const hasRelay = newRelayHundredths !== null && newRelayErrors !== null;
    if (!needsRelay || hasRelay) {
      return 'VALID';
    }
  }

  return previousStatus;
}

// ---------------------------------------------------------------------------
// Pure Lifecycle Entry Points
// ---------------------------------------------------------------------------

/**
 * Calculates the next state of a CategoryEntry given partial update input and context.
 * Pure in-process computation: validates inputs, handles OPEN -> VALID auto-promotion,
 * determines start order positions, and builds audit payloads.
 */
export function calculateEntryUpdate(
  existing: CategoryEntry,
  input: EntryUpdateInput,
  context: EntryLifecycleContext
): EntryUpdateResult {
  const newAttackTime = parseAttackTime(input, existing.attackTimeHundredths);
  const prevAttackErrors = existing.attackTimeErrors ?? (existing as any).errors ?? null;
  const newAttackErrors = extractAttackErrors(input, prevAttackErrors);
  const newRelayHundredths = extractRelayHundredths(input, existing.relayRaceHundredths);
  const newRelayErrors = extractRelayErrors(input, existing.relayRaceErrors);

  const targetRunStatus = determineTargetRunStatus(
    input,
    existing.runStatus,
    context.hasRelayRace,
    newAttackTime,
    newAttackErrors,
    newRelayHundredths,
    newRelayErrors
  );

  let newStartOrderPosition = existing.startOrderPosition;
  if (targetRunStatus !== 'OPEN') {
    newStartOrderPosition = null;
  } else if (existing.runStatus !== 'OPEN') {
    newStartOrderPosition = context.getNextOpenPosition ? context.getNextOpenPosition() : null;
  }

  const nextEntry: CategoryEntry = {
    ...existing,
    attackTimeHundredths: newAttackTime,
    attackTimeErrors: newAttackErrors,
    relayRaceHundredths: newRelayHundredths,
    relayRaceErrors: newRelayErrors,
    runStatus: targetRunStatus,
    startOrderPosition: newStartOrderPosition,
  };

  const scoreHundredths = targetRunStatus === 'VALID' && newAttackTime !== null && newAttackErrors !== null
    ? computeEntryScore(
        {
          attackTimeHundredths: newAttackTime,
          attackTimeErrors: newAttackErrors,
          relayRaceHundredths: newRelayHundredths,
          relayRaceErrors: newRelayErrors,
        },
        { hasRelayRace: context.hasRelayRace, excludeRelayRace: false }
      )
    : null;

  const requiresCompaction = existing.runStatus === 'OPEN' && targetRunStatus !== 'OPEN';

  const prevAuditObj: Record<string, unknown> = {
    ...(context.groupName ? { group: context.groupName } : {}),
    ...(context.categoryName ? { category: context.categoryName } : {}),
    id: existing.id,
    runStatus: existing.runStatus,
    startOrderPosition: existing.startOrderPosition,
    attackTimeHundredths: existing.attackTimeHundredths,
    attackTimeErrors: existing.attackTimeErrors,
    relayRaceHundredths: existing.relayRaceHundredths,
    relayRaceErrors: existing.relayRaceErrors,
  };

  const nextAuditObj: Record<string, unknown> = {
    ...(context.groupName ? { group: context.groupName } : {}),
    ...(context.categoryName ? { category: context.categoryName } : {}),
    id: nextEntry.id,
    runStatus: nextEntry.runStatus,
    startOrderPosition: nextEntry.startOrderPosition,
    attackTimeHundredths: nextEntry.attackTimeHundredths,
    attackTimeErrors: nextEntry.attackTimeErrors,
    relayRaceHundredths: nextEntry.relayRaceHundredths,
    relayRaceErrors: nextEntry.relayRaceErrors,
  };

  return {
    nextEntry,
    scoreHundredths,
    requiresCompaction,
    auditPayload: {
      operation: 'UPDATE',
      previous_value: prevAuditObj,
      new_value: nextAuditObj,
    },
  };
}

/**
 * Validates whether an entry can be removed and prepares compaction/audit details.
 */
export function validateEntryDeletion(
  existing: CategoryEntry,
  context?: { groupName?: string; categoryName?: string }
): EntryDeletionResult {
  if (existing.runStatus !== 'OPEN') {
    return {
      canDelete: false,
      errorMessage: 'Only OPEN entries can be removed',
      requiresCompaction: false,
      auditPayload: {
        operation: 'DELETE_CATEGORY_ENTRY',
        previous_value: {},
        new_value: null,
      },
    };
  }

  return {
    canDelete: true,
    requiresCompaction: true,
    auditPayload: {
      operation: 'DELETE_CATEGORY_ENTRY',
      previous_value: {
        entryId: existing.id,
        ...(context?.groupName ? { group: context.groupName } : {}),
        ...(context?.categoryName ? { category: context.categoryName } : {}),
      },
      new_value: null,
    },
  };
}
