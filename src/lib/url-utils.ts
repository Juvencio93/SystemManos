export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
}

export function isSocialUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("instagram.com") || lower.includes("facebook.com") || lower.includes("fb.com")
  );
}
