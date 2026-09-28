/** "DisplayName (username)", or just the name when both are identical/missing. */
export function formatPersonName(displayName: string | null | undefined, username: string | null | undefined): string {
  const d = (displayName || '').trim();
  const u = (username || '').trim();
  if (d && u && d.toLowerCase() !== u.toLowerCase()) return `${d} (${u})`;
  return d || u || 'Unknown';
}
