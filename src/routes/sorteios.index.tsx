import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ChevronRight, Megaphone, Pencil, Plus, Trophy, Video } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { AppHeader } from "@/components/enigma/AppHeader";
import { GoldButton } from "@/components/enigma/GoldButton";
import { ListaoShareDialog } from "@/components/enigma/ListaoShare";
import { MerchantLogo } from "@/components/enigma/Logos";
import {
  buildListao,
  formatDateBR,
  formatDuration,
  merchantOf,
  todayISO,
} from "@/lib/enigma/logic";
import { setCurrent, useAppState } from "@/lib/enigma/store";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  aba: fallback(z.string(), "sorteios").default("sorteios"),
});

export const Route = createFileRoute("/sorteios/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Sorteios — Enigma Premiado" },
      {
        name: "description",
        content: "Sorteios, comércios parceiros e o Listão da Alegria do Enigma Premiado.",
      },
      { property: "og:title", content: "Sorteios — Enigma Premiado" },
      {
        property: "og:description",
        content: "Sorteios, comércios parceiros e o Listão da Alegria do Enigma Premiado.",
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
  const { aba } = Route.useSearch();
  const [shareOpen, setShareOpen] = useState(false);
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const tab = aba === "comercios" ? "comercios" : "sorteios";
  const today = todayISO();
  const listao = buildListao(state, today);
  const count = listao.active.length;

  return (
    <div className="pb-24">
      <AppHeader logo={state.groupLogo} subtitle="Sorteios" />
      <div className="px-4">
        <section className="rounded-3xl border-2 border-gold/70 bg-card p-4">
          <Link to="/sorteios/listao" className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl font-extrabold leading-tight">
                🎉 Listão da Alegria
              </p>
              <p className="text-base text-muted-foreground">
                <span className="font-bold text-gold">{count}</span>{" "}
                {count === 1 ? "comércio" : "comércios"} em divulgação
              </p>
            </div>
            <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
          <button
            onClick={() => setShareOpen(true)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-bold active:bg-accent"
          >
            <Megaphone className="h-5 w-5" aria-hidden="true" /> Divulgar no grupo
          </button>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-nav p-1" role="tablist">
          {[
            { id: "sorteios", label: "Sorteios" },
            { id: "comercios", label: "Comércios parceiros" },
          ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => navigate({ to: "/sorteios", search: { aba: t.id }, replace: true })}
              className={cn(
                "h-12 rounded-xl px-2 text-sm font-bold leading-tight",
                tab === t.id ? "bg-secondary text-gold" : "text-muted-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sorteios" ? (
          <div role="tabpanel">
            <GoldButton onClick={() => navigate({ to: "/sorteios/novo" })} className="mt-4">
              <Plus aria-hidden="true" /> Novo sorteio
            </GoldButton>
            <ul className="mt-4 space-y-2">
              {[...state.draws]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((d) => {
                  const isCurrent = d.id === state.currentId;
                  const m = merchantOf(state.merchants, d);
                  return (
                    <li
                      key={d.id}
                      className={cn("rounded-2xl bg-card", isCurrent && "ring-2 ring-gold")}
                    >
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setCurrent(d.id);
                            navigate({ to: "/" });
                          }}
                          className="flex min-w-0 flex-1 gap-3 rounded-2xl p-3 text-left active:bg-secondary"
                        >
                          <MerchantLogo src={m.logo} className="h-12 w-12" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-bold text-muted-foreground">
                                {formatDateBR(d.date)}
                              </span>
                              {d.isSample ? (
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                                  Sorteio de teste
                                </span>
                              ) : d.confirmed ? null : (
                                <span className="rounded-full border border-gold/70 px-2 py-0.5 text-xs font-semibold text-gold">
                                  Rascunho · aguardando confirmação
                                </span>
                              )}
                              {isCurrent && (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                                  Na roleta agora
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 font-bold">{m.name}</p>
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
                        {!d.isSample && (
                          <Link
                            to="/sorteios/editar/$drawId"
                            params={{ drawId: d.id }}
                            aria-label={`Editar sorteio de ${m.name}`}
                            className="flex w-12 shrink-0 items-center justify-center rounded-2xl text-muted-foreground active:bg-secondary"
                          >
                            <Pencil className="h-5 w-5" aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                      {d.recordings && d.recordings.length > 0 && (
                        <div className="border-t border-border px-3 pb-3 pt-2">
                          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                            Gravações
                          </p>
                          <ul className="space-y-1">
                            {[...d.recordings].reverse().map((r) => (
                              <li key={r.id}>
                                <Link
                                  to="/sorteios/gravacoes/$drawId/$recordingId"
                                  params={{ drawId: d.id, recordingId: r.id }}
                                  className="flex min-h-11 items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 active:bg-secondary"
                                >
                                  <Video
                                    className="h-4 w-4 shrink-0 text-gold"
                                    aria-hidden="true"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                    {r.winner
                                      ? `Ganhador(a): ${r.winner}`
                                      : "Sem sorteio realizado"}
                                  </span>
                                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                    {formatDuration(r.durationMs)}
                                  </span>
                                  <span className="shrink-0 rounded-full border border-gold/70 px-1.5 py-0.5 text-[10px] font-bold text-gold">
                                    Simulação
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : (
          <div role="tabpanel">
            <GoldButton
              onClick={() => navigate({ to: "/sorteios/comercios/novo" })}
              className="mt-4"
            >
              <Plus aria-hidden="true" /> Cadastrar comércio
            </GoldButton>
            {state.merchants.length === 0 ? (
              <p className="mt-4 rounded-2xl border-2 border-dashed border-border p-5 text-center text-muted-foreground">
                Nenhum comércio cadastrado ainda.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {[...state.merchants]
                  .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                  .map((m) => {
                    const active = listao.active.find((e) => e.merchant.id === m.id);
                    return (
                      <li key={m.id}>
                        <Link
                          to="/sorteios/comercios/$merchantId"
                          params={{ merchantId: m.id }}
                          className="flex items-center gap-3 rounded-2xl bg-card p-3 active:bg-secondary"
                        >
                          <MerchantLogo src={m.logo} className="h-12 w-12" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-lg font-bold">{m.name}</p>
                            {active && (
                              <p className="text-sm text-gold">
                                No Listão até {formatDateBR(active.until)}
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            className="h-5 w-5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        )}
      </div>
      <ListaoShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        today={today}
        entries={listao.active}
      />
    </div>
  );
}
