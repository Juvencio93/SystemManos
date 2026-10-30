// Storage adapter para Supabase Auth.
//
// Produção (padrão): a sessão NÃO é persistida em storage legível por JS.
// Os tokens vivem em cookie httpOnly (gravado pelo servidor — ver
// ./server.ts) e, no navegador, apenas em MEMÓRIA (vida da aba). Isso
// fecha a superfície de roubo de sessão via XSS que existia com o
// localStorage.
//
// Fallback de preview: em ambientes onde cookies httpOnly não funcionam
// (ex.: preview embutido em iframe cross-site que bloqueia cookies),
// defina VITE_AUTH_LOCALSTORAGE_FALLBACK=1 para voltar ao comportamento
// antigo (localStorage + Authorization: Bearer). SOMENTE para preview —
// nunca em produção.

export function isPreviewAuthFallback(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return import.meta.env["VITE_AUTH_LOCALSTORAGE_FALLBACK"] === "1";
  } catch {
    return false;
  }
}

// Storage em memória: satisfaz a interface que o supabase-js espera, mas
// não persiste nada além da vida da aba. Com persistSession: true, o
// client mantém getSession()/setSession()/onAuthStateChange funcionando
// normalmente — só sem tocar disco ou cookie legível por JS.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

let _memory: Storage | undefined;

export function brokeredPreviewStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  if (isPreviewAuthFallback()) return localStorage;
  if (!_memory) _memory = memoryStorage();
  return _memory;
}
