import { Check, Copy, MessageCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { whatsappLink } from "@/lib/enigma/logic";

/** Copies text; falls back to a hidden textarea for phones without the clipboard API. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // try the fallback below
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Preview of the result message with "Abrir WhatsApp" and "Copiar mensagem".
 * Only shows text; closing it never touches the draw.
 */
export function ResultShareDialog({
  text,
  onClose,
  title = "Mandar no WhatsApp",
  description = "Veja a mensagem. No WhatsApp, escolha o grupo e toque em Enviar.",
  extra,
}: {
  text: string | null;
  onClose: () => void;
  title?: string;
  description?: string;
  /** Another way to share, such as "Enviar como imagem", shown under "Abrir WhatsApp". */
  extra?: ReactNode;
}) {
  const [copy, setCopy] = useState<"idle" | "ok" | "fail">("idle");
  useEffect(() => setCopy("idle"), [text]);

  const handleCopy = async () => {
    if (!text) return;
    setCopy((await copyText(text)) ? "ok" : "fail");
  };

  return (
    <Dialog open={text !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <p
          className="select-text whitespace-pre-wrap break-words rounded-2xl border-2 border-gold/60 bg-card p-3 text-[15px] leading-snug"
          data-testid="result-message"
        >
          {text}
        </p>
        <div className="space-y-2">
          <a
            href={text ? whatsappLink(text) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 font-display text-xl font-extrabold transition-transform active:scale-[0.98] [&_svg]:h-6 [&_svg]:w-6"
          >
            <MessageCircle aria-hidden="true" /> Abrir WhatsApp
          </a>
          {extra}
          <button
            onClick={handleCopy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-bold active:bg-accent"
          >
            {copy === "ok" ? (
              <>
                <Check className="h-5 w-5 text-gold" aria-hidden="true" /> Mensagem copiada
              </>
            ) : (
              <>
                <Copy className="h-5 w-5" aria-hidden="true" /> Copiar mensagem
              </>
            )}
          </button>
          <p className="min-h-5 text-center text-sm text-muted-foreground" role="status">
            {copy === "fail"
              ? "Não deu para copiar. Toque e segure a mensagem acima para copiar."
              : "Se o WhatsApp não abrir, copie a mensagem e cole no grupo."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
