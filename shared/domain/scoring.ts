export type RunStatus = 'OPEN' | 'VALID' | 'DNF';

// ---------------------------------------------------------------------------
// Raw data shapes (mirror DB columns, no computed fields)
// ---------------------------------------------------------------------------

export interface CategoryEntry {
  id: string;
  groupId: string;
  categoryTypeId: string;
  runStatus: RunStatus;
  startOrderPosition: number | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
  /** Computed by the server layer before ranking; null for OPEN/DNF entries. */
  scoreHundredths?: number | null;
  rank?: number | null;
  fireBrigadeId?: string;
  competitionClass?: string;
}

export interface GroupInfo {
  id: string;
  fireBrigadeId: string;
  /** Name of the competitionClass, e.g. 'AKTIV' | 'JUGEND' | 'GAST' */
  competitionClassName: string;
}

// ---------------------------------------------------------------------------
// Score calculation
// ---------------------------------------------------------------------------

export interface ScoreDescriptor {
  /** categoryTypes.hasRelayRace */
  hasRelayRace: boolean;
  /** evaluationTypes.excludeRelayRace */
  excludeRelayRace: boolean;
}

/**
 * 1 second expressed in hundredths. Each error adds 1 second (= 100 hundredths) to the score.
 */
const HUNDREDTHS_PER_ERROR = 100;

/**
 * Computes the score for a single category entry in hundredths of a second.
 *
 * Formula:
 *   If hasRelayRace AND NOT excludeRelayRace:
 *     score = attackTimeHundredths + attackTimeErrors * HUNDREDTHS_PER_ERROR
 *           + relayRaceHundredths + relayRaceErrors * HUNDREDTHS_PER_ERROR
 *   Otherwise:
 *     score = attackTimeHundredths + attackTimeErrors * HUNDREDTHS_PER_ERROR
 *
 * Returns null when required fields are missing (i.e. the entry is not yet
 * scoreable — treat the same as OPEN).
 */
export function computeEntryScore(
  entry: Pick<CategoryEntry, 'attackTimeHundredths' | 'attackTimeErrors' | 'relayRaceHundredths' | 'relayRaceErrors'>,
  descriptor: ScoreDescriptor,
): number | null {
  const { attackTimeHundredths: att, attackTimeErrors: attErr } = entry;
  if (att == null || attErr == null) {
    return null;
  }

  const includeRelay = descriptor.hasRelayRace && !descriptor.excludeRelayRace;

  if (includeRelay) {
    const { relayRaceHundredths: rel, relayRaceErrors: relErr } = entry;
    if (rel == null || relErr == null) {
      return null;
    }
    return att + attErr * HUNDREDTHS_PER_ERROR + rel + relErr * HUNDREDTHS_PER_ERROR;
  }

  return att + attErr * HUNDREDTHS_PER_ERROR;
}

