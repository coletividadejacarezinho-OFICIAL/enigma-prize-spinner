import { Download, RotateCcw, TriangleAlert } from "lucide-react";

import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { repo } from "@/lib/enigma/repo";

/** Shown instead of the app when saved data exists but cannot be read. The data is never touched here. */
export function DataRecovery({ raw }: { raw: string | null }) {
  const download = () => {
    const text = repo.rawCopy() ?? raw;
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `enigma-premiado-copia-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-8">
      <TriangleAlert className="mx-auto h-14 w-14 text-gold" aria-hidden="true" />
      <h1 className="mt-4 text-center text-3xl font-extrabold">Não deu para abrir os sorteios</h1>
      <p className="mt-3 text-center text-base text-muted-foreground">
        Os dados guardados neste celular não puderam ser lidos. Nada foi apagado: eles continuam
        guardados do jeito que estavam.
      </p>
      <div className="mt-6 space-y-3">
        <GoldButton onClick={() => repo.reload()}>
          <RotateCcw aria-hidden="true" /> Tentar novamente
        </GoldButton>
        {raw ? (
          <SecondaryButton onClick={download}>
            <Download aria-hidden="true" /> Baixar cópia dos dados
          </SecondaryButton>
        ) : (
          <p className="rounded-xl bg-card p-3 text-center text-sm text-muted-foreground">
            O navegador não deixou ler os dados. Feche o app, abra de novo e toque em “Tentar
            novamente”.
          </p>
        )}
      </div>
    </main>
  );
}
