# E09 — Roteiro de homologação no celular

Prévia de teste (HTTPS, separada da operação oficial): https://id-preview--3b0e853e-4bc9-4b79-b61a-42df54f20ae1.lovable.app
Revisão testada: d56eeaf (E08). Use somente dados fictícios. Nada vai para a internet: tudo fica no aparelho.

Situação: Aprovado = conferido aqui · Falhou · Pendente no aparelho real = só a administradora pode conferir.
Simulação em tela pequena não conta como teste em celular.

## Verificações automáticas
| Item | Resultado |
|---|---|
| Compilação | Aprovado |
| Checagem de TypeScript | Aprovado |
| Suíte completa (118 testes) | Aprovado |

## Anote o aparelho
Aparelho: ______  Sistema: ______  Navegador: ______  (faça primeiro no Android do dia a dia; repita no iPhone em outra coluna)

## Roteiro
| # | O que tocar | Resultado esperado | Android | iPhone |
|---|---|---|---|---|
| 1 | Abra o endereço → menu do navegador → "Instalar app" / "Adicionar à tela inicial" | Ícone CJ na tela inicial; abre em tela cheia | Pendente no aparelho real | Pendente no aparelho real |
| 2 | Sorteios → "Novo sorteio" → data, empresa e cortesia → "Adicionar outra cortesia" (outra empresa) → no fim, abra "Anexar artes da rodada (opcional)" e escolha as 2 imagens prontas da galeria (ou pule) → "Salvar rascunho" | Rascunho aparece na agenda com o próximo passo | Pendente no aparelho real | Pendente no aparelho real |
| 3 | Confira o horário mostrado em Sorteios | Igual ao relógio de Jacarezinho; 19:00–19:29 "aberta" | Pendente no aparelho real | Pendente no aparelho real |
| 4 | Abra o rascunho → "Ir para os nomes" → digite 3 nomes → "Confirmar lista" → Roleta → girar as 2 cortesias (Ajustes: Ferramentas de demonstração desligado) | Dois ganhadores diferentes, salvos | Pendente no aparelho real | Pendente no aparelho real |
| 5 | As artes são feitas no ChatGPT e publicadas à mão no WhatsApp. No app, confira em Sorteios → a rodada: cada ganhador com o prêmio e a empresa certos | Cada cortesia mostra seu ganhador, prêmio e empresa; a rodada termina quando o último resultado é salvo | Pendente no aparelho real | Pendente no aparelho real |
| 6 | Ensaio com 250 nomes → "Ver lista numerada" → busque 250 → girar | Nº 250 encontrado; marcações legíveis; giro fluido; trilha toca | Pendente no aparelho real | Pendente no aparelho real |
| 7 | Ajustes → Som: volume, "Sem som"; ligar "Reduzir movimento" no celular | Volume muda; sem som não toca; giro curto | Pendente no aparelho real | Pendente no aparelho real |
| 8 | Roleta → "Gravar comigo" → "Roleta com meu rosto" → girar → abrir gravação em Sorteios | Rosto, ponteiro, ganhador e voz claros e sincronizados | Pendente no aparelho real | Pendente no aparelho real |
| 9 | Negar câmera, depois microfone | Aparecem outras opções e "Continuar sem gravar"; sorteio continua | Pendente no aparelho real | Pendente no aparelho real |
| 10 | "Salvar vídeo" → abrir na galeria → enviar no WhatsApp | Arquivo toca e envia | Pendente no aparelho real | Pendente no aparelho real |
| 11 | Sorteio → "Marcar entregue" em 1 cortesia → fechar e reabrir o app | Uma entregue, outra pendente | Pendente no aparelho real | Pendente no aparelho real |
| 12 | Com o app aberto, modo avião | Aviso "sem internet"; nomes, roleta e entrega continuam | Pendente no aparelho real | Pendente no aparelho real |
| 13 | Fechar o app em modo avião e abrir de novo | Esperado: NÃO abre (ainda não há uso sem internet) — registrar | Pendente no aparelho real | Pendente no aparelho real |

## Cópia, restauração e retorno de versão
| # | O que tocar | Resultado esperado | Android | iPhone |
|---|---|---|---|---|
| 14 | Ajustes → "Baixar cópia de segurança" | ZIP baixado; anote tamanho e tempo | Pendente no aparelho real | Pendente no aparelho real |
| 15 | Em outro navegador/aba anônima: Ajustes → "Restaurar cópia" → escolha o ZIP → "Confirmar e restaurar" | Fotos, nomes, ganhadores, entregas e gravações iguais | Pendente no aparelho real | Pendente no aparelho real |
| 16 | Interrupção e falha de armazenamento | Conferidos no navegador do computador na E05 (dados preservados); repetir só em ambiente de teste | Aprovado (computador) / Pendente no aparelho real | Pendente no aparelho real |
| 17 | Retorno de versão: no histórico do Lovable, abra numa prévia separada a revisão estável anterior **ac640a0 / 3618e67 (E07)** e restaure a cópia | A E07 abre cópias formato v1. Campos da E08 (enigma, entregas, rascunho) não aparecem nela; caminho seguro: não salvar nada na versão antiga e voltar para d56eeaf, onde a mesma cópia restaura completa | Pendente no aparelho real | Pendente no aparelho real |

Nunca restaure ou teste por cima dos dados reais da administradora: use aba anônima ou outro navegador.

## Rodada sem imagens (conferido no navegador do computador)
| Cenário | Resultado |
|---|---|
| Nova rodada com 2 empresas, 2 cortesias, nenhuma imagem anexada → nomes → girar as duas | Aprovado (computador) / Pendente no aparelho real |

## Falhas encontradas
Nenhuma falha reproduzida nesta etapa; nenhum código mudou.
