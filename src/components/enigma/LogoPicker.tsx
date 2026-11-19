import { ImagePlus, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { MerchantLogo } from "./Logos";
import { fileToSmallDataUrl } from "@/lib/enigma/image";

export function LogoPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (logo: string | undefined) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await fileToSmallDataUrl(file));
    } catch {
      toast.error("Não deu para abrir essa imagem. Tente outra.");
    }
  };
  return (
    <div className="flex items-center gap-3">
      <MerchantLogo src={value} className="h-20 w-20" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary px-3 font-bold active:bg-accent"
        >
          <ImagePlus className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{value ? "Trocar logo" : "Escolher logo da galeria"}</span>
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex h-10 items-center justify-center gap-1 rounded-xl text-sm font-bold text-muted-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" /> Tirar logo
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
