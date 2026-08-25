import { describe, it, expect } from 'vitest';
import {
  calculateEntryUpdate,
  validateEntryDeletion,
  EntryValidationError,
} from './entry-lifecycle.js';
import type { CategoryEntry } from './scoring.js';

const baseEntry: CategoryEntry = {
  id: 'entry-1',
  groupId: 'group-1',
  categoryTypeId: 'cat-type-1',
  runStatus: 'OPEN',
  startOrderPosition: 3,
  attackTimeHundredths: null,
  attackTimeErrors: null,
  relayRaceHundredths: null,
  relayRaceErrors: null,
};

describe('entry-lifecycle domain module', () => {
  describe('time and error parsing', () => {
    it('parses valid German decimal strings for attack time', () => {
      const result = calculateEntryUpdate(
        baseEntry,
        { attackTimeStr: '42,38', attackTimeErrors: 5 },
        { hasRelayRace: false }
      );
      expect(result.nextEntry.attackTimeHundredths).toBe(4238);
      expect(result.nextEntry.attackTimeErrors).toBe(5);
      expect(result.nextEntry.runStatus).toBe('VALID');
      expect(result.scoreHundredths).toBe(4238 + 5 * 100);
    });

    it('parses whole integer seconds string as attack time', () => {
      const result = calculateEntryUpdate(
        baseEntry,
        { attackTimeStr: '45', attackTimeErrors: 0 },
        { hasRelayRace: false }
      );
      expect(result.nextEntry.attackTimeHundredths).toBe(4500);
      expect(result.nextEntry.attackTimeErrors).toBe(0);
      expect(result.nextEntry.runStatus).toBe('VALID');
      expect(result.scoreHundredths).toBe(4500);
    });

    it('throws EntryValidationError on malformed attack time string', () => {
      expect(() =>
        calculateEntryUpdate(
          baseEntry,
          { attackTimeStr: 'invalid-time' },
          { hasRelayRace: false }
        )
      ).toThrow(EntryValidationError);
    });

    it('throws EntryValidationError on out-of-bounds attack time string', () => {
      expect(() =>
        calculateEntryUpdate(
          baseEntry,
          { attackTimeStr: '1005,50' },
          { hasRelayRace: false }
        )
      ).toThrow(EntryValidationError);
    });

    it('throws EntryValidationError on negative or decimal error counts', () => {
      expect(() =>
        calculateEntryUpdate(
          baseEntry,
          { attackTimeErrors: -1 },
          { hasRelayRace: false }
        )
      ).toThrow(EntryValidationError);

      expect(() =>
        calculateEntryUpdate(
          baseEntry,
          { attackTimeErrors: 2.5 },
          { hasRelayRace: false }
        )
      ).toThrow(EntryValidationError);
    });
  });

  describe('auto-promotion invariants', () => {
    it('auto-promotes OPEN -> VALID when attack is complete and category has no relay race', () => {
      const result = calculateEntryUpdate(
        baseEntry,
        { attackTimeHundredths: 5000, attackTimeErrors: 10 },
        { hasRelayRace: false }
      );
      expect(result.nextEntry.runStatus).toBe('VALID');
      expect(result.nextEntry.startOrderPosition).toBeNull();
      expect(result.requiresCompaction).toBe(true);
      expect(result.scoreHundredths).toBe(6000);
    });

    it('stays OPEN when category has relay race but relay fields are missing', () => {
      const result = calculateEntryUpdate(
        baseEntry,
        { attackTimeHundredths: 5000, attackTimeErrors: 10 },
        { hasRelayRace: true }
      );
      expect(result.nextEntry.runStatus).toBe('OPEN');
      expect(result.nextEntry.startOrderPosition).toBe(3);
      expect(result.requiresCompaction).toBe(false);
      expect(result.scoreHundredths).toBeNull();
    });

    it('auto-promotes OPEN -> VALID when category has relay race and both attack and relay are complete', () => {
      const result = calculateEntryUpdate(
        baseEntry,
        {
          attackTimeHundredths: 5000,
          attackTimeErrors: 0,
          relayRaceHundredths: 6000,
          relayRaceErrors: 5,
        },
        { hasRelayRace: true }
      );
      expect(result.nextEntry.runStatus).toBe('VALID');
      expect(result.nextEntry.startOrderPosition).toBeNull();
      expect(result.requiresCompaction).toBe(true);
      expect(result.scoreHundredths).toBe(5000 + 6000 + 500); // 11500
    });

    it('respects explicit runStatus override (e.g. DNF)', () => {
      const result = calculateEntryUpdate(
        baseEntry,
        {
          runStatus: 'DNF',
          attackTimeHundredths: 5000,
          attackTimeErrors: 0,
        },
        { hasRelayRace: false }
      );
      expect(result.nextEntry.runStatus).toBe('DNF');
      expect(result.nextEntry.startOrderPosition).toBeNull();
      expect(result.requiresCompaction).toBe(true);
      expect(result.scoreHundredths).toBeNull();
    });

    it('assigns next open position when transitioning from non-OPEN back to OPEN', () => {
      const dnfEntry: CategoryEntry = {
        ...baseEntry,
        runStatus: 'DNF',
        startOrderPosition: null,
      };

      const result = calculateEntryUpdate(
        dnfEntry,
        { runStatus: 'OPEN' },
        {
          hasRelayRace: false,
          getNextOpenPosition: () => 7,
        }
      );

      expect(result.nextEntry.runStatus).toBe('OPEN');
      expect(result.nextEntry.startOrderPosition).toBe(7);
      expect(result.requiresCompaction).toBe(false);
    });
  });

  describe('entry deletion validation', () => {
    it('allows deleting OPEN entries and flags compaction', () => {
      const result = validateEntryDeletion(baseEntry, {
        groupName: 'Group 1',
        categoryName: 'Bronze',
      });
      expect(result.canDelete).toBe(true);
      expect(result.requiresCompaction).toBe(true);
      expect(result.auditPayload.operation).toBe('DELETE_CATEGORY_ENTRY');
      expect(result.auditPayload.previous_value.entryId).toBe('entry-1');
    });

    it('prevents deleting non-OPEN entries', () => {
      const validEntry: CategoryEntry = {
        ...baseEntry,
        runStatus: 'VALID',
      };
      const result = validateEntryDeletion(validEntry);
      expect(result.canDelete).toBe(false);
      expect(result.errorMessage).toBe('Only OPEN entries can be removed');
      expect(result.requiresCompaction).toBe(false);
    });
  });
});
