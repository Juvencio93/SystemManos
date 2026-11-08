import { useEffect, useRef } from "react";
import { savePushSubscription } from "@/lib/push.functions";

// Assinatura de Web Push do bate-papo.
//
// Registra o service worker (/sw.js) e, com a permissão de notificação já
// concedida, assina o push com a chave pública VAPID e salva a assinatura
// no servidor. Não pede permissão por conta própria: o app já pede no
// primeiro gesto (use-chat-presence). Se a permissão ainda não foi dada,
// tenta de novo quando a aba volta a ficar visível.
//
// Idempotente: se já existe assinatura, só garante que ela está salva.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64Safe);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function usePushSubscription(userId: string | null | undefined) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const attempt = async () => {
      try {
        const registration =
          await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await savePushSubscription({
            data: { subscription: existing.toJSON() as any },
          });
          return;
        }
        if (Notification.permission !== "granted") return;
        const publicKey = import.meta.env[
          "VITE_VAPID_PUBLIC_KEY"
        ] as string | undefined;
        if (!publicKey) return;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await savePushSubscription({
          data: { subscription: subscription.toJSON() as any },
        });
      } catch (err) {
        console.warn("[push] Não foi possível assinar notificações.", err);
      }
    };

    if (!startedRef.current) {
      startedRef.current = true;
      void attempt();
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void attempt();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);
}
