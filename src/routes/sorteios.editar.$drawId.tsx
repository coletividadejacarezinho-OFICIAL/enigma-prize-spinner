import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { DrawForm } from "@/components/enigma/DrawForm";
import { GoldButton } from "@/components/enigma/GoldButton";
import { updateDraw, useAppState } from "@/lib/enigma/store";

export const Route = createFileRoute("/sorteios/editar/$drawId")({
  head: () => ({
    meta: [
      { title: "Editar sorteio — Enigma Premiado" },
      { name: "description", content: "Corrija o comércio, a data, a cortesia ou a confirmação." },
      { property: "og:title", content: "Editar sorteio — Enigma Premiado" },
      {
        property: "og:description",
        content: "Corrija o comércio, a data, a cortesia ou a confirmação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditarSorteio,
});

function EditarSorteio() {
  const { drawId } = Route.useParams();
  const state = useAppState();
  const navigate = useNavigate();
  if (!state) return <div className="h-dvh" aria-busy="true" />;
  const draw = state.draws.find((d) => d.id === drawId);

  return (
    <div className="px-4 pb-24 pt-3">
      <Link to="/sorteios" className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold">Editar sorteio</h1>
      {!draw ? (
        <p className="text-muted-foreground">Esse sorteio não foi encontrado neste aparelho.</p>
      ) : (
        <DrawForm
          merchants={state.merchants}
          initial={{
            date: draw.date,
            merchantId: draw.merchantId ?? "",
            prize: draw.prize,
            confirmed: draw.confirmed ?? null,
          }}
          onSubmit={(v) => {
            const merchant = state.merchants.find((m) => m.id === v.merchantId);
            if (!merchant) return;
            const ok = updateDraw(draw.id, (d) => ({
              ...d,
              date: v.date,
              merchantId: merchant.id,
              merchant: merchant.name,
              prize: v.prize,
              confirmed: v.confirmed,
            }));
            if (!ok) return void toast.error("O celular está sem espaço para guardar.");
            toast.success("Sorteio atualizado.");
            navigate({ to: "/sorteios" });
          }}
          actions={() => <GoldButton type="submit">Salvar alterações</GoldButton>}
        />
      )}
    </div>
  );
}
