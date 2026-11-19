import { Check, Plus } from "lucide-react";
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
import { createMerchant, normalizeForCompare, todayISO } from "@/lib/enigma/logic";
import { saveMerchant } from "@/lib/enigma/store";
import type { Merchant } from "@/lib/enigma/types";
import { cn } from "@/lib/utils";

export type DrawFormValues = {
  date: string;
  merchantId: string;
  prize: string;
  confirmed: boolean | null;
};

type Props = {
  merchants: Merchant[];
  initial?: DrawFormValues;
  /** Renders the buttons; `submit(intent)` validates and calls onSubmit. */
  actions: (submit: (intent: string) => void, values: DrawFormValues) => ReactNode;
  onSubmit: (values: DrawFormValues & { confirmed: boolean }, intent: string) => void;
};

export function DrawForm({ merchants, initial, actions, onSubmit }: Props) {
  const [values, setValues] = useState<DrawFormValues>(
    initial ?? { date: "", merchantId: "", prize: "", confirmed: null },
  );
  const [tried, setTried] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const set = (patch: Partial<DrawFormValues>) => setValues((v) => ({ ...v, ...patch }));

  // Today's date comes from the phone, so it is filled in after the page loads.
  useEffect(() => {
    setValues((v) => (v.date ? v : { ...v, date: todayISO() }));
  }, []);

  const merchantOk = merchants.some((m) => m.id === values.merchantId);
  const submit = (intent: string) => {
    setTried(true);
    if (!values.date || !merchantOk || !values.prize.trim() || values.confirmed === null) {
      toast.error("Falta preencher alguma coisa. Confira os campos em vermelho.");
      return;
    }
    onSubmit({ ...values, prize: values.prize.trim(), confirmed: values.confirmed }, intent);
  };

  const addMerchant = ({ name, logo }: { name: string; logo: string | undefined }) => {
    const existing = merchants.find((m) => normalizeForCompare(m.name) === normalizeForCompare(name));
    if (existing) {
      set({ merchantId: existing.id });
      setAddOpen(false);
      toast.info(`“${existing.name}” já estava cadastrado e foi escolhido.`);
      return;
    }
    const m = createMerchant({ name, logo });
    if (!saveMerchant(m)) {
      toast.error("O celular está sem espaço para guardar. Tente sem a logo.");
      return;
    }
    set({ merchantId: m.id });
    setAddOpen(false);
    toast.success(`${m.name} cadastrado e escolhido.`);
  };

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

      <fieldset>
        <legend className="mb-1.5 text-base font-bold">Comércio</legend>
        {merchants.length === 0 && (
          <p className="mb-2 text-sm text-muted-foreground">Nenhum comércio cadastrado ainda.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {merchants.map((m) => {
            const selected = m.id === values.merchantId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => set({ merchantId: m.id })}
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
            onClick={() => setAddOpen(true)}
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border p-2 font-bold text-gold"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
            Cadastrar agora
          </button>
        </div>
        {tried && !merchantOk && (
          <span className="mt-1 block text-sm font-semibold text-destructive">
            Escolha o comércio ou cadastre um novo.
          </span>
        )}
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-base font-bold">Cortesia deste sorteio</span>
        <textarea
          value={values.prize}
          onChange={(e) => set({ prize: e.target.value })}
          placeholder="Ex.: Um hambúrguer com batata"
          rows={2}
          className={areaClass}
        />
        {tried && !values.prize.trim() && (
          <span className="mt-1 block text-sm font-semibold text-destructive">
            Escreva qual é a cortesia.
          </span>
        )}
      </label>

      <fieldset>
        <legend className="mb-1.5 text-base font-bold">O comércio confirmou a cortesia?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Sim", value: true },
            { label: "Ainda não", value: false },
          ].map((opt) => {
            const selected = values.confirmed === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                aria-pressed={selected}
                onClick={() => set({ confirmed: opt.value })}
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

      <div className="space-y-1">{actions(submit, values)}</div>
    </form>

      {/* Outside the form: React submit events bubble through portals. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Cadastrar comércio</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Depois de salvar, você volta para o sorteio com ele já escolhido.
            </DialogDescription>
          </DialogHeader>
          <MerchantForm onSave={addMerchant} />
        </DialogContent>
      </Dialog>
    </>
  );
}
