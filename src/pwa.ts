/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

// O navegador só procura um service worker novo ao navegar. Um PWA instalado volta do segundo
// plano sem navegar, então a versão nova nunca chegava. Aqui a busca roda ao abrir o app e toda
// vez que ele volta a ficar visível. Com `autoUpdate`, a versão achada assume e recarrega sozinha.
export function registrarAtualizacaoAutomatica(): void {
  if (!('serviceWorker' in navigator)) return;

  registerSW({
    immediate: true,
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      const checar = () => {
        if (navigator.onLine) void registro.update().catch(() => {});
      };
      checar();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checar();
      });
    },
  });
}
