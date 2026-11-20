import { Link } from "@tanstack/react-router";
import { Bot, Repeat } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  BOT_OUTCOME_LABEL,
  cleanTime,
  entriesOf,
  jacarezinhoTime,
  pendingEntries,
  readyEntries,
  type BotInput,
} from "@/lib/enigma/entries";
import { cleanName, formatDateBR, merchantOf } from "@/lib/enigma/logic";
import { formatPersonName } from "@/lib/enigma/input-format";
import { report } from "@/lib/enigma/feedback";
import { repo } from "@/lib/enigma/repo";
import {
  BOT_CLOSE_TIME,
  type AppState,
  type BotOutcome,
  type BotSituation,
} from "@/lib/enigma/types";

const WINDOW_SHORT = {
  antes: "antes das 19h",
  encerrada: "depois das 19h29",
  "fora-do-dia": "fora de segunda a sexta",
} as const;

const field =
  "h-12 w-full min-w-0 rounded-xl border-2 border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-hidden";

/**
 * "Testar entrada pelo bot": fills the chosen draw's Nomes list as a bot would.
 * Nothing is sent or received; the messages exist only on this phone.
 */
export function BotTestCard({ state }: { state: AppState }) {
  const open = state.draws.filter((d) => !d.result);
  const [drawId, setDrawId] = useState(() =>
    open.some((d) => d.id === state.currentId) ? state.currentId : (open[0]?.id ?? ""),
  );
  const [name, setName] = useState("");
  const [senderId, setSenderId] = useState("Teste 001");
  const [time, setTime] = useState("19:29");
  const [eventId, setEventId] = useState("Evento 001");
  const [day, setDay] = useState("");
  const [situation, setSituation] = useState<BotSituation>("acertou");
  const [last, setLast] = useState<BotInput | null>(null);
  const [feedback, setFeedback] = useState<{
    outcome: BotOutcome;
    matchName?: string;
    name: string;
  } | null>(null);

  const draw = open.find((d) => d.id === drawId) ?? open[0];
  useEffect(() => {
    if (draw && draw.id !== drawId) setDrawId(draw.id);
  }, [draw, drawId]);

  if (!draw) {
    return (
      <Card>
        <p className="mt-2 text-sm text-muted-foreground">
          Todos os sorteios já foram girados. Crie um novo sorteio para testar.
        </p>
      </Card>
    );
  }

  const entries = entriesOf(draw);
  const ready = readyEntries(entries).length;
  const pending = pendingEntries(entries).length;
  const validTime = cleanTime(time);
  const canSend = !!cleanName(name) && !!cleanName(senderId) && !!validTime;

  const send = async (input: BotInput) => {
    const r = await repo.simulateBot(draw.id, input, Date.now());
    if (!report(r)) return false;
    setLast(input);
    setFeedback({ ...r.value, name: cleanName(input.name) });
    return true;
  };

  const submit = async () => {
    if (!canSend || !validTime) return;
    const d = day || draw.date;
    if (!(await send({ name: formatPersonName(name), senderId, time: validTime, situation, eventId, day: d }))) return;
    const ev = /^(.*?)(\d+)$/.exec(cleanName(eventId));
    if (ev)
      setEventId(`${ev[1] ?? ""}${String(Number(ev[2]) + 1).padStart(ev[2]?.length ?? 3, "0")}`);
    // Next fictitious sender, so a new message is a new person unless "Repetir" is used.
    const m = /^(.*?)(\d+)$/.exec(cleanName(senderId));
    if (m) setSenderId(`${m[1] ?? ""}${String(Number(m[2]) + 1).padStart(m[2]?.length ?? 3, "0")}`);
    setName("");
  };

  const log = [...(draw.botMessages ?? [])].reverse().slice(0, 8);
  const isCurrent = draw.id === state.currentId;

  return (
    <Card>
      <p className="mt-1 text-sm text-muted-foreground">
        Simula uma mensagem que o bot receberia. Nada é enviado nem recebido de verdade.
      </p>

      <label className="mt-3 block text-sm font-bold">
        Sorteio
        <select
          value={draw.id}
          onChange={(e) => {
            setDrawId(e.target.value);
            setFeedback(null);
            setLast(null);
          }}
          className={`${field} mt-1`}
        >
          {open.map((d) => (
            <option key={d.id} value={d.id}>
              {formatDateBR(d.date)} · {merchantOf(state.merchants, d).name}
              {d.id === state.currentId ? " (na roleta)" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Lista deste sorteio: {ready} {ready === 1 ? "pronta" : "prontas"}
        {pending > 0 ? ` · ${pending} para conferir` : ""}
      </p>

      <label className="mt-3 block text-sm font-bold">
        Nome na mensagem
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => setName(formatPersonName(e.target.value))}
          autoCapitalize="words"
          placeholder="Ex.: Carla Mendes"
          className={`${field} mt-1`}
          autoComplete="off"
        />
      </label>

      <label className="mt-3 block text-sm font-bold">
        Identificação fictícia
        <input
          value={senderId}
          onChange={(e) => setSenderId(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
          className={`${field} mt-1`}
          autoComplete="off"
        />
      </label>

      <div className="mt-3">
        <label className="block text-sm font-bold" htmlFor="bot-time">
          Horário (Jacarezinho)
        </label>
        <input
          id="bot-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={`${field} mt-1`}
        />
        <div className="mt-1 grid grid-cols-5 gap-1">
          {["18:59", "19:00", "19:29", "19:30"].map((t) => (
            <button
              key={t}
              onClick={() => setTime(t)}
              className={`h-12 rounded-xl px-2 text-sm font-bold ${time === t ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setTime(jacarezinhoTime())}
            className="h-12 rounded-xl bg-secondary px-2 text-sm font-bold"
          >
            Agora
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-sm font-bold">
          ID do evento
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            autoCapitalize="none"
            spellCheck={false}
            className={`${field} mt-1`}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm font-bold">
          Dia que chegou
          <input
            type="date"
            value={day || draw.date}
            onChange={(e) => setDay(e.target.value)}
            className={`${field} mt-1 [color-scheme:dark]`}
          />
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="text-sm font-bold">Situação</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(
            [
              ["acertou", "Acertou"],
              ["conferir", "A conferir"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSituation(id)}
              aria-pressed={situation === id}
              className={`h-12 rounded-xl text-base font-bold ${situation === id ? "bg-primary text-primary-foreground ring-2 ring-gold" : "bg-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        onClick={submit}
        disabled={!canSend}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-gold bg-secondary text-base font-extrabold active:bg-accent disabled:opacity-50"
      >
        <Bot className="h-5 w-5 text-gold" aria-hidden="true" /> Simular mensagem
      </button>
      {last && (
        <button
          onClick={() => send(last)}
          className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-gold active:bg-secondary"
        >
          <Repeat className="h-4 w-4" aria-hidden="true" /> Repetir a última mensagem
        </button>
      )}

      <p className="mt-2 min-h-5 text-sm font-bold" role="status" data-testid="bot-feedback">
        {feedback &&
          `${feedback.name}: ${BOT_OUTCOME_LABEL[feedback.outcome]}${
            feedback.outcome === "revisao" && feedback.matchName
              ? ` (parecido com “${feedback.matchName}”)`
              : ""
          }.`}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        Recebe de segunda a sexta, das 19h00 às 19h29; às {BOT_CLOSE_TIME} já está encerrado.
        Repetir o mesmo ID do evento não cria outra inscrição. O que chegou antes pode ser conferido
        depois, e você continua podendo digitar quem acertou no prazo, na aba Nomes.
      </p>

      {log.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-bold">Mensagens simuladas deste sorteio</p>
          <ul className="mt-1 space-y-1">
            {log.map((m) => (
              <li key={m.id} className="rounded-lg bg-secondary/50 px-3 py-1.5 text-xs">
                <span className="font-bold">
                  {m.time} · {m.name}
                </span>{" "}
                {m.eventId && <span className="text-muted-foreground">[{m.eventId}] </span>}
                <span className="text-muted-foreground">
                  ({m.senderId}, {m.situation === "acertou" ? "Acertou" : "A conferir"})
                </span>
                <span className="block text-muted-foreground">
                  {BOT_OUTCOME_LABEL[m.outcome]}
                  {m.window && m.window !== "aberta" ? ` · ${WINDOW_SHORT[m.window]}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link
        to="/nomes"
        onClick={() => {
          if (!isCurrent) void repo.selectDraw(draw.id).then((r) => report(r));
        }}
        className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-secondary text-sm font-bold active:bg-accent"
      >
        {isCurrent ? "Ver a lista em Nomes" : "Abrir este sorteio em Nomes"}
      </Link>
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4" aria-labelledby="bot-test-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="bot-test-title" className="flex items-center gap-2 text-xl font-bold">
          <Bot className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" /> Testar entrada pelo bot
        </h2>
        <span className="shrink-0 rounded-full border border-gold px-2 py-0.5 text-[10px] font-bold text-gold">
          Demonstração
        </span>
      </div>
      {children}
    </section>
  );
}
