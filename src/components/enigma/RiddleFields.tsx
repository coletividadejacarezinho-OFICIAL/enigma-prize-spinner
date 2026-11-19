import { ImagePlus, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { areaClass } from "./fields";
import { fileToSmallDataUrl } from "@/lib/enigma/image";
import type { Riddle } from "@/lib/enigma/types";

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      {value ? (
        <img
          src={value}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl border-2 border-gold object-cover"
        />
      ) : (
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground">
          <ImagePlus className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex h-12 items-center justify-center rounded-xl bg-secondary px-3 font-bold active:bg-accent"
        >
          <span className="truncate">{value ? "Trocar imagem" : label}</span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex h-10 items-center justify-center gap-1 text-sm font-bold text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Tirar imagem
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={label}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            // Small enough for the phone's storage, big enough for the 1080 px art.
            onChange(await fileToSmallDataUrl(f, 720));
          } catch {
            toast.error("Não deu para abrir essa imagem. Tente outra.");
          }
        }}
      />
    </div>
  );
}

/** "Enigma do dia": riddle and answer, each with an optional picture. All optional. */
export function RiddleFields({
  value,
  onChange,
}: {
  value: Riddle;
  onChange: (r: Riddle) => void;
}) {
  const set = (k: keyof Riddle, v: string | undefined) => {
    const next = { ...value };
    if (v) next[k] = v;
    else delete next[k];
    onChange(next);
  };
  return (
    <fieldset className="space-y-3 rounded-2xl border-2 border-border p-3">
      <legend className="px-1 text-sm font-bold text-gold">Enigma do dia</legend>
      <label className="block">
        <span className="mb-1.5 block text-base font-bold">Enigma</span>
        <textarea
          value={value.text ?? ""}
          onChange={(e) => set("text", e.target.value)}
          rows={2}
          placeholder="Ex.: O que é, o que é…"
          className={areaClass}
        />
      </label>
      <ImageField label="Imagem do enigma" value={value.image} onChange={(v) => set("image", v)} />
      <div className="rounded-xl border-2 border-dashed border-gold/50 p-3">
        <p className="mb-2 text-sm text-muted-foreground">
          A resposta fica só com você. Ela não aparece na arte do enigma.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-base font-bold">Resposta</span>
          <input
            value={value.answer ?? ""}
            onChange={(e) => set("answer", e.target.value)}
            placeholder="Ex.: A sombra"
            className={`${areaClass} h-12`}
          />
        </label>
        <div className="mt-3">
          <ImageField
            label="Imagem da resposta"
            value={value.answerImage}
            onChange={(v) => set("answerImage", v)}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function cleanRiddle(r: Riddle): Riddle | undefined {
  const out: Riddle = {};
  if (r.text?.trim()) out.text = r.text.trim();
  if (r.answer?.trim()) out.answer = r.answer.trim();
  if (r.image) out.image = r.image;
  if (r.answerImage) out.answerImage = r.answerImage;
  return Object.keys(out).length ? out : undefined;
}
