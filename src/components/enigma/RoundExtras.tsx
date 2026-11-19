import { CheckCircle2, HelpCircle, Lightbulb, PackageCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ImageShareDialog } from "./ImageShare";
import { SecondaryButton } from "./GoldButton";
import { deliveryRows } from "@/lib/enigma/agenda";
import { riddleCardData } from "@/lib/enigma/cards";
import { renderRiddleCard } from "@/lib/enigma/cards-render";
import { report } from "@/lib/enigma/feedback";
import { repo } from "@/lib/enigma/repo";
import type { Draw, Merchant } from "@/lib/enigma/types";

const when = (at: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at);

/** "Entrega das cortesias": one line per courtesy; marking one never touches the winner or the others. */
export function DeliveryCard({ draw, merchants }: { draw: Draw; merchants: Merchant[] }) {
  const rows = deliveryRows(draw, merchants);
  if (!rows.some((r) => r.winner)) return null;
  return (
    <section className="mt-4 rounded-2xl bg-card p-4" aria-labelledby="entrega">
      <h2 id="entrega" className="font-display text-xl font-extrabold">
        Entrega das cortesias
      </h2>
      <ul className="mt-2 space-y-2">
        {rows.map((r) => (
          <li key={r.roundId} className="rounded-xl bg-secondary/60 p-3" data-testid="delivery-row">
            <p className="text-sm text-muted-foreground">
              {r.prize} · {r.merchant}
            </p>
            <p className="font-bold">{r.winner ?? "Ainda não sorteada"}</p>
            {r.deliveredAt !== undefined ? (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gold">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Entregue em{" "}
                {when(r.deliveredAt)}
              </p>
            ) : r.winner ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Entrega pendente</span>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Confirmar que ${r.winner} recebeu a cortesia?`)) return;
                    if (report(await repo.markDelivered(draw.id, r.roundId, Date.now())))
                      toast.success("Entrega registrada.");
                  }}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-extrabold text-primary-foreground"
                >
                  <PackageCheck className="h-4 w-4" aria-hidden="true" /> Marcar entregue
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Arte do enigma" (no answer) and "Arte da resposta", each a separate picture. */
export function RiddleArtButtons({
  draw,
  groupLogo,
}: {
  draw: Draw;
  groupLogo: string | undefined;
}) {
  const [open, setOpen] = useState<"enigma" | "resposta" | null>(null);
  const enigma = riddleCardData(draw, "enigma");
  const answer = riddleCardData(draw, "resposta");
  if (!enigma && !answer) return null;
  const card = open ? riddleCardData(draw, open) : null;
  return (
    <>
      {enigma && (
        <SecondaryButton onClick={() => setOpen("enigma")}>
          <HelpCircle className="text-gold" aria-hidden="true" /> Arte do enigma
        </SecondaryButton>
      )}
      {answer && (
        <SecondaryButton onClick={() => setOpen("resposta")}>
          <Lightbulb className="text-gold" aria-hidden="true" /> Arte da resposta
        </SecondaryButton>
      )}
      <ImageShareDialog
        open={open !== null && !!card}
        onClose={() => setOpen(null)}
        title={open === "resposta" ? "Arte da resposta" : "Arte do enigma"}
        description={
          open === "resposta"
            ? "Só para depois do encerramento."
            : "A resposta não aparece nesta arte."
        }
        renderKey={JSON.stringify(card) + (groupLogo ?? "")}
        make={async () => (card ? [await renderRiddleCard(card, groupLogo)] : [])}
      />
    </>
  );
}
