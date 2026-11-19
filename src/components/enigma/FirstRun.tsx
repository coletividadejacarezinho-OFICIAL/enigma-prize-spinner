import { useNavigate } from "@tanstack/react-router";
import { FlaskConical, Plus } from "lucide-react";
import { useState } from "react";

import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { report } from "@/lib/enigma/feedback";
import { repo } from "@/lib/enigma/repo";

/** First open, no draws yet: create the first real draw, or a rehearsal kept out of the history. */
export function FirstRun() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const rehearse = async () => {
    setBusy(true);
    const r = await repo.startRehearsal();
    setBusy(false);
    if (report(r, rehearse)) navigate({ to: "/" });
  };

  return (
    <main className="flex min-h-[calc(100dvh-5rem)] flex-col justify-center px-5 py-8">
      <img src="/icon-192.png" alt="" className="mx-auto h-20 w-20 rounded-2xl" />
      <h1 className="mt-4 text-center text-3xl font-extrabold">Bem-vinda ao Enigma Premiado</h1>
      <p className="mt-2 text-center text-base text-muted-foreground">
        Prepare uma rodada em Sorteios para começar.
      </p>
      <div className="mt-6 space-y-3">
        <GoldButton onClick={() => navigate({ to: "/sorteios/novo" })}>
          <Plus aria-hidden="true" /> Criar meu primeiro sorteio
        </GoldButton>
        <SecondaryButton onClick={rehearse} disabled={busy}>
          <FlaskConical aria-hidden="true" /> Fazer um ensaio
        </SecondaryButton>
        <p className="text-center text-sm text-muted-foreground">
          O ensaio usa nomes de exemplo e fica fora do histórico oficial e do Listão.
        </p>
      </div>
    </main>
  );
}

/** While the saved data is being opened: nothing that depends on it can be tapped. */
export function Opening() {
  return (
    <main className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <p className="text-lg font-bold text-muted-foreground">Abrindo o Enigma Premiado…</p>
    </main>
  );
}
