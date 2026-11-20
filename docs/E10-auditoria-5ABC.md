# Auditoria das etapas 5A, 5B e 5C (20/11/2026)

## Versão conferida
- Lovable e `origin/main`: `e26b225b30554cbcb6add2fef99d25e4930d73e9` (5A `9a6b41d`, 5B `14298ec`, 5C `e26b225`).
- Publicação (enigma-prize-spinner.lovable.app): a página servida traz `data-commit-sha="e26b225…"`; os arquivos publicados contêm o resumo novo (5A), o selo do número na arte (5B) e a prévia com setas (5C).

## Testes
- Testes automáticos: 236/236 antes; 244/244 depois (8 novos). Build OK.
- Verificação de tipos: 2 erros em `src/test/enigma-summary-results.test.tsx` (vinham da 5A) — corrigidos.
- Navegador 360 × 740: sorteio com 3 cortesias de 3 comércios, resumo final, 4 artes (Resumo + Prêmio 1–3), navegação com setas e arrastar, resultados iguais antes e depois de abrir as artes e de recarregar.

## Onde falhava
1. Celular com o app instalado: a tela é só retomada, não recarregada, e continua com o código antigo depois de publicar. Não havia aviso de versão nova.
2. Com 3 cortesias cada arte é uma imagem só, então as setas da 5C nunca apareciam; a aba "Prêmio 3" ficava fora da tela em 360 px.

## O que foi corrigido
- Aviso "Versão nova do aplicativo · Atualizar" e cartão "Versão do aplicativo" em Ajustes (mostra a versão do aparelho e procura atualização).
- Setas/arrastar passam de uma arte para a outra; a aba escolhida rola para ficar visível.

## Outras telas conferidas
- Roleta (janela de resumo e artes): corrigida e testada.
- Sorteio salvo (Sorteios → abrir sorteio): ganhou a linha "Todas as N cortesias sorteadas" e logos inteiras; artes com as mesmas setas.
- Resumo desenhado na gravação: agora mostra o número público de cada ganhador (Nº X), como a janela e as artes.
- Lista de nomes, Listão e artes da rodada: usam a mesma prévia; as setas aparecem quando a arte tem várias imagens.
- Aviso de versão nova: aparece em todas as telas, inclusive Abertura, Recuperação de dados e Primeiro uso.
