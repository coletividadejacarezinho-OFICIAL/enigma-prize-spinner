import { ImagePlus, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

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

/**
 * "Anexar artes da rodada (opcional)": ready-made pictures of the question and the answer,
 * closed by default. Older riddle text/answer stay saved untouched (no input for them anymore).
 */
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
    <details className="rounded-2xl border-2 border-border p-3">
      <summary className="cursor-pointer select-none text-base font-bold text-gold">
        Anexar artes da rodada (opcional)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">
          Guarde aqui as imagens prontas da pergunta e da resposta, se quiser.
        </p>
        <ImageField label="Arte da pergunta" value={value.image} onChange={(v) => set("image", v)} />
        <ImageField
          label="Arte da resposta"
          value={value.answerImage}
          onChange={(v) => set("answerImage", v)}
        />
      </div>
    </details>
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
