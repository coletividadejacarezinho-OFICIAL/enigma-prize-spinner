import { CheckCircle2, Download, Share } from "lucide-react";
import { useState } from "react";

import { runInstallPrompt, useInstallView } from "@/lib/enigma/install";

/** "Instalar no celular" in Ajustes. Collapses when the app was opened from its icon. */
export function InstallCard() {
  const view = useInstallView();
  const [busy, setBusy] = useState(false);

  if (view === null) return <div className="h-40 rounded-2xl bg-card" aria-busy="true" />;

  if (view === "installed") {
    return (
      <section className="flex items-center gap-3 rounded-2xl bg-card p-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" />
        <p className="font-bold">App aberto pelo ícone da tela inicial</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-card p-4" aria-labelledby="instalar">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <h2 id="instalar" className="text-xl font-bold">
            Instalar no celular
          </h2>
          <p className="text-sm text-muted-foreground">
            Abra o Enigma Premiado pelo ícone na tela inicial
          </p>
        </div>
      </div>

      {view === "prompt" && (
        <button
          onClick={async () => {
            setBusy(true);
            try {
              await runInstallPrompt();
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary text-lg font-extrabold active:bg-accent disabled:opacity-50"
        >
          <Download className="h-5 w-5 text-gold" aria-hidden="true" /> Instalar
        </button>
      )}

      {view === "ios-safari" && (
        <ol className="mt-4 list-decimal space-y-1 pl-6 text-base">
          <li>
            Toque em <Share className="inline h-4 w-4 align-[-2px] text-gold" aria-label="Compartilhar" />{" "}
            <b>Compartilhar</b>, na barra do Safari.
          </li>
          <li>
            Escolha <b>“Adicionar à Tela de Início”</b>.
          </li>
          <li>
            Toque em <b>Adicionar</b>.
          </li>
        </ol>
      )}

      {view === "ios-other" && (
        <p className="mt-4 text-base">
          No iPhone, abra este app no <b>Safari</b>. Depois toque em <b>Compartilhar</b> e em{" "}
          <b>“Adicionar à Tela de Início”</b>.
        </p>
      )}

      {view === "menu" && (
        <p className="mt-4 text-base">
          Toque no menu <b>⋮</b> do navegador e escolha <b>“Instalar app”</b> ou{" "}
          <b>“Adicionar à tela inicial”</b>.
        </p>
      )}

      {view === "editor" && (
        <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
          Aqui na prévia do editor não dá para instalar. A instalação funciona quando o app é aberto
          direto no navegador do celular, num endereço https próprio — e este app ainda não foi
          publicado.
        </p>
      )}
    </section>
  );
}
