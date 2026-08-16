import { describe, expect, it } from 'vitest';
import { calculateFittedFontSize } from './tv-identity-fit';

describe('calculateFittedFontSize', () => {
  it.each([
    { case: 'preferred size', preferred: 64, available: 480, required: 420, minimum: 18, expected: 64 },
    { case: 'exact fit', preferred: 64, available: 480, required: 480, minimum: 18, expected: 64 },
    { case: 'proportional shrink', preferred: 64, available: 360, required: 720, minimum: 18, expected: 32 },
    { case: 'minimum size', preferred: 64, available: 180, required: 900, minimum: 18, expected: 18 },
  ])('returns the $case', ({ preferred, available, required, minimum, expected }) => {
    expect(calculateFittedFontSize(preferred, available, required, minimum)).toBe(expected);
  });
});
