// Storage adapter para Supabase Auth.
// Em producao na Vercel, usa localStorage diretamente (sem broker Lovable).

export function brokeredPreviewStorage() {
  if (typeof window === 'undefined') return undefined;
  return localStorage;
}
