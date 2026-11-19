import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";

import { WatchView } from "@/components/enigma/WatchView";
import { merchantOf } from "@/lib/enigma/logic";
import { currentDraw, useAppState } from "@/lib/enigma/store";
import { DEMO_WATCH, WATCH_STATES, parseWatchState, type WatchInfo } from "@/lib/enigma/watch";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  estado: fallback(z.string(), "aguardando").default("aguardando"),
});

export const Route = createFileRoute("/convite/previa")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Como o público vê — Enigma Premiado" },
      { name: "description", content: "Prévia da página de quem assiste ao sorteio." },
      { property: "og:title", content: "Como o público vê — Enigma Premiado" },
      { property: "og:description", content: "Prévia da página de quem assiste ao sorteio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PreviaPublico,
});

function PreviaPublico() {
  const { estado } = Route.useSearch();
  const navigate = useNavigate();
  const state = useAppState();
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const draw = currentDraw(state);
  const shop = merchantOf(state.merchants, draw);
  const watchState = parseWatchState(estado);
  const info: WatchInfo = {
    shopName: shop.name,
    prize: draw.prize,
    date: draw.date,
    winner: draw.result?.winner ?? `${DEMO_WATCH.winner} (exemplo)`,
    ...(state.groupLogo ? { groupLogo: state.groupLogo } : {}),
    ...(shop.logo ? { shopLogo: shop.logo } : {}),
  };

  return (
    <div className="px-4 pb-24 pt-3">
      <Link to="/" className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar à roleta
      </Link>
      <h1 className="text-2xl font-extrabold">Como o público vê</h1>
      <p className="text-sm text-muted-foreground">Toque para ensaiar cada momento.</p>

      <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-nav p-1" role="tablist">
        {WATCH_STATES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={watchState === s.id}
            onClick={() => navigate({ to: "/convite/previa", search: { estado: s.id }, replace: true })}
            className={cn(
              "min-h-12 rounded-xl px-1 text-xs font-bold leading-tight",
              watchState === s.id ? "bg-secondary text-gold" : "text-muted-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-3xl border-2 border-dashed border-border p-3" aria-label="Tela de quem assiste">
        <WatchView info={info} state={watchState} />
      </div>
    </div>
  );
}
