import { supabase } from "@/integrations/supabase/client";

export async function postHotspotAction(path: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
  return fetch(path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${data.session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function hotspotActionError(response: Response, fallback: string) {
  if (response.ok) return null;
  const message = await response.text().catch(() => "");
  if (response.status === 409) return message || "A RB está offline ou já tem uma operação pendente.";
  if (response.status === 403) return "Seu perfil não tem acesso a esta RB.";
  return message || fallback;
}
