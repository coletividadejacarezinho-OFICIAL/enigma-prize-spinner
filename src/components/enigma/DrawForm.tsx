import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { MerchantLogo } from "./Logos";
import { MerchantForm } from "./MerchantForm";
import { areaClass, fieldClass } from "./fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createMerchant, newId, normalizeForCompare, todayISO } from "@/lib/enigma/logic";
import { formatDescription } from "@/lib/enigma/input-format";
import { report } from "@/lib/enigma/feedback";
import { repo } from "@/lib/enigma/repo";
import type { Merchant, Riddle } from "@/lib/enigma/types";
import { RiddleFields } from "./RiddleFields";
import { cn } from "@/lib/utils";

export type PrizeRow = {
  /** Screen key. */
  key: string;
  /** Saved courtesy id (editing), so its result stays with it. */
  id?: string;
  merchantId: string;
  prize: string;
  /** Already drawn: can't be removed or changed. */
  locked?: boolean;
};

export type DrawFormValues = {
  date: string;
  prizes: PrizeRow[];
  confirmed: boolean | null;
  /** Only asked with two or more courtesies. */
  repeatWinners: boolean | null;
  riddle: Riddle;
};

export const emptyPrize = (): PrizeRow => ({ key: newId(), merchantId: "", prize: "" });

type Props = {
  merchants: Merchant[];
  initial?: DrawFormValues;
  /** Renders the buttons; `submit(intent)` validates and calls onSubmit. */
  actions: (submit: (intent: string) => void, values: DrawFormValues) => ReactNode;
  onSubmit: (values: DrawFormValues & { confirmed: boolean }, intent: string) => void;
};

