export function conciseDestination(payload: string): string {
  try {
    const fallbackOrigin =
      typeof globalThis !== 'undefined' && (globalThis as { location?: { origin?: string } }).location?.origin
        ? (globalThis as { location?: { origin?: string } }).location!.origin!
        : 'https://bewerb.feuerwehr.at';
    const url = new URL(payload, fallbackOrigin);
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    const destination = `${url.host}${path}`;
    if (destination.length <= 42) return destination;
    return `${destination.slice(0, 24)}…${destination.slice(-15)}`;
  } catch {
    if (payload.length <= 42) return payload;
    return `${payload.slice(0, 24)}…${payload.slice(-15)}`;
  }
}
