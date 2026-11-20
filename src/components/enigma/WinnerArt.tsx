import { useEffect, useState } from "react";

import { ImageShareDialog } from "./ImageShare";
import { summaryCardData, winnerCardData, winnerChoices, type WinnerChoice } from "@/lib/enigma/cards";
import { renderSummaryCards, renderWinnerCard } from "@/lib/enigma/cards-render";
import type { Draw, Merchant } from "@/lib/enigma/types";

/**
 * "Compartilhar arte do ganhador": one picture per spun courtesy, plus the summary
 * of all results once every courtesy of a multi-prize draw is spun.
 */
export function WinnerArtDialog({
  open,
  onClose,
  draw,
  merchants,
  groupLogo,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  draw: Draw;
  merchants: Merchant[];
  groupLogo: string | undefined;
  initial: WinnerChoice;
}) {
  const choices = winnerChoices(draw, merchants);
  const [choice, setChoice] = useState<WinnerChoice>(initial);
  useEffect(() => {
    if (open) setChoice(initial);
  }, [open, initial]);
  const valid = choices.some((c) => c.id === choice) ? choice : (choices[0]?.id ?? 0);

  const summary = valid === "resumo" ? summaryCardData(draw, merchants) : null;
  const single = typeof valid === "number" ? winnerCardData(draw, merchants, valid) : null;
  const key = JSON.stringify({ summary, single, groupLogo: groupLogo?.length ?? 0 });

  return (
    <ImageShareDialog
      open={open && choices.length > 0}
      onClose={onClose}
      title={valid === "resumo" ? "Arte dos ganhadores" : "Arte do ganhador"}
      description={
        valid === "resumo"
          ? "Todos os resultados juntos, cada ganhador com o seu prêmio e a sua empresa."
          : "Feita com o resultado guardado deste sorteio."
      }
      renderKey={key}
      make={async () => {
        if (summary) return renderSummaryCards(summary, groupLogo);
        if (single) return [await renderWinnerCard(single, groupLogo)];
        return [];
      }}
      choices={choices.map((c) => ({ id: String(c.id), label: c.label }))}
      choice={String(valid)}
      onChoice={(id) => setChoice(id === "resumo" ? "resumo" : Number(id))}
    />
  );
}
