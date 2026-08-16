import { describe, it, expect } from 'vitest';
import { parseGermanTimeToHundredths, formatHundredthsToDisplayTime } from './time-parser';

describe('parseGermanTimeToHundredths', () => {
  it('parses whole numbers correctly', () => {
    expect(parseGermanTimeToHundredths('42')).toBe(4200);
  });

  it('parses decimals with comma correctly', () => {
    expect(parseGermanTimeToHundredths('42,3')).toBe(4230);
    expect(parseGermanTimeToHundredths('42,38')).toBe(4238);
  });

  it('parses decimals with dot correctly (fallback)', () => {
    expect(parseGermanTimeToHundredths('42.3')).toBe(4230);
    expect(parseGermanTimeToHundredths('42.38')).toBe(4238);
  });

  it('rejects values with too many decimal places', () => {
    expect(parseGermanTimeToHundredths('42,381')).toBeNull();
  });

  it('rejects non-numeric strings', () => {
    expect(parseGermanTimeToHundredths('abc')).toBeNull();
    expect(parseGermanTimeToHundredths('42,3a')).toBeNull();
  });

  it('rejects out of bounds values', () => {
    expect(parseGermanTimeToHundredths('0')).toBeNull();
    expect(parseGermanTimeToHundredths('0,00')).toBeNull();
    expect(parseGermanTimeToHundredths('1000')).toBeNull();
    expect(parseGermanTimeToHundredths('-5,5')).toBeNull();
  });

  it('accepts valid boundary values', () => {
    expect(parseGermanTimeToHundredths('0,01')).toBe(1);
    expect(parseGermanTimeToHundredths('999,99')).toBe(99999);
  });

  it('trims whitespace', () => {
    expect(parseGermanTimeToHundredths('  42,38  ')).toBe(4238);
  });
});

describe('formatHundredthsToDisplayTime', () => {
  it('formats hundredths to competition display time string', () => {
    expect(formatHundredthsToDisplayTime(4238)).toBe('42,38 s');
    expect(formatHundredthsToDisplayTime(4200)).toBe('42,00 s');
    expect(formatHundredthsToDisplayTime(5)).toBe('0,05 s');
  });

  it('handles null or undefined or NaN', () => {
    expect(formatHundredthsToDisplayTime(null)).toBe('—');
    expect(formatHundredthsToDisplayTime(undefined)).toBe('—');
    expect(formatHundredthsToDisplayTime(NaN)).toBe('—');
  });
});


