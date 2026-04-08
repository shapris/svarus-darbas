export function isLikelyNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const text = msg.toLowerCase();
  return (
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('fetch') ||
    text.includes('timeout') ||
    text.includes('timed out') ||
    text.includes('503') ||
    text.includes('502') ||
    text.includes('504') ||
    text.includes('cors')
  );
}

export function formatNetworkErrorForUser(error: unknown, fallback: string): string {
  if (isLikelyNetworkError(error)) {
    return `${fallback} Patikrinkite interneto ryšį ir bandykite dar kartą.`;
  }
  if (error instanceof Error && error.message.trim()) {
    return `${fallback} ${error.message.trim()}`;
  }
  return fallback;
}
