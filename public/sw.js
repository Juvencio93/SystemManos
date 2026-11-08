// Service worker do ManosTech System: Web Push do bate-papo.
//
// O push chega mesmo com o navegador fechado ou em segundo plano (é o que
// faz a chamada de atenção e as mensagens funcionarem no celular). Se já
// houver uma aba visível do sistema, a notificação é dispensada: o som e
// o tremor dentro do app já avisam.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "ManosTech";
  const body = data.body || "Nova mensagem no bate-papo.";
  const url = data.url || "/mensagens";
  const tag = data.tag || "manostech-chat";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const visible = clients.some(
        (client) => client.visibilityState === "visible",
      );
      // Aba aberta e visível: não empilha notificação, o app já avisa.
      if (visible) return;

      await self.registration.showNotification(title, {
        body,
        tag,
        data: { url },
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/mensagens";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
