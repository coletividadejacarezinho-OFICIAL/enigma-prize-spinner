import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ClipboardPaste, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/enigma/AppHeader";
import { GoldButton } from "@/components/enigma/GoldButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cleanName,
  findDuplicates,
  formatDateBR,
  merchantOf,
  normalizeForCompare,
  parsePastedList,
} from "@/lib/enigma/logic";
import { currentDraw, updateDraw, useAppState } from "@/lib/enigma/store";
import { MIN_NAMES_TO_SPIN } from "@/lib/enigma/types";

export const Route = createFileRoute("/nomes")({
  head: () => ({
    meta: [
      { title: "Nomes — Enigma Premiado" },
      { name: "description", content: "Digite ou cole os nomes dos participantes do sorteio." },
      { property: "og:title", content: "Nomes — Enigma Premiado" },
      {
        property: "og:description",
        content: "Digite ou cole os nomes dos participantes do sorteio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Nomes,
});

const fieldClass =
  "h-12 w-full min-w-0 rounded-xl border-2 border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-hidden";

function Nomes() {
  const state = useAppState();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ index: number; value: string } | null>(null);
  const [removing, setRemoving] = useState<{
    index: number;
    name: string;
    dups: number[] | undefined;
  } | null>(null);
  // Kept after closing so the dialog text doesn't go blank while it fades out.
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const draw = currentDraw(state);
  const names = draw.names;
  const locked = !!draw.result;
  const dups = findDuplicates(names);
  const repeated = Array.from(
    new Map(
      Array.from(dups.values()).map((positions) => [
        positions.join(","),
        { name: names[positions[0] ?? 0] ?? "", times: positions.length },
      ]),
    ).values(),
  );
  const setNames = (next: string[]) => updateDraw(draw.id, (d) => ({ ...d, names: next }));

  const add = () => {
    const name = cleanName(text);
    if (!name) {
      inputRef.current?.focus();
      return;
    }
    const exists = names.some((n) => normalizeForCompare(n) === normalizeForCompare(name));
    setNames([...names, name]);
    setText("");
    inputRef.current?.focus();
    if (exists) toast.warning(`“${name}” já estava na lista. Confira se é a mesma pessoa.`);
  };

  const addPasted = () => {
    const list = parsePastedList(pasteText);
    if (list.length === 0) return;
    setNames([...names, ...list]);
    setPasteText("");
    setPasteOpen(false);
    toast.success(`${list.length} ${list.length === 1 ? "nome adicionado" : "nomes adicionados"}.`);
  };

  const saveEdit = () => {
    if (!editing) return;
    const value = cleanName(editing.value);
    if (!value) return;
    setNames(names.map((n, i) => (i === editing.index ? value : n)));
    setEditing(null);
  };

  const confirmRemove = () => {
    if (removing === null) return;
    setNames(names.filter((_, i) => i !== removing.index));
    setRemoveOpen(false);
  };

  const pastedCount = parsePastedList(pasteText).length;

  return (
    <div className="pb-44">
      <AppHeader
        logo={state.groupLogo}
        subtitle={`${merchantOf(state.merchants, draw).name} · ${formatDateBR(draw.date)}`}
      />

      <div className="px-4">
        <h1 className="mt-1 text-3xl font-extrabold">
          Nomes <span className="text-xl text-muted-foreground">({names.length})</span>
        </h1>

        {locked ? (
          <div className="mt-3 rounded-2xl bg-card p-4">
            <p className="font-bold">Este sorteio já foi feito.</p>
            <p className="text-sm text-muted-foreground">
              Ganhador(a): <span className="font-bold text-gold">{draw.result?.winner}</span>. Para
              usar outros nomes, comece um novo sorteio.
            </p>
            <button
              onClick={() => navigate({ to: "/sorteios/novo" })}
              className="mt-3 flex h-11 items-center gap-2 rounded-xl bg-secondary px-4 font-bold"
            >
              <Plus className="h-5 w-5" aria-hidden="true" /> Novo sorteio
            </button>
          </div>
        ) : (
          <>
            <form
              className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Digite um nome"
                aria-label="Digite um nome"
                className={fieldClass}
                autoComplete="off"
                enterKeyHint="done"
              />
              <button
                type="submit"
                className="h-12 rounded-xl bg-secondary px-4 text-base font-bold text-foreground active:bg-accent"
              >
                Adicionar
              </button>
            </form>
            <button
              onClick={() => setPasteOpen(true)}
              className="mt-2 flex h-11 items-center gap-2 rounded-xl px-1 font-bold text-gold"
            >
              <ClipboardPaste className="h-5 w-5" aria-hidden="true" /> Colar lista
            </button>
          </>
        )}

        {repeated.length > 0 && (
          <div className="mt-3 flex gap-3 rounded-2xl border-2 border-gold/60 bg-card p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-bold">Tem nome repetido</p>
              <p className="text-muted-foreground">
                {repeated.map((r) => `${r.name} aparece ${r.times} vezes`).join("; ")}. Confira se é
                a mesma pessoa antes de remover.
              </p>
            </div>
          </div>
        )}

        {names.length === 0 ? (
          <p className="mt-6 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
            Nenhum nome ainda. Digite um nome acima ou toque em “Colar lista”.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {names.map((name, i) => {
              const isDup = dups.has(i);
              const isEditing = editing?.index === i;
              return (
                <li
                  key={`${i}-${name}`}
                  className={`flex items-center gap-2 rounded-xl bg-card p-2 pl-3 ${isDup ? "ring-2 ring-gold/70" : ""}`}
                >
                  <span className="w-7 shrink-0 text-right font-display text-lg font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  {isEditing ? (
                    <form
                      className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveEdit();
                      }}
                    >
                      <input
                        autoFocus
                        value={editing.value}
                        onChange={(e) => setEditing({ index: i, value: e.target.value })}
                        aria-label="Corrigir nome"
                        className="h-11 min-w-0 rounded-lg border-2 border-gold bg-background px-3 text-base focus:outline-hidden"
                      />
                      <button type="submit" className="h-11 rounded-lg bg-primary px-3 font-bold text-primary-foreground">
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="h-11 rounded-lg px-2 text-sm font-bold text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold">{name}</p>
                        {isDup && <p className="text-xs font-bold text-gold">Nome repetido</p>}
                      </div>
                      {!locked && (
                        <>
                          <button
                            onClick={() => setEditing({ index: i, value: name })}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg active:bg-secondary"
                            aria-label={`Corrigir ${name}`}
                          >
                            <Pencil className="h-5 w-5" aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => {
                              setRemoving({ index: i, name, dups: dups.get(i) });
                              setRemoveOpen(true);
                            }}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive active:bg-secondary"
                            aria-label={`Remover ${name}`}
                          >
                            <Trash2 className="h-5 w-5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md bg-linear-to-t from-background via-background to-transparent px-4 pb-3 pt-6">
        {!locked && names.length < MIN_NAMES_TO_SPIN && (
          <p className="mb-2 text-center text-sm text-muted-foreground">
            Coloque pelo menos {MIN_NAMES_TO_SPIN} nomes para girar.
          </p>
        )}
        <GoldButton
          onClick={() => navigate({ to: "/" })}
          disabled={!locked && names.length < MIN_NAMES_TO_SPIN}
        >
          {locked ? "Ver resultado na roleta" : "Usar estes nomes na roleta"}
        </GoldButton>
      </div>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Colar lista</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Cole os nomes aqui, um em cada linha.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder={"Maria da Silva\nJoão Pereira\nTereza Alves"}
            aria-label="Lista de nomes"
            className="w-full rounded-xl border-2 border-input bg-background p-3 text-base focus:border-gold focus:outline-hidden"
          />
          <DialogFooter>
            <GoldButton onClick={addPasted} disabled={pastedCount === 0} className="text-lg">
              {pastedCount > 0
                ? `Adicionar ${pastedCount} ${pastedCount === 1 ? "nome" : "nomes"}`
                : "Adicionar nomes"}
            </GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">
              Remover {removing?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              {removing?.dups
                ? `Esse nome aparece ${removing.dups.length} vezes (nº ${removing.dups.map((p) => p + 1).join(", nº ")}). Só o nº ${removing.index + 1} será removido.`
                : "O nome sai da lista deste sorteio."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-12 rounded-xl text-base font-bold">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              className="h-12 rounded-xl bg-destructive text-base font-bold text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
