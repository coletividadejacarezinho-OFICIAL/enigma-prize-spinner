import { DatabaseBackup, Download } from "lucide-react";
import { useState } from "react";

import { GoldButton } from "@/components/enigma/GoldButton";
import { downloadVideo as downloadBlob } from "@/lib/enigma/videos";
import { prepareBackup, type PreparedBackup } from "@/lib/enigma/backup-export";

/** "Baixar cópia de segurança": prepare first, then a tap downloads (keeps the tap valid on iPhone). */
export function BackupCard() {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<PreparedBackup | null>(null);

  const prepare = async () => {
    setBusy(true);
    setReady(null);
    setReady(await prepareBackup());
    setBusy(false);
  };

  return (
    <section className="rounded-2xl bg-card p-4">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <DatabaseBackup className="h-6 w-6 text-gold" aria-hidden="true" /> Cópia de segurança
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Guarda comércios, sorteios, nomes, ganhadores, vídeos e dados dos parceiros num arquivo.
      </p>
      {ready?.ok ? (
        <div className="mt-3 space-y-2" data-testid="backup-ready">
          <p className="font-bold text-gold">Cópia pronta!</p>
          <p className="text-sm">
            {plural(ready.manifest.summary.officialDraws.length, "sorteio", "sorteios")},{" "}
            {plural(ready.manifest.summary.rehearsalDraws.length, "ensaio", "ensaios")},{" "}
            {plural(ready.manifest.summary.videosIncluded, "vídeo", "vídeos")}.
          </p>
          {ready.manifest.summary.videosMissing.length > 0 && (
            <p className="text-sm text-destructive" role="status">
              {ready.manifest.summary.videosMissing.length === 1
                ? "1 vídeo não foi encontrado neste aparelho e ficou de fora. O histórico dele foi guardado."
                : `${ready.manifest.summary.videosMissing.length} vídeos não foram encontrados neste aparelho e ficaram de fora. O histórico deles foi guardado.`}
            </p>
          )}
          <GoldButton onClick={() => downloadBlob(ready.blob, ready.filename)}>
            <Download aria-hidden="true" /> Baixar cópia
          </GoldButton>
        </div>
      ) : (
        <>
          {ready && !ready.ok && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {ready.message}
            </p>
          )}
          <GoldButton className="mt-3" onClick={prepare} disabled={busy}>
            <DatabaseBackup aria-hidden="true" />
            {busy ? "Preparando…" : "Baixar cópia de segurança"}
          </GoldButton>
        </>
      )}
    </section>
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}
