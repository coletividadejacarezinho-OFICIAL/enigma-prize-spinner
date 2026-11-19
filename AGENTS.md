<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (Enigma Premiado)

- Data lives in browser localStorage (local adapter `store.ts`); no database/auth/external services yet — owner's choice.
- Pure draw rules (wheel angle math, duplicates, date format, new-round defaults) live in `src/lib/enigma/logic.ts` with tests in `src/test/enigma-logic.test.ts`; keep UI files free of that logic so it stays testable.
- A spin saves its result (winner, index, final rotation) before the animation starts, so reloads, tab changes and double taps can never change the winner; a new spin only happens through a new round.
- Screens persist only via `repo` (`repo.ts`, typed results, `report()`); `store.ts` is the local adapter. Refused save = no screen change, input kept; wheel turns after `repo.spin`. See docs/E02-persistencia.md; local→DB map docs/E03-mapa-dados.md.
- Wheel angles run clockwise from the top pointer; `targetRotation` and `segmentAtPointer` must stay inverse of each other.
- Picked images are shrunk to small data URLs before saving, to stay within localStorage limits.
- The app is phone-first: content sits in a `max-w-md` column with a fixed four-tab bottom bar from `__root.tsx`; every screen must fit 360 × 740.
- Partner shops are records in `state.merchants`; a draw links one by `merchantId` and keeps its own date and courtesy. Always show a draw's shop through `merchantOf()` so renamed shops and new logos reach the wheel; `migrateState()` upgrades older saved data on read.
- The Listão da Alegria is computed only by `buildListao()` (confirmed, non-test draws; LISTAO_DAYS inclusive from the latest arrived date; future dates scheduled), and both the Sorteios card count and the list use that same result so they can never disagree.
- "Cadastrar agora" dialog sits outside the draw `<form>` (submit bubbles through portals).
- Real recording lives in `src/lib/enigma/recorder.ts` (modes in E07, see its folder AGENTS.md): devices asked only after "Gravar comigo" and only those the mode needs; the Roleta pushes what is on screen with `setRecFrame()` and the module paints wheel, prize, winner and a mirrored face circle (bottom right, never over prize or winner) on a canvas recorded with the voice. Videos are kept in IndexedDB (`videos.ts`), metadata in the draw's `recordings` with `real: true`; older simulated recordings stay readable.
- The WhatsApp result message comes only from `resultMessage()` (null without a saved result) and opens through `whatsappLink()` (wa.me with prefilled text) inside `ResultShareDialog`; the app never claims a message was sent, only that it was copied.
- Tapping a draw in Sorteios opens `/sorteios/ver/$drawId`, which never changes the current round; only its "Abrir na roleta" button calls `setCurrent()`.
- Installability is manifest-only (`public/manifest.webmanifest` + CJ PNG icons, head links in `__root.tsx`); no service worker until offline use is requested. Install UI decisions live in the pure `installView()` in `src/lib/enigma/install.ts` (tested); `initInstallPrompt()` runs once from `__root.tsx` to keep the browser's install offer.
- Roleta full screen is the in-memory flag in `src/lib/enigma/presentation.ts` (hides the tabs from `__root.tsx`); it only changes what surrounds the same mounted `<Wheel>`, so a spin in progress survives toggling. It also asks for the device's full screen when allowed and leaves when the device exits it.
- Manifest `display: "fullscreen"` (fallback standalone) draws under notch/gesture bar, so `__root.tsx` pads with `env(safe-area-inset-*)` (Roleta full screen pads itself) and bars fixed above the tabs sit at `4rem + safe-area-inset-bottom`.
- Stage 7 list rules (entries, duplicates, pending review, bot simulation, 19:30 window, group list message) live in the pure `src/lib/enigma/entries.ts`, tested in `src/test/enigma-entries.test.ts`.
- `draw.entries` is the working Nomes list; `draw.names` is the confirmed list and the only source for the wheel, the spin and `listMessage()`. `needsConfirmation()` compares them and blocks the spin until `confirmList()`; a spun draw never changes `names`.
- Ready entries never share a display name (`sameNameEntry`); a repeated name becomes a question or a pending entry, never a silent delete. Bot dedup is by sender id kept in `senderIds`, merged by `mergeEntry()`.
- Bot times are local "HH:MM" strings vs `BOT_CLOSE_TIME`; the bot test is simulation only.

- Several courtesies (stage 8): the first stays in the draw's own merchant/prize/result fields, the rest in `extraPrizes`; read them only through `roundsOf()` in `src/lib/enigma/rounds.ts` (tested in `src/test/enigma-rounds.test.ts`). Rounds are spun in order, so `draw.result` set still means "list locked".
- Each round's wheel comes from `poolFor()` (earlier winners removed when `repeatWinners === false`); results are saved with `withRoundResult()` and the Roleta moves on only via `nextRound()`. The WhatsApp result for any draw comes from `drawResultMessage()`.
- Rules for `src/lib/enigma` modules (backup, share-as-image) live in its own AGENTS.md.

- "Nova rodada" has no riddle/answer text inputs: only the optional, closed-by-default "Anexar artes da rodada" with two ready images (arts are made outside the app); older saved riddle text stays untouched.
- P1 partner shops (simulation only): pure rules in `src/lib/enigma/partners.ts` (tested in `enigma-partners.test.ts`); invites, simulated accounts, offers and winner notices live in their own localStorage key (`partners-store.ts`, `enigma-premiado:p1-ensaio`) so they never mix with draws. Admin selects one or more pending offers: `draftFromOffers()` makes one draft (order = selection) or `appendOffers()` adds them after existing prizes (explicit link skips one). Draw/prize ids derive from the offer id (`rd-`/`of-`/`mc-`) and `placementOf()` finds saved ones, so double taps and retries after a partial failure never duplicate; an offer leaves "Ofertas recebidas" only once its link is saved; "retirado" reuses `markDelivered`.
