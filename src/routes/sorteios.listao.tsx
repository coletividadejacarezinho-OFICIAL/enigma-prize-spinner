import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ChevronLeft, Megaphone } from "lucide-react";
import { useState } from "react";

import { GoldButton } from "@/components/enigma/GoldButton";
import { ListaoShareDialog } from "@/components/enigma/ListaoShare";
import { MerchantLogo } from "@/components/enigma/Logos";
import { buildListao, formatDateBR, todayISO } from "@/lib/enigma/logic";
import { useAppState } from "@/lib/enigma/repo";
import { LISTAO_DAYS } from "@/lib/enigma/types";

export const Route = createFileRoute("/sorteios/listao")({
  head: () => ({
    meta: [
      { title: "Listão da Alegria — Enigma Premiado" },
      { name: "description", content: "Comércios parceiros em divulgação no Listão da Alegria." },
      { property: "og:title", content: "Listão da Alegria — Enigma Premiado" },
      {
        property: "og:description",
        content: "Comércios parceiros em divulgação no Listão da Alegria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Listao,
});

function Listao() {
  const state = useAppState();
  const [shareOpen, setShareOpen] = useState(false);
  if (!state) return <div className="h-dvh" aria-busy="true" />;
  const today = todayISO();
  const { active, scheduled } = buildListao(state, today);

  return (
    <div className="px-4 pb-24 pt-3">
      <Link
        to="/sorteios"
        className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      <h1 className="text-3xl font-extrabold">🎉 Listão da Alegria</h1>
      <p className="text-sm text-muted-foreground">
        {active.length} {active.length === 1 ? "comércio" : "comércios"} em divulgação hoje,{" "}
        {formatDateBR(today)}
      </p>

      <GoldButton className="mt-4" onClick={() => setShareOpen(true)}>
        <Megaphone aria-hidden="true" /> Divulgar no grupo
      </GoldButton>

      {active.length === 0 ? (
        <p className="mt-5 rounded-2xl border-2 border-dashed border-border p-5 text-center text-muted-foreground">
          Nenhum comércio em divulgação hoje. Quando um comércio confirmar a cortesia de um sorteio,
          ele aparece aqui por {LISTAO_DAYS} dias.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {active.map((e) => (
            <li key={e.merchant.id}>
              <Link
                to="/sorteios/comercios/$merchantId"
                params={{ merchantId: e.merchant.id }}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 active:bg-secondary"
              >
                <MerchantLogo src={e.merchant.logo} className="h-12 w-12" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{e.merchant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Em divulgação até {formatDateBR(e.until)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {scheduled.length > 0 && (
        <>
          <h2 className="mt-6 flex items-center gap-2 text-xl font-bold">
            <CalendarClock className="h-5 w-5 text-gold" aria-hidden="true" /> Agendados
          </h2>
          <p className="text-sm text-muted-foreground">
            Cortesias confirmadas para datas que ainda não chegaram.
          </p>
          <ul className="mt-2 space-y-2">
            {scheduled.map((e) => (
              <li
                key={e.merchant.id}
                className="flex items-center gap-3 rounded-2xl bg-card/60 p-3"
              >
                <MerchantLogo src={e.merchant.logo} className="h-10 w-10" />
                <div className="min-w-0">
                  <p className="truncate font-bold">{e.merchant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Começa em {formatDateBR(e.starts)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ListaoShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        today={today}
        entries={active}
        scheduled={scheduled}
        groupLogo={state.groupLogo}
      />
    </div>
  );
}
