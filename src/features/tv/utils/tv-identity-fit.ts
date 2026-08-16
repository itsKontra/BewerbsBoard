export function calculateFittedFontSize(
  preferredSize: number,
  availableWidth: number,
  requiredWidth: number,
  minimumSize: number,
) {
  if (requiredWidth <= availableWidth) return preferredSize;

  return Math.max(minimumSize, preferredSize * availableWidth / requiredWidth);
}
