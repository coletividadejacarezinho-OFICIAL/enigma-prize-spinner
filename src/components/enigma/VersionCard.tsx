import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { checkForUpdate, runningVersion, shortVersion, type UpdateCheck } from "@/lib/enigma/app-version";

/** "Versão do aplicativo" in Ajustes: shows the code on this phone and looks for a newer one. */
export function VersionCard() {
  const [version, setVersion] = useState<string | null>(null);
  const [check, setCheck] = useState<UpdateCheck | "checking" | null>(null);
  useEffect(() => setVersion(shortVersion(runningVersion())), []);

  const look = async () => {
    setCheck("checking");
    const r = await checkForUpdate();
    setVersion(shortVersion(runningVersion()));
    setCheck(r);
  };

  return (
    <section className="rounded-2xl bg-card p-4" aria-labelledby="versao">
      <h2 id="versao" className="text-xl font-bold">
        Versão do aplicativo
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Neste aparelho: <b className="font-mono text-foreground">{version ?? "—"}</b>
      </p>
      {check === "new" ? (
        <button
          onClick={() => window.location.reload()}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-lg font-extrabold text-primary-foreground"
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" /> Atualizar agora
        </button>
      ) : (
        <button
          onClick={() => void look()}
          disabled={check === "checking"}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary text-lg font-extrabold active:bg-accent disabled:opacity-50"
        >
          {check === "checking" ? (
            <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-5 w-5 text-gold" aria-hidden="true" />
          )}
          Procurar atualização
        </button>
      )}
      <p className="mt-2 min-h-5 text-center text-sm text-muted-foreground" role="status">
        {check === "new"
          ? "Tem uma versão nova. Toque em Atualizar agora."
          : check === "same"
            ? "Este aparelho já está com a versão mais nova."
            : check === "unknown"
              ? "Não deu para conferir agora. Confira a internet e tente de novo."
              : ""}
      </p>
    </section>
  );
}
