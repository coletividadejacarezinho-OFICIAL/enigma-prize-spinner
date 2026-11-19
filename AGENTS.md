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

- All app data lives in the browser's localStorage via `src/lib/enigma/store.ts` (useSyncExternalStore, null on the server); no database, auth or external services in this stage — the owner asked for local-only data.
- Pure draw rules (wheel angle math, duplicates, date format, new-round defaults) live in `src/lib/enigma/logic.ts` with tests in `src/test/enigma-logic.test.ts`; keep UI files free of that logic so it stays testable.
- A spin saves its result (winner, index, final rotation) before the animation starts, so reloads, tab changes and double taps can never change the winner; a new spin only happens through a new round.
- Wheel angles run clockwise from the top pointer; `targetRotation` and `segmentAtPointer` must stay inverse of each other.
- Picked images are shrunk to small data URLs before saving, to stay within localStorage limits.
- The app is phone-first: content sits in a `max-w-md` column with a fixed four-tab bottom bar from `__root.tsx`; every screen must fit 360 × 740.
- Partner shops are records in `state.merchants`; a draw links one by `merchantId` and keeps its own date and courtesy. Always show a draw's shop through `merchantOf()` so renamed shops and new logos reach the wheel; `migrateState()` upgrades older saved data on read.
- The Listão da Alegria is computed only by `buildListao()` (confirmed, non-test draws; LISTAO_DAYS inclusive from the latest arrived date; future dates scheduled), and both the Sorteios card count and the list use that same result so they can never disagree.
- The "Cadastrar agora" dialog sits outside the draw `<form>`: React submit events bubble through portals.
- Test recordings are simulated: `state.recording` holds the running session so tab switches keep the timer, and `endRecording()` files it under the draw's `recordings`. Never call getUserMedia or offer a download until real recording is requested; switching the current round ends a running test.
- The WhatsApp result message comes only from `resultMessage()` (null without a saved result) and opens through `whatsappLink()` (wa.me with prefilled text) inside `ResultShareDialog`; the app never claims a message was sent, only that it was copied.
- Tapping a draw in Sorteios opens `/sorteios/ver/$drawId`, which never changes the current round; only its "Abrir na roleta" button calls `setCurrent()`.
