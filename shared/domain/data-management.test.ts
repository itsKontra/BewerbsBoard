import { describe, it, expect } from 'vitest';
import {
  validateDataExportEnvelope,
  type DataExportEnvelope,
} from './data-management';

describe('data-management envelope validation', () => {
  it('validates a correct envelope successfully', () => {
    const valid: DataExportEnvelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
      data: {
        appConfig: [{ key: 'event:name', valueJson: '"Test"', updatedAt: 12345 }],
        competitionClasses: [{ id: 'cc-1', name: 'AKTIV' }],
        fireBrigades: [{ id: 'fb-1', name: 'FF Muster' }],
        categoryTypes: [{ id: 'ct-1', name: 'Bronze', competitionClassId: 'cc-1', hasRelayRace: true }],
        evaluationTypes: [{
          id: 'et-1',
          name: 'Gesamt',
          categoryTypeId1: 'ct-1',
          categoryTypeId2: null,
          excludeRelayRace: false,
          isBrigadePairing: false,
          public: true,
          publicTv: true,
          displayDurationSeconds: 10,
          order: 1,
        }],
        groups: [{ id: 'g-1', fireBrigadeId: 'fb-1', competitionClassId: 'cc-1', name: 'Gruppe 1' }],
        categoryEntries: [{
          id: 'ce-1',
          groupId: 'g-1',
          categoryTypeId: 'ct-1',
          runStatus: 'VALID',
          startOrderPosition: 1,
          attackTimeHundredths: 4000,
          attackTimeErrors: 0,
          relayRaceHundredths: 5000,
          relayRaceErrors: 0,
        }],
      },
    };

    const result = validateDataExportEnvelope(valid);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.envelope).toBeDefined();
    expect(result.envelope?.version).toBe(1);
    expect(result.envelope?.data.fireBrigades).toHaveLength(1);
  });

  it('rejects unsupported versions or missing envelope fields', () => {
    expect(validateDataExportEnvelope(null).isValid).toBe(false);
    expect(validateDataExportEnvelope('string').isValid).toBe(false);
    expect(validateDataExportEnvelope({ version: 2, exportedAt: '2026-01-01', data: {} }).isValid).toBe(false);
    expect(validateDataExportEnvelope({ version: 1, exportedAt: 'invalid-date', data: {} }).isValid).toBe(false);
  });

  it('rejects invalid item structures in data tables', () => {
    const invalidData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        fireBrigades: [{ id: 123, name: 'Invalid' }], // id must be string
      },
    };

    const result = validateDataExportEnvelope(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('fireBrigades[0]');
  });
});
