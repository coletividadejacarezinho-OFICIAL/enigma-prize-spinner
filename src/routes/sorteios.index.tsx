import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Trophy } from "lucide-react";

import { AppHeader } from "@/components/enigma/AppHeader";
import { GoldButton } from "@/components/enigma/GoldButton";
import { MerchantLogo } from "@/components/enigma/Logos";
import { formatDateBR } from "@/lib/enigma/logic";
import { setCurrent, useAppState } from "@/lib/enigma/store";

export const Route = createFileRoute("/sorteios/")({
  head: () => ({
    meta: [
      { title: "Sorteios — Enigma Premiado" },
      { name: "description", content: "Comece um novo sorteio e veja os sorteios já feitos." },
      { property: "og:title", content: "Sorteios — Enigma Premiado" },
      {
        property: "og:description",
        content: "Comece um novo sorteio e veja os sorteios já feitos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sorteios,
});

function Sorteios() {
  const state = useAppState();
  const navigate = useNavigate();
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const draws = [...state.draws].sort((a, b) => b.createdAt - a.createdAt);

  const open = (id: string) => {
    setCurrent(id);
    navigate({ to: "/" });
  };

  return (
    <div className="pb-24">
      <AppHeader logo={state.groupLogo} subtitle="Sorteios" />
      <div className="px-4">
        <GoldButton onClick={() => navigate({ to: "/sorteios/novo" })} className="mt-2">
          <Plus aria-hidden="true" /> Novo sorteio
        </GoldButton>

        <h2 className="mt-6 text-2xl font-extrabold">Sorteios criados</h2>
        <ul className="mt-2 space-y-2">
          {draws.map((d) => {
            const isCurrent = d.id === state.currentId;
            return (
              <li key={d.id}>
                <button
                  onClick={() => open(d.id)}
                  className={`flex w-full gap-3 rounded-2xl bg-card p-3 text-left active:bg-secondary ${isCurrent ? "ring-2 ring-gold" : ""}`}
                >
                  <MerchantLogo src={d.merchantLogo} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-bold text-muted-foreground">
                        {formatDateBR(d.date)}
                      </span>
                      {d.isSample && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                          Sorteio de teste
                        </span>
                      )}
                      {isCurrent && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                          Na roleta agora
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-bold">{d.merchant}</p>
                    <p className="text-sm text-muted-foreground">{d.prize}</p>
                    {d.result ? (
                      <p className="mt-1 flex items-center gap-1.5 font-bold text-gold">
                        <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">Ganhador(a): {d.result.winner}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ainda não girou · {d.names.length}{" "}
                        {d.names.length === 1 ? "nome" : "nomes"}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
