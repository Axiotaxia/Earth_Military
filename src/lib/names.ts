/**
 * "DisplayName (@username)" — always shows both when both exist, so the
 * exact @username is visible even when it looks similar to the display name.
 * Falls back to whichever one is available if only one exists.
 */
export function formatPersonName(displayName: string | null | undefined, username: string | null | undefined): string {
  const d = (displayName || '').trim();
  const u = (username || '').trim();
  if (d && u) return `${d} (@${u})`;
  if (u) return `@${u}`;
  return d || 'Unknown';
}
