import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Without internet the draw keeps working on this phone; only WhatsApp and links need a connection. */
export function OfflineNotice() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  if (!offline) return null;
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-40 mx-auto flex max-w-md items-center gap-2 bg-secondary px-4 py-2 text-sm font-semibold"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
      Sem internet: o sorteio continua funcionando neste celular. Enviar pelo WhatsApp precisa de
      conexão.
    </p>
  );
}
