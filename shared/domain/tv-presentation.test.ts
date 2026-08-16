import { describe, expect, it } from 'vitest';
import {
  parseThemeParam,
  normalizeTvPresentation,
  normalizeQrCodeEnabled,
  normalizeQrCodeAlwaysVisible,
  normalizeQrCodeIntervalSeconds,
  normalizeQrCodeDurationSeconds,
} from './tv-presentation';
import { getDemoTvState } from '../../src/mock/demo-scoreboard-data';

describe('parseThemeParam', () => {
  it('parses numeric theme parameters correctly', () => {
    expect(parseThemeParam('1')).toBe('broadcast');
    expect(parseThemeParam('2')).toBe('ceremony');
    expect(parseThemeParam('3')).toBe('outdoor');
    expect(parseThemeParam('0')).toBe('broadcast');
  });

  it('parses string theme parameters case-insensitively', () => {
    expect(parseThemeParam('broadcast')).toBe('broadcast');
    expect(parseThemeParam('Ceremony')).toBe('ceremony');
    expect(parseThemeParam('OUTDOOR')).toBe('outdoor');
  });

  it('returns null for invalid theme parameters', () => {
    expect(parseThemeParam('4')).toBeNull();
    expect(parseThemeParam('invalid')).toBeNull();
    expect(parseThemeParam('')).toBeNull();
    expect(parseThemeParam(null)).toBeNull();
    expect(parseThemeParam(undefined)).toBeNull();
  });
});

describe('getDemoTvState', () => {
  it('returns default demo state theme when no theme param is specified', () => {
    const state = getDemoTvState('?demo=true');
    expect(state.tvPresentation.theme).toBe('broadcast');
  });

  it('overrides theme when ?theme=2 is provided', () => {
    const state = getDemoTvState('?demo=true&theme=2');
    expect(state.tvPresentation.theme).toBe('ceremony');
  });

  it('overrides theme when ?theme=outdoor is provided', () => {
    const state = getDemoTvState('?demo=true&theme=outdoor');
    expect(state.tvPresentation.theme).toBe('outdoor');
  });
});

describe('QR code presentation normalization', () => {
  it('normalizes valid QR configuration inputs', () => {
    const normalized = normalizeTvPresentation({
      theme: 'ceremony',
      logoOverride: '',
      headerLabel: 'Test',
      qrCodeEnabled: false,
      qrCodeAlwaysVisible: true,
      qrCodeIntervalSeconds: 45,
      qrCodeDurationSeconds: 15,
    });
    expect(normalized.qrCodeEnabled).toBe(false);
    expect(normalized.qrCodeAlwaysVisible).toBe(true);
    expect(normalized.qrCodeIntervalSeconds).toBe(45);
    expect(normalized.qrCodeDurationSeconds).toBe(15);
  });

  it('falls back to defaults for missing or invalid QR values', () => {
    const normalized = normalizeTvPresentation({});
    expect(normalized.qrCodeEnabled).toBe(true);
    expect(normalized.qrCodeAlwaysVisible).toBe(false);
    expect(normalized.qrCodeIntervalSeconds).toBe(30);
    expect(normalized.qrCodeDurationSeconds).toBe(10);

    const outOfBounds = normalizeTvPresentation({
      qrCodeIntervalSeconds: 2, // below min (5)
      qrCodeDurationSeconds: 400, // above max (300)
    });
    expect(outOfBounds.qrCodeIntervalSeconds).toBe(30);
    expect(outOfBounds.qrCodeDurationSeconds).toBe(10);
  });

  it('parses string values for boolean and numbers', () => {
    expect(normalizeQrCodeEnabled('false')).toBe(false);
    expect(normalizeQrCodeEnabled('true')).toBe(true);
    expect(normalizeQrCodeAlwaysVisible('false')).toBe(false);
    expect(normalizeQrCodeAlwaysVisible('true')).toBe(true);
    expect(normalizeQrCodeIntervalSeconds('60')).toBe(60);
    expect(normalizeQrCodeDurationSeconds('20')).toBe(20);
  });

  it('normalizes admin splash setting with default true', () => {
    expect(normalizeTvPresentation({}).adminSplashEnabled).toBe(true);
    expect(normalizeTvPresentation({ adminSplashEnabled: false }).adminSplashEnabled).toBe(false);
    expect(normalizeTvPresentation({ adminSplashEnabled: 'false' }).adminSplashEnabled).toBe(false);
    expect(normalizeTvPresentation({ adminSplashEnabled: 'true' }).adminSplashEnabled).toBe(true);
    expect(normalizeTvPresentation({ adminSplashEnabled: true }).adminSplashEnabled).toBe(true);
  });
});
