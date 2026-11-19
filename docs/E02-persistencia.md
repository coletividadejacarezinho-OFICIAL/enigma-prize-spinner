# E02 — Contrato de persistência do Enigma Premiado

Revisão base: `bdb505e` (E01). Armazenamento desta etapa: navegador (localStorage para dados, IndexedDB para vídeos).

## 1. Mapa do fluxo atual

| Tela / componente | Lê | Grava (operação do contrato) |
| --- | --- | --- |
| `__root.tsx` | `useSnapshot` (abrindo / ilegível / vazio) | — |
| `FirstRun` | — | `startRehearsal` |
| `DataRecovery` | `rawCopy` | `reload` (nunca grava) |
| Roleta `routes/index.tsx` | `useAppState`, `currentDraw` | `spin`, `nextRound`, `addRecording`, `closeLegacyTest` |
| Nomes `routes/nomes.tsx` | `useAppState`, `currentDraw` | `changeEntries`, `confirmList` |
| `BotTestCard` (Ajustes) | estado | `simulateBot`, `selectDraw` |
| Ajustes | estado | `setPreferences` (som, logo do grupo) |
| Sorteios / Listão / ver sorteio / gravação | estado | `selectDraw` ("Abrir na roleta") |
| Novo / editar sorteio | estado | `createDraw`, `editDraw` |
| Comércios (novo, editar, cadastro rápido no `DrawForm`) | estado | `saveMerchant` |
| Vídeos (`videos.ts`) | IndexedDB | `saveVideo` — continua no armazenamento atual |

Acessos diretos ao navegador: `store.ts` (localStorage, só usado pelo adaptador), `videos.ts` (IndexedDB), `watch.ts` (canal local da visão do público). Nenhuma tela chama `store.ts` diretamente.

## 2. Contrato (`src/lib/enigma/repo.ts`)

Todas as operações são assíncronas e devolvem `{ ok: true, value } | { ok: false, error, message }`:

- `read`: os dados existem mas não puderam ser lidos (tela de recuperação da E01, cópia intacta).
- `write`: o navegador recusou salvar; nada muda na tela e o texto digitado fica.
- `unavailable`: a ação precisa de conexão (hoje: abrir o WhatsApp sem internet).
- `conflict`: o sorteio, a lista ou a cortesia mudou desde que a tela foi mostrada; os dados são recarregados e nada é salvo.

O adaptador ativo fica em `repo` (`setRepo` troca). Telas usam `report()` (`feedback.ts`) para mostrar a mensagem com "Tentar novamente".

### Identidade por ID
- Sorteio: `draw.id`. Cortesia: `roundId` = `draw.id` para a primeira, `prize.id` para as seguintes (`roundIdOf` / `roundIndexOf`). Dois sorteios na mesma data ou dois prêmios da mesma empresa nunca se confundem.
- Inscrição: `entry.id`. Nomes prontos nunca têm o mesmo nome de exibição (`sameNameEntry`), então homônimos ficam distinguíveis ("Ana" e "Ana (Centro)").
- Resultado: novo campo `entryId` (o vencedor). Resultados antigos têm só o nome e continuam válidos, porque a lista aprovada não tem nomes repetidos.
- Retirar vencedores anteriores (`poolFor`): hoje retira uma vaga por vitória, pelo nome. No banco, deve retirar por `entryId` quando existir, e pelo nome apenas em resultados antigos.
- Dados antigos que não podem ser associados com segurança (sem `merchantId`, sem `entryId`) ficam como estão e continuam legíveis; dados ilegíveis ficam intactos com cópia para download.

### Giro
`spin` confere sorteio, cortesia mostrada, lista confirmada e roleta exibida; salva o resultado (com a resposta de "repetir vencedores", na primeira vez) e só então a roleta gira. Se a cortesia já tem resultado, ele é devolvido (`already`) e nada novo é sorteado.

### Concorrência que depende do futuro servidor
- Dois aparelhos girando a mesma cortesia ao mesmo tempo: hoje só há proteção entre abas do mesmo navegador (evento `storage` + conferência no `spin`). O servidor precisa de gravação condicional (resultado só se vazio) numa transação.
- Edição da lista em um aparelho enquanto outro confirma: precisa de versão por sorteio (`updated_at`/`version`) comparada na gravação.
- Bot recebendo mensagens enquanto a administradora edita: precisa de fila no servidor.
- Vídeos: ficam só no aparelho que gravou até existir armazenamento de arquivos.

