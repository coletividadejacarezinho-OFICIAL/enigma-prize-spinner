import { ArchiveRestore } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { GoldButton } from "@/components/enigma/GoldButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyRestore, previewRestore, type Preview } from "@/lib/enigma/restore-import";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Restaurar cópia de segurança": choose → preview (reads only) → confirm → save. */
export function RestoreCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Extract<Preview, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const p = await previewRestore(file);
    setBusy(false);
    if (p.ok) setPreview(p);
    else setError(p.message);
  };

  const confirm = async () => {
    if (!preview) return;
    setBusy(true);
    const r = await applyRestore(preview);
    setBusy(false);
    if (r.ok) {
      setPreview(null);
      toast.success("Cópia restaurada!");
    } else {
      setPreview(null);
      setError(r.message);
    }
  };

  const plan = preview?.plan;
  const partnersChanged = preview?.newPartnerRaw !== undefined && preview.newPartnerRaw !== preview.prevPartnerRaw;
  const nothingNew = plan && plan.newRaw === null && plan.writeVideos.size === 0 && !partnersChanged;
  const date = preview ? new Date(preview.backup.exportedAt).toLocaleString("pt-BR") : "";

  return (
    <section className="rounded-2xl bg-card p-4">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <ArchiveRestore className="h-6 w-6 text-gold" aria-hidden="true" /> Restaurar cópia
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Traz de volta uma cópia baixada antes. Nada muda sem você confirmar.
      </p>
      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="mt-3 h-12 w-full rounded-xl border border-gold/60 font-bold text-gold active:bg-secondary disabled:opacity-50"
      >
        {busy && !preview ? "Lendo a cópia…" : "Restaurar cópia de segurança"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        data-testid="restore-file"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Dialog open={!!preview} onOpenChange={(o) => !o && !busy && setPreview(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Restaurar esta cópia?</DialogTitle>
            <DialogDescription>Cópia feita em {date}.</DialogDescription>
          </DialogHeader>
          {plan && preview && (
            <div className="space-y-3 text-sm" data-testid="restore-preview">
              <ul className="space-y-1">
                {preview.backup.manifest.partners && <li>Convites, ofertas e avisos dos parceiros incluídos</li>}
                <li>{plural(plan.counts.official, "sorteio oficial", "sorteios oficiais")}</li>
                <li>{plural(plan.counts.rehearsals, "ensaio", "ensaios")}</li>
                <li>
                  {plural(plan.counts.courtesies, "cortesia", "cortesias")},{" "}
                  {plural(plan.counts.results, "com ganhador", "com ganhador")}
                </li>
                <li>
                  {plural(preview.backup.files.size, "vídeo na cópia", "vídeos na cópia")}
                  {preview.backup.missingVideos.length > 0 &&
                    `, ${plural(preview.backup.missingVideos.length, "ausente", "ausentes")}`}
                </li>
              </ul>
              {plan.conflicts.length > 0 ? (
                <div className="rounded-xl bg-destructive/15 p-3 text-destructive" role="alert">
                  <p className="font-bold">Não dá para restaurar: há conflito.</p>
                  <ul className="mt-1 list-disc pl-5">
                    {plan.conflicts.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-1">Nada foi alterado.</p>
                </div>
              ) : (
                <div className="rounded-xl bg-secondary p-3">
                  <p className="font-bold">O que vai acontecer:</p>
                  {plan.emptyBrowser ? (
                    <p>Este aparelho está vazio: tudo da cópia será recuperado.</p>
                  ) : nothingNew ? (
                    <p>Tudo desta cópia já está neste aparelho. Nada será repetido.</p>
                  ) : (
                    <p>
                      Entram {plural(plan.addDraws.length, "sorteio novo", "sorteios novos")} e{" "}
                      {plural(plan.addMerchants.length, "comércio novo", "comércios novos")}.{" "}
                      {plan.sameDraws > 0 &&
                        `${plural(plan.sameDraws, "sorteio igual fica", "sorteios iguais ficam")} como está. `}
                      Seus ajustes continuam iguais.
                    </p>
                  )}
                  {plan.writeVideos.size > 0 && (
                    <p>
                      {plural(
                        plan.writeVideos.size,
                        "vídeo será guardado",
                        "vídeos serão guardados",
                      )}
                      .
                    </p>
                  )}
                  {plan.unavailableVideos.length > 0 && (
                    <p className="text-destructive">
                      {plural(
                        plan.unavailableVideos.length,
                        "vídeo ficará indisponível",
                        "vídeos ficarão indisponíveis",
                      )}
                      ; o histórico é mantido.
                    </p>
                  )}
                </div>
              )}
              {plan.conflicts.length === 0 && !nothingNew && (
                <GoldButton onClick={confirm} disabled={busy}>
                  {busy ? "Restaurando…" : "Confirmar e restaurar"}
                </GoldButton>
              )}
              <button
                onClick={() => setPreview(null)}
                disabled={busy}
                className="h-11 w-full rounded-xl font-bold text-muted-foreground active:bg-secondary"
              >
                {plan.conflicts.length || nothingNew ? "Fechar" : "Cancelar"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
