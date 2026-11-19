import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GoldButton } from "@/components/enigma/GoldButton";
import { MerchantLogo } from "@/components/enigma/Logos";
import { fileToSmallDataUrl } from "@/lib/enigma/image";
import { createDraw, todayISO } from "@/lib/enigma/logic";
import { addDraw } from "@/lib/enigma/store";

export const Route = createFileRoute("/sorteios/novo")({
  head: () => ({
    meta: [
      { title: "Novo sorteio — Enigma Premiado" },
      { name: "description", content: "Informe a data, o comércio e a cortesia do novo sorteio." },
      { property: "og:title", content: "Novo sorteio — Enigma Premiado" },
      {
        property: "og:description",
        content: "Informe a data, o comércio e a cortesia do novo sorteio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovoSorteio,
});

const fieldClass =
  "h-12 w-full rounded-xl border-2 border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-hidden";

function NovoSorteio() {
  const navigate = useNavigate();
  const [date, setDate] = useState("");
  const [merchant, setMerchant] = useState("");
  const [prize, setPrize] = useState("");
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [tried, setTried] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Today's date comes from the phone, so it is filled in after the page loads.
  useEffect(() => {
    setDate((d) => d || todayISO());
  }, []);

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      setLogo(await fileToSmallDataUrl(file));
    } catch {
      toast.error("Não deu para abrir essa imagem. Tente outra.");
    }
  };

  const submit = () => {
    setTried(true);
    if (!merchant.trim() || !prize.trim() || !date) return;
    const draw = createDraw({ date, merchant, prize, ...(logo ? { merchantLogo: logo } : {}) });
    if (!addDraw(draw)) {
      toast.error("O celular está sem espaço para guardar. Tente sem a logo.");
      return;
    }
    navigate({ to: "/nomes" });
  };

  return (
    <div className="px-4 pb-24 pt-3">
      <Link to="/sorteios" className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      <h1 className="text-3xl font-extrabold">Novo sorteio</h1>

      <form
        className="mt-4 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-base font-bold">Data do sorteio</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${fieldClass} [color-scheme:dark]`}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-base font-bold">Nome do comércio</span>
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Ex.: Mercado Bom Preço"
            className={fieldClass}
          />
          {tried && !merchant.trim() && (
            <span className="mt-1 block text-sm font-semibold text-destructive">
              Escreva o nome do comércio.
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-base font-bold">Cortesia</span>
          <textarea
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="Ex.: Um vale-compras de R$ 50"
            rows={2}
            className="w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-hidden"
          />
          {tried && !prize.trim() && (
            <span className="mt-1 block text-sm font-semibold text-destructive">
              Escreva qual é a cortesia.
            </span>
          )}
        </label>

        <div>
          <span className="mb-1.5 block text-base font-bold">
            Logo do comércio <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <div className="flex items-center gap-3">
            <MerchantLogo src={logo} className="h-16 w-16" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-12 items-center gap-2 rounded-xl bg-secondary px-4 font-bold"
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              {logo ? "Trocar logo" : "Escolher da galeria"}
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => setLogo(undefined)}
                className="flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground"
                aria-label="Tirar logo"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void pickLogo(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <GoldButton type="submit">Continuar para os nomes</GoldButton>
      </form>
    </div>
  );
}
