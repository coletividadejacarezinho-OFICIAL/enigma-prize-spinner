import { createFileRoute } from "@tanstack/react-router";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";

import { WatchView } from "@/components/enigma/WatchView";
import { DEMO_WATCH, parseWatchState } from "@/lib/enigma/watch";

const searchSchema = z.object({
  estado: fallback(z.string(), "aguardando").default("aguardando"),
});

export const Route = createFileRoute("/assistir/demo")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Assistir ao sorteio (demonstração) — Enigma Premiado" },
      {
        name: "description",
        content: "Demonstração da página de quem assiste ao sorteio do Enigma Premiado.",
      },
      { property: "og:title", content: "Assistir ao sorteio (demonstração) — Enigma Premiado" },
      {
        property: "og:description",
        content: "Demonstração da página de quem assiste ao sorteio do Enigma Premiado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssistirDemo,
});

// Uses its own fictitious data, never the presenter's saved draws.
function AssistirDemo() {
  const { estado } = Route.useSearch();
  return (
    <div className="px-4 pb-8 pt-4">
      <WatchView info={DEMO_WATCH} state={parseWatchState(estado)} />
    </div>
  );
}
