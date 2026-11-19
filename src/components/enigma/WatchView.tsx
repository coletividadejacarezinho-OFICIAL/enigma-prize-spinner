import { Disc3, Hourglass, Trophy } from "lucide-react";

import { GroupLogo, MerchantLogo } from "./Logos";
import { formatDateBR } from "@/lib/enigma/logic";
import { APP_NAME, GROUP_NAME } from "@/lib/enigma/types";
import { toggleDemoLike, useDemoLike, type WatchInfo, type WatchState } from "@/lib/enigma/watch";
import { cn } from "@/lib/utils";

/** What the audience sees. Only viewer controls: no spin, record or name editing. */
export function WatchView({ info, state }: { info: WatchInfo; state: WatchState }) {
  const liked = useDemoLike();

  return (
    <div className="flex flex-col gap-3">
      <p className="mx-auto w-fit rounded-full border border-gold px-3 py-1 text-xs font-bold text-gold">
        Demonstração de transmissão
      </p>

      <header className="flex items-center gap-3">
        <GroupLogo src={info.groupLogo} className="h-12 w-12 text-base" />
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">{GROUP_NAME}</p>
          <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        </div>
      </header>

      <section className="flex items-center gap-3 rounded-2xl bg-card p-3">
        <MerchantLogo src={info.shopLogo} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            Oferecimento: <span className="font-bold text-foreground">{info.shopName}</span>
          </p>
          <p className="break-words font-display text-lg font-bold leading-snug text-gold">{info.prize}</p>
          <p className="text-sm text-muted-foreground">📅 {formatDateBR(info.date)}</p>
        </div>
      </section>

      <section
        className={cn(
          "flex min-h-56 flex-col items-center justify-center rounded-3xl p-5 text-center",
          state === "encerrado" ? "border-2 border-gold bg-card" : "bg-nav",
        )}
        role="status"
      >
        {state === "aguardando" && (
          <>
            <Hourglass className="h-12 w-12 text-gold" aria-hidden="true" />
            <p className="mt-3 font-display text-2xl font-extrabold">Aguardando o sorteio</p>
            <p className="mt-1 text-muted-foreground">Fique por aqui, vai começar já já.</p>
          </>
        )}
        {state === "andamento" && (
          <>
            <span className="flex items-center gap-1.5 rounded-full bg-rec/20 px-2.5 py-0.5 text-xs font-extrabold text-rec">
              <span className="h-2 w-2 rounded-full bg-rec" aria-hidden="true" /> AO VIVO · DEMONSTRAÇÃO
            </span>
            <Disc3 className="mt-3 h-16 w-16 animate-spin text-gold [animation-duration:2s]" aria-hidden="true" />
            <p className="mt-3 font-display text-2xl font-extrabold">Sorteio em andamento</p>
            <p className="mt-1 text-muted-foreground">A roleta está girando…</p>
          </>
        )}
        {state === "encerrado" && (
          <>
            <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Sorteio encerrado</p>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-gold">
              <Trophy className="h-4 w-4" aria-hidden="true" /> Ganhador(a)
            </p>
            <p className="mt-1 break-words font-display text-4xl font-extrabold leading-tight text-gold">
              {info.winner}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Parabéns!</p>
          </>
        )}
      </section>

      <button
        onClick={() => toggleDemoLike()}
        aria-pressed={liked}
        className={cn(
          "flex h-14 w-full flex-col items-center justify-center rounded-2xl text-lg font-extrabold leading-tight",
          liked ? "border-2 border-gold bg-secondary text-gold" : "bg-secondary active:bg-accent",
        )}
      >
        {liked ? (
          <>
            <span>👍 Você curtiu</span>
            <span className="text-xs font-semibold text-muted-foreground">Toque de novo para desfazer</span>
          </>
        ) : (
          <span>👍 Curtir sorteio</span>
        )}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        A curtida fica só nesta página e não muda as reações do WhatsApp.
      </p>
    </div>
  );
}
