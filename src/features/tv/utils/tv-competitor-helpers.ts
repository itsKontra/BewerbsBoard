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
