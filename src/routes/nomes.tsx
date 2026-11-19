import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, ClipboardCheck, ClipboardPaste, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/enigma/AppHeader";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { ImageButton, ImageShareDialog } from "@/components/enigma/ImageShare";
import { ResultShareDialog } from "@/components/enigma/ResultShare";
import { listCardData } from "@/lib/enigma/cards";
import { renderListCards } from "@/lib/enigma/cards-render";
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
  confirmEntry,
  confirmList,
  entriesOf,
  listMessage,
  manualEntry,
  mergeEntry,
  needsConfirmation,
  pendingEntries,
  pendingReasonText,
  positionLabel,
  readyEntries,
  reasonMatch,
  removeEntry,
  renameEntry,
  sameNameEntry,
} from "@/lib/enigma/entries";
import {
  cleanName,
  formatDateBR,
  merchantOf,
  normalizeForCompare,
  parsePastedList,
} from "@/lib/enigma/logic";
import { SAVE_FAIL, currentDraw, updateDraw, useAppState } from "@/lib/enigma/store";
import { GROUP_NAME, MIN_NAMES_TO_SPIN, type Entry } from "@/lib/enigma/types";

export const Route = createFileRoute("/nomes")({
  head: () => ({
    meta: [
      { title: "Nomes — Enigma Premiado" },
      {
        name: "description",
        content: "Digite ou cole os nomes conferidos e confirme a lista do sorteio.",
      },
      { property: "og:title", content: "Nomes — Enigma Premiado" },
      {
        property: "og:description",
        content: "Digite ou cole os nomes conferidos e confirme a lista do sorteio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Nomes,
});

const fieldClass =
  "h-12 w-full min-w-0 rounded-xl border-2 border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-hidden";

/** A typed or pasted name that matches someone already in the list. */
type Ask = { name: string; matchId: string; rest: string[] };
/** Two people with the same name: give each a display name. */
type Diff =
  | { mode: "new"; matchId: string; first: string; second: string; rest: string[] }
  | { mode: "pending"; matchId: string; pendingId: string; first: string; second: string };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Nomes() {
  const state = useAppState();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [removing, setRemoving] = useState<Entry | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmShare, setConfirmShare] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [listImageOpen, setListImageOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const draw = currentDraw(state);
  const shop = merchantOf(state.merchants, draw);
  const entries = entriesOf(draw);
  const ready = readyEntries(entries);
  const pending = pendingEntries(entries);
  const locked = !!draw.result;
  const dirty = needsConfirmation(draw);
  const canConfirm = ready.length >= MIN_NAMES_TO_SPIN;

  // Always work on the saved list, so quick taps never overwrite each other.
  const change = (fn: (list: Entry[]) => Entry[]) =>
    updateDraw(draw.id, (d) => (d.result ? d : { ...d, entries: fn(entriesOf(d)) }));

  /** Runs a change; when the browser refuses to save, says so and returns false. */
  const save = (fn: (list: Entry[]) => Entry[]) => {
    const ok = change(fn);
    if (!ok) toast.error(SAVE_FAIL);
    return ok;
  };

  /**
   * Adds names in order and stops at the first one that is already in the list.
   * `before` is saved in the same step, so a refused save leaves everything to retry.
   * Returns null when nothing was saved.
   */
  const addNames = (queue: string[], before?: (list: Entry[]) => Entry[]) => {
    const out: { ask: Ask | null; added: number } = { ask: null, added: 0 };
    const ok = save((list) => {
      out.ask = null;
      out.added = 0;
      let next = before ? before(list) : list;
      for (let i = 0; i < queue.length; i++) {
        const name = queue[i] ?? "";
        const match = sameNameEntry(next, name);
        if (match) {
          out.ask = { name, matchId: match.id, rest: queue.slice(i + 1) };
          break;
        }
        next = [...next, manualEntry(name, Date.now())];
        out.added++;
      }
      return next;
    });
    if (!ok) return null;
    setAsk(out.ask);
    return out.added;
  };

  const add = () => {
    const name = cleanName(text);
    if (!name) {
      inputRef.current?.focus();
      return;
    }
    if (addNames([name]) === null) return; // keep the typed name to try again
    setText("");
    inputRef.current?.focus();
  };

  const addPasted = () => {
    const list = parsePastedList(pasteText);
    if (list.length === 0) return;
    const added = addNames(list);
    if (added === null) return; // the pasted list stays in the box
    setPasteText("");
    setPasteOpen(false);
    if (added > 0) toast.success(`${plural(added, "nome adicionado", "nomes adicionados")}.`);
  };

  const askMatch = ask ? entries.find((e) => e.id === ask.matchId) : undefined;

  const askSame = () => {
    if (!ask) return;
    const kept = askMatch?.name ?? ask.name;
    // On a refused save the question stays open with the names still to add.
    if (addNames(ask.rest) === null) return;
    toast.success(`Mantida uma vaga para ${kept}.`);
  };

  const askDifferent = () => {
    if (!ask || !askMatch) return;
    setDiff({
      mode: "new",
      matchId: askMatch.id,
      first: askMatch.name,
      second: ask.name,
      rest: ask.rest,
    });
    setAsk(null);
  };

  const askLater = () => {
    if (!ask) return;
    const { name, matchId, rest } = ask;
    addNames(rest, (list) => [
      ...list,
      manualEntry(name, Date.now(), { kind: "repetido", withId: matchId }),
    ]);
  };

  const diffError = (() => {
    if (!diff) return null;
    const a = cleanName(diff.first);
    const b = cleanName(diff.second);
    if (!a || !b) return "Preencha os dois nomes.";
    if (normalizeForCompare(a) === normalizeForCompare(b))
      return "Os nomes ainda estão iguais. Acrescente um detalhe, como o bairro.";
    const others = diff.mode === "pending" ? [diff.matchId, diff.pendingId] : [diff.matchId];
    const taken = sameNameEntry(entries, a, others) ?? sameNameEntry(entries, b, others);
    if (taken) return `Já tem “${taken.name}” na lista. Use outro detalhe.`;
    return null;
  })();

  const saveDiff = () => {
    if (!diff || diffError) return;
    const first = cleanName(diff.first);
    const second = cleanName(diff.second);
    if (diff.mode === "new") {
      const before = (list: Entry[]) => [
        ...renameEntry(list, diff.matchId, first),
        manualEntry(second, Date.now()),
      ];
      if (addNames(diff.rest, before) === null) return; // the two names stay in the dialog
      setDiff(null);
    } else {
      if (
        !save((list) =>
          confirmEntry(renameEntry(list, diff.matchId, first), diff.pendingId, second),
        )
      )
        return;
      setDiff(null);
      if (pending.length > 1) setReviewOpen(true);
    }
  };

  const confirmPending = (e: Entry) => {
    const match = reasonMatch(e, entries);
    const twin =
      match && normalizeForCompare(match.name) === normalizeForCompare(e.name)
        ? match
        : sameNameEntry(entries, e.name, [e.id]);
    if (twin) {
      setReviewOpen(false);
      setDiff({
        mode: "pending",
        matchId: twin.id,
        pendingId: e.id,
        first: twin.name,
        second: e.name,
      });
      return;
    }
    if (!save((list) => confirmEntry(list, e.id))) return;
    toast.success(`${e.name} entrou na lista.`);
    if (pending.length <= 1) setReviewOpen(false);
  };

  const samePerson = (e: Entry, match: Entry) => {
    if (!save((list) => mergeEntry(list, e.id, match.id))) return;
    toast.success(`Mantida uma vaga para ${match.name}.`);
    if (pending.length <= 1) setReviewOpen(false);
  };

  const dropPending = (e: Entry) => {
    if (!save((list) => removeEntry(list, e.id))) return;
    if (pending.length <= 1) setReviewOpen(false);
  };

  const saveEdit = () => {
    if (!editing) return;
    const value = cleanName(editing.value);
    if (!value) return;
    const taken = sameNameEntry(entries, value, [editing.id]);
    if (taken) {
      toast.error(`Já tem “${taken.name}” na lista. Acrescente um detalhe, como o bairro.`);
      return;
    }
    if (!save((list) => renameEntry(list, editing.id, value))) return;
    setEditing(null);
  };

  const confirmRemove = () => {
    if (!removing) return;
    if (!save((list) => removeEntry(list, removing.id))) return;
    setRemoveOpen(false);
  };

  const confirmAndOpen = () => {
    if (locked) {
      navigate({ to: "/" });
      return;
    }
    if (!canConfirm) return;
    if (!updateDraw(draw.id, confirmList)) return void toast.error(SAVE_FAIL);
    toast.success(`Lista confirmada: ${plural(ready.length, "nome", "nomes")} na roleta.`);
    navigate({ to: "/" });
  };

  const openShare = () => {
    if (!locked && dirty) setConfirmShare(true);
    else setShareOpen(true);
  };

  const pastedCount = parsePastedList(pasteText).length;
  const showShare = locked || draw.names.length > 0 || canConfirm;
  const hint = locked
    ? null
    : !canConfirm
      ? `Coloque pelo menos ${MIN_NAMES_TO_SPIN} nomes para girar.`
      : dirty && draw.names.length > 0
        ? "A lista mudou. Confirme de novo para atualizar a roleta."
        : pending.length > 0
          ? `${plural(pending.length, "pendência fica", "pendências ficam")} de fora até você conferir.`
          : null;

  return (
    <div className={showShare ? "pb-56" : "pb-44"}>
      <AppHeader logo={state.groupLogo} subtitle={`${shop.name} · ${formatDateBR(draw.date)}`} />

      <div className="px-4">
        <h1 className="mt-1 text-3xl font-extrabold">Nomes</h1>

        {locked ? (
          <div className="mt-3 rounded-2xl bg-card p-4">
            <p className="font-bold">Este sorteio já foi feito.</p>
            <p className="text-sm text-muted-foreground">
              Ganhador(a): <span className="font-bold text-gold">{draw.result?.winner}</span>. A
              lista abaixo é a que foi usada no giro. Para outros nomes, comece um novo sorteio.
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

        <p className="mt-3 text-lg font-bold" data-testid="ready-count">
          {locked
            ? `${plural(draw.names.length, "pessoa", "pessoas")} no sorteio`
            : `${plural(ready.length, "pessoa pronta", "pessoas prontas")} para o sorteio`}
        </p>

        {!locked && pending.length > 0 && (
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border-2 border-gold/60 bg-card p-3">
            <p className="min-w-0 text-sm">
              <span className="block font-bold">
                {plural(pending.length, "entrada", "entradas")} para conferir
              </span>
              <span className="text-muted-foreground">Ficam fora da roleta até você decidir.</span>
            </p>
            <button
              onClick={() => setReviewOpen(true)}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-bold active:bg-accent"
            >
              <ClipboardCheck className="h-4 w-4 text-gold" aria-hidden="true" /> Revisar pendências
            </button>
          </div>
        )}

        {locked ? (
          <ol className="mt-3 space-y-2">
            {draw.names.map((name, i) => (
              <li key={`${i}-${name}`} className="flex items-center gap-2 rounded-xl bg-card p-3">
                <span className="w-7 shrink-0 text-right font-display text-lg font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-lg font-semibold">{name}</p>
              </li>
            ))}
          </ol>
        ) : ready.length === 0 ? (
          <p className="mt-4 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground">
            Nenhum nome pronto ainda. Digite um nome acima ou toque em “Colar lista”.
          </p>
        ) : (
          <ol className="mt-3 space-y-2">
            {ready.map((entry, i) => {
              const isEditing = editing?.id === entry.id;
              return (
                <li key={entry.id} className="flex items-center gap-2 rounded-xl bg-card p-2 pl-3">
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
                        onChange={(e) => setEditing({ id: entry.id, value: e.target.value })}
                        aria-label="Corrigir nome"
                        className="h-11 min-w-0 rounded-lg border-2 border-gold bg-background px-3 text-base focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        className="h-11 rounded-lg bg-primary px-3 font-bold text-primary-foreground"
                      >
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
                        <p className="truncate text-lg font-semibold">{entry.name}</p>
                        {entry.source === "bot" && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Bot className="h-3.5 w-3.5" aria-hidden="true" /> Pelo bot (teste)
                            {entry.botTime ? ` · ${entry.botTime}` : ""}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setEditing({ id: entry.id, value: entry.name })}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg active:bg-secondary"
                        aria-label={`Corrigir ${entry.name}`}
                      >
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => {
                          setRemoving(entry);
                          setRemoveOpen(true);
                        }}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive active:bg-secondary"
                        aria-label={`Remover ${entry.name}`}
                      >
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] z-30 mx-auto max-w-md bg-linear-to-t from-background via-background to-transparent px-4 pb-3 pt-6">
        {hint && (
          <p className="mb-2 text-center text-sm font-semibold text-muted-foreground">{hint}</p>
        )}
        <GoldButton onClick={confirmAndOpen} disabled={!locked && !canConfirm}>
          {locked ? "Ver resultado na roleta" : "Usar estes nomes na roleta"}
        </GoldButton>
        {showShare && (
          <SecondaryButton onClick={openShare} className="mt-1">
            <Send className="text-gold" aria-hidden="true" /> Mandar lista no grupo
          </SecondaryButton>
        )}
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
                ? `Adicionar ${plural(pastedCount, "nome", "nomes")}`
                : "Adicionar nomes"}
            </GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ask !== null} onOpenChange={(o) => !o && askLater()}>
        <DialogContent className="max-w-[calc(100vw-2rem)] gap-3 rounded-2xl border-border bg-card p-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl leading-tight">
              É a mesma pessoa ou são duas pessoas com o mesmo nome?
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              “{ask?.name}” já está na lista
              {askMatch ? positionLabel(askMatch, entries) : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={askSame}
              className="h-12 w-full rounded-xl bg-secondary text-base font-bold active:bg-accent"
            >
              É a mesma pessoa
            </button>
            <button
              onClick={askDifferent}
              disabled={!askMatch}
              className="h-12 w-full rounded-xl bg-secondary text-base font-bold active:bg-accent disabled:opacity-50"
            >
              São duas pessoas
            </button>
            <button
              onClick={askLater}
              className="h-12 w-full rounded-xl border-2 border-gold/60 text-base font-bold text-gold"
            >
              Deixar para conferir
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={diff !== null} onOpenChange={(o) => !o && setDiff(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] gap-3 rounded-2xl border-border bg-card p-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Como diferenciar?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              As duas pessoas ficam na lista. Acrescente um detalhe para saber quem é quem, como o
              bairro ou o sobrenome.
            </DialogDescription>
          </DialogHeader>
          <label className="block text-sm font-bold">
            Quem já estava na lista
            <input
              value={diff?.first ?? ""}
              onChange={(e) => diff && setDiff({ ...diff, first: e.target.value })}
              className={`${fieldClass} mt-1 bg-background`}
              placeholder="Ex.: Maria Silva (Centro)"
            />
          </label>
          <label className="block text-sm font-bold">
            {diff?.mode === "pending" ? "Quem estava para conferir" : "Quem você está adicionando"}
            <input
              value={diff?.second ?? ""}
              onChange={(e) => diff && setDiff({ ...diff, second: e.target.value })}
              className={`${fieldClass} mt-1 bg-background`}
              placeholder="Ex.: Maria Silva (Vila Rosa)"
            />
          </label>
          <p className="min-h-5 text-sm font-semibold text-gold" role="status">
            {diffError}
          </p>
          <GoldButton onClick={saveDiff} disabled={!!diffError} className="text-lg">
            Manter as duas
          </GoldButton>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen && pending.length > 0} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Revisar pendências</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Confirme o acerto ou retire da lista. Só entra na roleta quem você confirmar.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-3">
            {pending.map((e) => {
              const match = reasonMatch(e, entries);
              return (
                <li key={e.id} className="rounded-2xl bg-card p-3">
                  <p className="break-words text-lg font-bold">{e.name}</p>
                  {e.source === "bot" && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Bot className="h-3.5 w-3.5" aria-hidden="true" /> Pelo bot (teste)
                      {e.botTime ? ` às ${e.botTime}` : ""}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pendingReasonText(e, entries)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => confirmPending(e)}
                      className="h-11 rounded-xl bg-primary px-2 text-sm font-bold text-primary-foreground"
                    >
                      Confirmar acerto
                    </button>
                    <button
                      onClick={() => dropPending(e)}
                      className="h-11 rounded-xl bg-secondary px-2 text-sm font-bold text-destructive"
                    >
                      Retirar da lista
                    </button>
                  </div>
                  {match && (
                    <button
                      onClick={() => samePerson(e, match)}
                      className="mt-2 h-11 w-full rounded-xl border border-gold/60 px-2 text-sm font-bold text-gold"
                    >
                      É a mesma pessoa: manter uma vaga
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmShare} onOpenChange={setConfirmShare}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">
              Confirmar a lista nova?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              {canConfirm
                ? `A lista mudou. Ao confirmar, a roleta e a mensagem passam a ter os mesmos ${plural(ready.length, "nome", "nomes")}.`
                : `Coloque pelo menos ${MIN_NAMES_TO_SPIN} nomes prontos antes de mandar a lista.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-12 rounded-xl text-base font-bold">
              Voltar
            </AlertDialogCancel>
            {canConfirm && (
              <AlertDialogAction
                onClick={() => {
                  if (!updateDraw(draw.id, confirmList)) return void toast.error(SAVE_FAIL);
                  setShareOpen(true);
                }}
                className="btn-gold h-12 rounded-xl text-base font-bold"
              >
                Confirmar e ver mensagem
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResultShareDialog
        text={shareOpen ? listMessage(draw, shop.name, GROUP_NAME) : null}
        onClose={() => setShareOpen(false)}
        title="Mandar lista no grupo"
        description="Só os nomes confirmados, iguais aos da roleta. No WhatsApp, escolha o grupo e toque em Enviar."
        extra={
          <ImageButton
            onClick={() => {
              setShareOpen(false);
              setListImageOpen(true);
            }}
          />
        }
      />

      <ImageShareDialog
        open={listImageOpen}
        onClose={() => setListImageOpen(false)}
        title="Lista como imagem"
        description="Só os nomes confirmados, na mesma ordem da roleta."
        renderKey={JSON.stringify([
          listCardData(draw, state.merchants),
          state.groupLogo?.length ?? 0,
        ])}
        make={() => renderListCards(listCardData(draw, state.merchants), state.groupLogo)}
      />

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">
              Remover {removing?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              O nome sai da lista deste sorteio.
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