## 3. Estados da tela
- Abrindo: "Abrindo o Enigma Premiado…", sem abas nem ações.
- Primeiro acesso: "Criar meu primeiro sorteio" e, separado, "Fazer um ensaio". O ensaio aparece em Sorteios na seção "Ensaios", fora do histórico oficial e do Listão.
- Erro de leitura: tela de recuperação (E01). Erro de gravação: aviso com "Tentar novamente", texto preservado.
- Sem internet: aviso fixo; sorteio, lista e giro continuam; "Abrir WhatsApp" avisa que precisa de conexão (copiar continua).
- Conflito: "A lista ou a cortesia mudou. Os dados foram recarregados: confira antes de girar."

## 4. Estados do sorteio

```text
 [Rascunho] --empresa confirma--> [Lista aberta] --confirmar lista--> [Lista confirmada]
     |                                 ^   |                              |   |
     |                                 |   +--mudar nomes-----------------+   |
     |                                 +------(lista muda: confirmar de novo) |
     |                                                                        v
     |                                          girar (salvo antes de animar) |
     |                                                                        v
     |                     [Cortesia 1 sorteada] --próxima cortesia--> [Cortesia N sorteada]
     |                                                                        |
     +------------------------------------------------------------- [Concluído (somente leitura)]

 [Ensaio] = mesmo fluxo, marcado isSample, fora do histórico oficial e do Listão.
```

## 5. Dicionário de dados

Legenda: **I** = já implementado; **P** = proposto para o banco (E03).

| Entidade | Campos | ID / vínculos | Regras |
| --- | --- | --- | --- |
| Sorteio (`Draw`) | `date` (AAAA-MM-DD), `confirmed`, `names`, `entries`, `repeatWinners`, `shownRound`, `isSample`, `createdAt` | `id`; primeira cortesia nos próprios campos | I: data obrigatória; só confirmados e não-ensaio entram no Listão; com resultado, lista bloqueada. P: `group_id`, `version`, `status` explícito |
| Cortesia (`Prize` / primeira) | `merchantId`, `merchant` (cópia), `prize`, `result` | `roundId` (= `draw.id` ou `prize.id`) | I: giradas em ordem; um vencedor cada; resposta "repetir" antes do 1º giro com 2+. P: tabela própria com `position` e `draw_id` |
| Comércio (`Merchant`) | `name`, `logo` (data URL pequena), `createdAt` | `id`; sorteios por `merchantId` | I: nome sem duplicar (sem acento/maiúscula). P: logo em armazenamento de arquivos |
| Inscrição (`Entry`) | `name`, `source`, `status`, `reason`, `senderIds`, `botTime`, `botSituation`, `addedAt` | `id`; pertence ao sorteio | I: nomes prontos únicos; repetido vira pergunta ou pendência; bot deduplica por `senderIds`; prazo 19:30. P: tabela com `draw_id`, `sender_id` indexado |
| Lista aprovada | `names` (ordem = roleta) | sorteio | I: só muda por `confirmList`; nunca depois do giro. P: guardar `entry_id` + posição |
| Resultado (`DrawResult`) | `winner`, `index`, `rotation`, `at`, `entryId` | cortesia; `entryId` → inscrição | I: salvo antes da animação; definitivo. P: único por cortesia (restrição no banco) |
| Mídia (`Recording` + vídeo) | `mode`, `mic`, `startedAt`, `durationMs`, `real`, `mimeType`, `size`, `rounds` | `id` = chave no IndexedDB; sorteio | I: vídeo só no aparelho. P: arquivo em armazenamento, retenção definida |

## 6. Decisões em aberto da administradora
As regras atuais continuam valendo até cada decisão.
1. Zero ou um elegível: hoje a roleta exige 2 nomes.
2. Confirmação individual de cada cortesia e efeito no Listão: hoje a confirmação é do sorteio inteiro.
3. Cancelamento e adiamento de sorteio: hoje não existem.
4. Prazo para retirar o prêmio e regra de novo sorteio: hoje o resultado é definitivo.
5. Acesso de ajudantes e tempo de guarda dos dados: hoje um único aparelho, dados sem prazo.
6. Canal do bot e tratamento de mensagens editadas: hoje só simulação, sem edição.
