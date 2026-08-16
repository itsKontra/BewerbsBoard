/**
 * Parses a German decimal time string into hundredths of a second.
 * 
 * Rules:
 * - Must be a numeric string
 * - May use comma as a decimal separator
 * - Must be >= 0.01 and <= 999.99
 * - Rejects malformed or out of bound values
 */
export function parseGermanTimeToHundredths(timeStr: string): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;

  // Replace comma with dot for JS parsing
  const normalized = timeStr.trim().replace(',', '.');
  
  // Must be a valid number format, optionally with up to two decimal places
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const parsedValue = parseFloat(normalized);

  if (isNaN(parsedValue)) return null;

  // Bounds check
  if (parsedValue < 0.01 || parsedValue > 999.99) {
    return null;
  }

  // Convert to integer hundredths, rounding to handle floating point imprecision
  return Math.round(parsedValue * 100);
}

/**
 * Formats hundredths of a second into a German decimal string without unit (e.g. 4523 -> "45,23").
 */
export function formatHundredthsToGerman(hundredths: number | null | undefined): string {
  if (hundredths === null || hundredths === undefined || isNaN(hundredths)) return '';
  return (hundredths / 100).toFixed(2).replace('.', ',');
}

/**
 * Formats hundredths of a second into a competition display time string with unit (e.g. 4523 -> "45,23 s").
 */
export function formatHundredthsToDisplayTime(hundredths: number | null | undefined): string {
  if (hundredths === null || hundredths === undefined || isNaN(hundredths)) return '—';
  const seconds = (hundredths / 100).toFixed(2).replace('.', ',');
  return `${seconds} s`;
}

