import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Smartphone, Volume2, VolumeX } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/enigma/AppHeader";
import { BackupCard } from "@/components/enigma/BackupCard";
import { RestoreCard } from "@/components/enigma/RestoreCard";
import { BotTestCard } from "@/components/enigma/BotTestCard";
import { GoldButton } from "@/components/enigma/GoldButton";
import { InstallCard } from "@/components/enigma/InstallCard";
import { GroupLogo } from "@/components/enigma/Logos";
import { Switch } from "@/components/ui/switch";
import { fileToSmallDataUrl } from "@/lib/enigma/image";
import { report } from "@/lib/enigma/feedback";
import { repo, useAppState } from "@/lib/enigma/repo";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — Enigma Premiado" },
      {
        name: "description",
        content: "Logo do grupo, som da roleta, teste do bot e instalar no celular.",
      },
      { property: "og:title", content: "Ajustes — Enigma Premiado" },
      {
        property: "og:description",
        content: "Logo do grupo, som da roleta, teste do bot e instalar no celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Ajustes,
});

function Ajustes() {
  const state = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await fileToSmallDataUrl(file, 400);
      if (report(await repo.setPreferences({ groupLogo: url }))) toast.success("Logo trocada!");
    } catch {
      toast.error("Não deu para abrir essa imagem. Tente outra.");
    }
  };

  const removeLogo = async () => {
    report(await repo.setPreferences({ groupLogo: null }));
  };

  return (
    <div className="pb-24">
      <AppHeader logo={state.groupLogo} subtitle="Ajustes" />
      <div className="space-y-4 px-4">
        <h1 className="mt-1 text-3xl font-extrabold">Ajustes</h1>

        <section className="rounded-2xl bg-card p-4">
          <h2 className="text-xl font-bold">Logo do grupo</h2>
          <div className="mt-3 flex justify-center">
            <GroupLogo src={state.groupLogo} className="h-28 w-28 text-4xl" />
          </div>
          <GoldButton className="mt-4" onClick={() => fileRef.current?.click()}>
            <ImagePlus aria-hidden="true" /> Escolher logo da galeria
          </GoldButton>
          {state.groupLogo && (
            <button
              onClick={removeLogo}
              className="mt-2 h-11 w-full rounded-xl font-bold text-muted-foreground active:bg-secondary"
            >
              Tirar logo e voltar para “CJ”
            </button>
          )}
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
        </section>

        <section className="rounded-2xl bg-card p-4">
          <label className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-3">
              {state.sound ? (
                <Volume2 className="h-6 w-6 text-gold" aria-hidden="true" />
              ) : (
                <VolumeX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              )}
              <span>
                <span className="block text-xl font-bold">Som da roleta</span>
                <span className="block text-sm text-muted-foreground">
                  {state.sound ? "Ligado" : "Desligado"}
                </span>
              </span>
            </span>
            <Switch
              checked={state.sound}
              onCheckedChange={async (on) => {
                report(await repo.setPreferences({ sound: on }));
              }}
              className="scale-125"
              aria-label="Som da roleta"
            />
          </label>
        </section>

        <BotTestCard state={state} />

        <BackupCard />

        <RestoreCard />

        <InstallCard />

        <p className="flex items-start gap-2 px-1 text-sm text-muted-foreground">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Tudo fica guardado só neste aparelho, neste navegador.
        </p>
      </div>
    </div>
  );
}
