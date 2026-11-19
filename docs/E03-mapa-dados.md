# E03 revisada — Mapa entre os dados locais e o futuro banco

Base: revisão `18d7b1f` (E02). Nesta etapa o app continua só com o adaptador local (`repo.ts` → `store.ts`). Não há banco, login nem Lovable Cloud ativos.

> Login, permissões por grupo e giro simultâneo em dois aparelhos **dependem de validação futura com o banco** (E04/E05). Nada disso foi testado aqui.

## 1. Onde cada dado está hoje

- Dados: `localStorage["enigma-premiado:v1"]`, um JSON `AppState` (`version: 1`).
- Vídeos: IndexedDB do navegador (`videos.ts`), chave = `Recording.id`.

## 2. Mapa local → banco

| Local (`AppState`) | Tabela proposta | Chave no banco | Observação para importar |
| --- | --- | --- | --- |
| (o próprio aparelho) | `groups` | `id` novo | Um grupo "COLETIVIDADE JACAREZINHO PR"; tudo importado recebe `group_id` |
| `groupLogo` | `groups.logo_path` (arquivo) | — | Data URL → arquivo no armazenamento |
| `sound` | `admin_preferences` | `user_id` | Preferência pessoal, não do grupo |
| `merchants[]` | `merchants` | `id` = `merchant.id` | Reaproveitar o id local garante que reimportar não duplique |
| `draws[]` (não ensaio) | `draws` | `id` = `draw.id` | `date`, `confirmed`, `repeat_winners`, `shown_round`, `created_at` |
| `draws[]` com `isSample` | não importar (ou `draws.is_rehearsal = true`) | — | Ensaios nunca entram no histórico oficial nem no Listão |
| Cortesia 1 (`draw.merchantId/merchant/prize/result`) | `prizes` com `position = 1` | **`id` derivado**: `<draw.id>:1` ou UUID v5 de `draw.id` | Localmente a cortesia 1 usa o próprio `draw.id` como `roundId`; no banco ela precisa de id próprio, sempre derivado de forma determinística |
| `draw.extraPrizes[i]` | `prizes` com `position = i + 2` | `id` = `prize.id` | `merchant_id` = `prize.merchantId`; sem `merchantId`, guardar `merchant_name_legacy` |
| `draw.entries[]` | `entries` | `id` = `entry.id` | `draw_id`, `name`, `source`, `status`, `reason`, `sender_ids`, `bot_time` |
| `draw.names[]` (lista confirmada) | `approved_lists` + `approved_list_items` | item: (`list_id`, `position`) único | Cada item aponta para `entry_id` (achado pelo nome entre as inscrições prontas; nomes prontos são únicos no sorteio) e guarda o nome exibido |
| `result` / `extraPrizes[i].result` | `results` | **único por `prize_id`** | `winner_entry_id` = `result.entryId` (ou buscado pelo nome em resultados antigos); `winner_name`, `wheel_index`, `rotation`, `drawn_at` |
| `draw.recordings[]` | `media` | `id` = `recording.id` | `draw_id`, `mode`, `mime_type`, `size`, `duration_ms`, `rounds`; `storage_path` só depois de enviar o vídeo do IndexedDB |
| `draw.botMessages[]` | `bot_messages` (simulação) | `id` | Opcional: são só testes |

## 3. Como importar sem duplicar nem trocar vencedores

1. **IDs estáveis:** usar os ids locais como chave primária (e o id derivado para a cortesia 1). Gravar com "inserir se não existir" (`ON CONFLICT (id) DO NOTHING`); reimportar o mesmo arquivo não cria nada novo.
2. **Ordem:** grupo → comércios → sorteios → cortesias → inscrições → lista aprovada → resultados → mídia. Tudo de um sorteio numa transação.
3. **Vencedor na cortesia certa:** o resultado é ligado pelo **id da cortesia** (posição 1 = campos do próprio sorteio, posição *n* = `extraPrizes[n-2]`), nunca pela empresa ou pela data. Dois prêmios da mesma empresa e dois sorteios no mesmo dia têm ids diferentes (verificado abaixo).
4. **Vencedor na inscrição certa:** usar `result.entryId` quando existir. Em resultados antigos, procurar a inscrição pronta com exatamente o mesmo nome exibido; se não houver exatamente uma, importar o resultado com `winner_entry_id` vazio e marcar "a conferir", sem adivinhar.
5. **Conferência no banco:** `results.winner_entry_id` precisa estar na lista aprovada do mesmo sorteio; um resultado por cortesia.
6. **Nada se perde:** guardar o JSON original do aparelho como cópia (a mesma da tela de recuperação da E01). O que não puder ser associado com segurança fica nessa cópia e numa lista "a conferir".
7. **Vídeos:** enviados um a um do IndexedDB; a referência em `media` só ganha `storage_path` depois do envio confirmado.

## 4. Pendentes (decisões da administradora)
Seguem as regras atuais até a decisão (ver também `docs/E02-persistencia.md`, seção 6):
1. Zero ou um elegível (hoje: mínimo de 2 nomes).
2. Confirmação individual de cada cortesia e efeito no Listão.
3. Cancelamento e adiamento.
4. Prazo para retirada e regra de novo sorteio.
5. Acesso de ajudantes e tempo de guarda dos dados.
6. Canal do bot e mensagens editadas.
7. Importar ou descartar os ensaios.

## 5. Relatório de testes (E03 revisada)

Navegador de teste separado (Chromium sem histórico, 360 × 740), com dados fictícios; os dados reais do seu navegador não foram tocados.

| Cenário | Resultado |
| --- | --- |
| Ensaio pelo primeiro acesso, separado do histórico ("Ensaios") | passou |
| Cadastrar 2 comércios (Burger 7, Padaria Pão de Ouro) | passou |
| Sorteio com 3 cortesias: Burger 7, Padaria, Burger 7 de novo; "não repetir ganhador" | passou |
| Colar 5 nomes com homônimos distinguíveis ("Ana Souza", "Ana Souza (Centro)") e confirmar | passou |
| Girar as 3 cortesias → Diego Reis, Carla Dias, Ana Souza (Centro), todos diferentes | passou |
| Recarregar a página → os mesmos 3 vencedores | passou |
| Segundo sorteio na mesma data (Padaria, 1 cortesia) → Fábio Melo; o primeiro não mudou | passou |
| 5 cortesias, 5 ids diferentes; ids de comércio distintos | passou |
| Cada vencedor ligado à inscrição certa (`entryId` → mesmo nome) | passou |
| Login, permissões por grupo, giro simultâneo em dois aparelhos | não verificado — dependem do banco (E04) |