function Choice<T>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.label}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex h-14 items-center justify-center gap-2 rounded-2xl border-2 text-lg font-bold",
              selected
                ? "border-gold bg-secondary text-gold"
                : "border-input bg-card text-foreground",
            )}
          >
            {selected && <Check className="h-5 w-5" aria-hidden="true" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function DrawForm({ merchants, initial, actions, onSubmit }: Props) {
  const [values, setValues] = useState<DrawFormValues>(
    initial ?? { date: "", prizes: [emptyPrize()], confirmed: null, repeatWinners: null, riddle: {} },
  );
  const [tried, setTried] = useState(false);
  // Which courtesy is choosing its company, and whether the dialog shows the sign-up form.
  const [picking, setPicking] = useState<{ key: string; adding: boolean } | null>(null);
  const set = (patch: Partial<DrawFormValues>) => setValues((v) => ({ ...v, ...patch }));
  const setRow = (key: string, patch: Partial<PrizeRow>) =>
    setValues((v) => ({
      ...v,
      prizes: v.prizes.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    }));

  // Today's date comes from the phone, so it is filled in after the page loads.
  useEffect(() => {
    setValues((v) => (v.date ? v : { ...v, date: todayISO() }));
  }, []);

  const multi = values.prizes.length > 1;
  const rowOk = (p: PrizeRow) => merchants.some((m) => m.id === p.merchantId) && !!p.prize.trim();
  const submit = (intent: string) => {
    setTried(true);
    // A draft only needs the date and the courtesies; the rest can wait.
    const draft = intent === "draft";
    if (
      !values.date ||
      !values.prizes.every(rowOk) ||
      (!draft && values.confirmed === null) ||
      (!draft && multi && values.repeatWinners === null)
    ) {
      toast.error("Falta preencher alguma coisa. Confira os campos em vermelho.");
      return;
    }
    onSubmit(
      {
        ...values,
        prizes: values.prizes.map((p) => ({ ...p, prize: p.locked ? p.prize : formatDescription(p.prize) })),
        confirmed: values.confirmed ?? false,
      },
      intent,
    );
  };

  const choose = (merchantId: string) => {
    if (!picking) return;
    setRow(picking.key, { merchantId });
    setPicking(null);
  };

  const addMerchant = async ({ name, logo }: { name: string; logo: string | undefined }) => {
    const existing = merchants.find(
      (m) => normalizeForCompare(m.name) === normalizeForCompare(name),
    );
    if (existing) {
      choose(existing.id);
      toast.info(`“${existing.name}” já estava cadastrada e foi escolhida.`);
      return;
    }
    const m = createMerchant({ name, logo });
    if (!report(await repo.saveMerchant(m))) return;
    choose(m.id);
    toast.success(`${m.name} cadastrada e escolhida.`);
  };

  const pickingRow = picking ? values.prizes.find((p) => p.key === picking.key) : undefined;

  return (
    <>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit("primary");
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-base font-bold">Data do sorteio</span>
          <input
            type="date"
            value={values.date}
            onChange={(e) => set({ date: e.target.value })}
            className={`${fieldClass} [color-scheme:dark]`}
          />
        </label>

        <div className="space-y-3">
          {values.prizes.map((row, i) => {
            const merchant = merchants.find((m) => m.id === row.merchantId);
            return (
              <fieldset
                key={row.key}
                className="rounded-2xl border-2 border-border p-3"
                data-testid="prize-row"
              >
                <legend className="px-1 text-sm font-bold text-gold">
                  {multi ? `Cortesia ${i + 1}` : "Cortesia"}
                </legend>
                <span className="mb-1.5 block text-base font-bold">Empresa</span>
                <button
                  type="button"
                  disabled={row.locked}
                  onClick={() => setPicking({ key: row.key, adding: merchants.length === 0 })}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-input bg-card px-3 text-left disabled:opacity-70"
                >
                  {merchant ? (
                    <>
                      <MerchantLogo src={merchant.logo} className="h-9 w-9" />
                      <span className="min-w-0 flex-1 truncate text-lg font-bold">
                        {merchant.name}
                      </span>
                    </>
                  ) : (
                    <span className="min-w-0 flex-1 text-lg text-muted-foreground">
                      Escolher empresa
                    </span>
                  )}
                  {!row.locked && (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
                  )}
                </button>
                {tried && !merchant && (
                  <span className="mt-1 block text-sm font-semibold text-destructive">
                    Escolha a empresa ou cadastre uma nova.
                  </span>
                )}

                <label className="mt-3 block">
                  <span className="mb-1.5 block text-base font-bold">Prêmio</span>
                  <textarea
                    value={row.prize}
                    disabled={row.locked}
                    onChange={(e) => setRow(row.key, { prize: e.target.value })}
                    onBlur={(e) => setRow(row.key, { prize: formatDescription(e.target.value) })}
                    autoCapitalize="sentences"
                    placeholder="Ex.: Um lanche com batata"
                    rows={2}
                    className={areaClass}
                  />
                  {tried && !row.prize.trim() && (
                    <span className="mt-1 block text-sm font-semibold text-destructive">
                      Escreva qual é o prêmio.
                    </span>
                  )}
                </label>
                {row.locked ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Já sorteada: não dá para mudar.
                  </p>
                ) : (
                  multi && (
                    <button
                      type="button"
                      onClick={() =>
                        set({ prizes: values.prizes.filter((p) => p.key !== row.key) })
                      }
                      className="mt-2 flex h-11 items-center gap-2 rounded-xl px-1 text-sm font-bold text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> Tirar esta cortesia
                    </button>
                  )
                )}
              </fieldset>
            );
          })}
          <button
            type="button"
            onClick={() => set({ prizes: [...values.prizes, emptyPrize()] })}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gold/70 font-bold text-gold"
          >
            <Plus className="h-5 w-5" aria-hidden="true" /> Adicionar outra cortesia
          </button>
          {multi && (
            <p className="text-sm text-muted-foreground">
              Todas as cortesias usam a mesma lista de nomes. Cada uma tem o seu ganhador.
            </p>
          )}
        </div>

        {multi && (
          <fieldset>
            <legend className="mb-1.5 text-base font-bold">
              Quem ganhar pode ganhar de novo neste sorteio?
            </legend>
            <Choice
              options={[
                { label: "Sim", value: true },
                { label: "Não", value: false },
              ]}
              value={values.repeatWinners}
              onChange={(v) => set({ repeatWinners: v })}
            />
            {values.repeatWinners === false && (
              <p className="mt-2 text-sm text-muted-foreground">
                Quem ganhar sai da roleta nas próximas cortesias.
              </p>
            )}
            {tried && values.repeatWinners === null && (
              <span className="mt-1 block text-sm font-semibold text-destructive">
                Escolha “Sim” ou “Não”.
              </span>
            )}
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-1.5 text-base font-bold">
            {multi ? "As empresas confirmaram as cortesias?" : "A empresa confirmou a cortesia?"}
          </legend>
          <Choice
            options={[
              { label: "Sim", value: true },
              { label: "Ainda não", value: false },
            ]}
            value={values.confirmed}
            onChange={(v) => set({ confirmed: v })}
          />
          {values.confirmed === false && (
            <p className="mt-2 text-sm text-muted-foreground">
              Sem problema: dá para salvar como rascunho e confirmar depois.
            </p>
          )}
          {tried && values.confirmed === null && (
            <span className="mt-1 block text-sm font-semibold text-destructive">
              Escolha “Sim” ou “Ainda não”.
            </span>
          )}
        </fieldset>

        <RiddleFields value={values.riddle} onChange={(riddle) => set({ riddle })} />

        <div className="space-y-1">{actions(submit, values)}</div>
      </form>

      {/* Outside the form: React submit events bubble through portals. */}
      <Dialog open={picking !== null} onOpenChange={(o) => !o && setPicking(null)}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {picking?.adding ? "Cadastrar empresa" : "Escolher empresa"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {picking?.adding
                ? "Depois de salvar, você volta para o sorteio com ela já escolhida."
                : "A mesma empresa pode oferecer mais de um prêmio."}
            </DialogDescription>
          </DialogHeader>
          {picking?.adding ? (
            <MerchantForm onSave={addMerchant} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {merchants.map((m) => {
                const selected = m.id === pickingRow?.merchantId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => choose(m.id)}
                    aria-pressed={selected}
                    className={cn(
                      "relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-card p-2 text-center",
                      selected ? "border-gold" : "border-transparent",
                    )}
                  >
                    {selected && (
                      <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                    <MerchantLogo src={m.logo} className="h-11 w-11" />
                    <span className="line-clamp-2 text-sm font-bold leading-tight">{m.name}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => picking && setPicking({ ...picking, adding: true })}
                className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border p-2 font-bold text-gold"
              >
                <Plus className="h-6 w-6" aria-hidden="true" />
                Cadastrar agora
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
