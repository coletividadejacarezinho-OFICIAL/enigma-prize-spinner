# Rodada completa (E08)

- **Rascunho:** "Nova rodada" aceita data, enigma, imagem do enigma, resposta, imagem da resposta e cortesias. "Salvar rascunho" (`draft: true`) só exige data e cortesias; o rascunho não vai para a Roleta até "Lançar rodada" (`repo.launchDraft`). Retomar: tocar no rascunho em Sorteios.
- **Modelo:** "Usar como modelo" (`fromTemplate` em `src/lib/enigma/agenda.ts`) cria um sorteio novo, com IDs novos, só com cortesias e comércios. Não copia nomes, ganhadores, gravações, entregas, enigma nem a confirmação do comércio.
- **Agenda:** Sorteios lista por data (mais nova primeiro), com o estado e o próximo passo de cada rodada (`roundStage`). Vários sorteios na mesma data continuam separados.
- **Horário:** segunda a sexta, 19h00 a 19h29 em Jacarezinho; 19h30 já está encerrado (`windowState`). O palpite guarda dia e hora em que chegou (`botDay`, `botTime`); a conferência da administradora guarda `checkedAt`. Cadastro à mão continua sempre disponível.
- **Artes do enigma:** "Arte do enigma" nunca leva a resposta nem a imagem dela; "Arte da resposta" é separada, com a resposta em destaque (`riddleCardData`). Compartilhamento usa o mesmo diálogo de imagens: a administradora escolhe quando e para quem mandar.
- **Entrega:** cada cortesia sorteada tem "Marcar entregue", que grava data e hora (`deliveries`). Não muda o ganhador nem as outras cortesias; uma vez marcada fica com o primeiro horário.
- **Demonstração isolada:** simulador do bot, convite de exemplo e "Quem acompanhou" (fictício) só aparecem com "Ferramentas de demonstração" ligadas em Ajustes (desligadas por padrão). Nenhum canal real; nada é enviado.
- **Evento simulado:** tem ID do evento, dia e horário. O mesmo ID de novo = "Mensagem repetida", sem nova inscrição. Política para mensagens editadas: em aberto.
- **Cópia de segurança:** formato v1 sem mudança. Enigma, imagens (data URLs pequenas) e entregas ficam dentro do próprio estado salvo, então entram no `copia.json` e voltam na restauração. ZIPs v1 antigos continuam sendo lidos.
- **Em aberto (não decidido):** zero ou um elegível, cancelamento, adiamento, prazo de retirada, novo sorteio e mensagens editadas. Um resultado salvo nunca é sobrescrito.
