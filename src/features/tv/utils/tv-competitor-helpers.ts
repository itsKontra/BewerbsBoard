function resultGroupLabel(result: {
  groupName?: string | null;
}): string {
  return typeof result.groupName === 'string' ? result.groupName.trim() : '';
}

export function participantLabel(result: {
  fireBrigadeName?: string | null;
  groupName?: string | null;
}): string {
  const brigade = typeof result.fireBrigadeName === 'string' ? result.fireBrigadeName.trim() : '';
  const group = resultGroupLabel(result);

  return [brigade, group]
    .filter((value): value is string => value.length > 0)
    .join(' ');
}

export function parseRunPenalty(
  errors?: number | null,
  rawTimeHundredths?: number | null,
  scoreHundredths?: number | null,
): number {
  if (typeof errors === 'number' && errors > 0) {
    return errors;
  }
  if (
    typeof scoreHundredths === 'number' &&
    typeof rawTimeHundredths === 'number' &&
    scoreHundredths > rawTimeHundredths
  ) {
    return Math.round((scoreHundredths - rawTimeHundredths) / 100);
  }
  return 0;
}
