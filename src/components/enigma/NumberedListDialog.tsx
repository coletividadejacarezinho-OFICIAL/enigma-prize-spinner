import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchNumbered, type Numbered } from "@/lib/enigma/numbers";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The whole confirmed list, with public numbers. */
  list: Numbered[];
  /** Numbers still on this courtesy's wheel; the rest already won. */
  onWheel: ReadonlySet<number>;
  highlight: number | null;
};

/** Numbered, searchable list: find nº 250 by typing it, no long scrolling. */
export function NumberedListDialog({ open, onClose, list, onWheel, highlight }: Props) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => searchNumbered(list, q), [list, q]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Lista numerada</DialogTitle>
          <DialogDescription>
            {list.length} {list.length === 1 ? "participante" : "participantes"}. Busque pelo número
            ou pelo nome.
          </DialogDescription>
        </DialogHeader>
        <label className="flex h-12 items-center gap-2 rounded-xl bg-secondary px-3">
          <Search className="h-5 w-5 text-gold" aria-hidden="true" />
          <input
            autoCapitalize="none"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            inputMode="search"
            placeholder="Ex.: 250 ou Ana"
            aria-label="Buscar na lista"
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-hidden"
          />
        </label>
        <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto" data-testid="numbered-list">
          {shown.slice(0, 300).map((n) => (
            <li
              key={n.number}
              data-number={n.number}
              className={`grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-2 rounded-lg px-2 py-1.5 font-display ${
                n.number === highlight ? "bg-gold/20 ring-1 ring-gold" : ""
              } ${onWheel.has(n.number) ? "" : "opacity-60"}`}
            >
              <span className="text-right font-bold text-gold">{n.number}</span>
              <span className="break-words font-bold">
                {n.name}
                {!onWheel.has(n.number) && (
                  <span className="ml-1 text-xs text-muted-foreground">(já ganhou)</span>
                )}
              </span>
            </li>
          ))}
          {shown.length === 0 && (
            <li className="py-6 text-center text-muted-foreground">Ninguém encontrado.</li>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
