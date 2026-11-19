# Revisão final do mock

Revisão realizada em 19/11/2026 sobre a versão principal `cf958884a6623677064646283672ca33c8d82e19`, com as correções desta etapa aplicadas em cópia isolada.

## Correções confirmadas por contraprova

| Caso | Resultado antes da correção | Resultado depois da correção |
| --- | --- | --- |
| Giro chamado diretamente com rascunho | Resultado aceito | Operação recusada |
| Primeiro prêmio com um único participante | Resultado aceito pelo contrato de dados | Operação recusada, preservando a regra de dois nomes no primeiro prêmio |
| Resultado com rotação não finita | Valor aceito e sujeito a perda na serialização JSON | Operação recusada |
| Registro de restauração danificado | Recuperação indicava ausência de operação pendente | Recuperação permanece bloqueada e conserva o registro |
| Snapshot danificado dentro do registro de restauração | Conteúdo não validado antes da retomada | Conteúdo recusado e dados atuais preservados |
| Segunda importação durante uma restauração | Nova tentativa podia continuar | Segunda operação recusada |

A tela de recuperação oferece a cópia de segurança dos dados disponíveis enquanto a recuperação permanece pendente. Registros danificados são preservados para análise, sem redefinição automática dos dados.

## Verificações automatizadas

| Verificação | Resultado |
| --- | --- |
| Suíte de testes | 178 testes passaram em 22 arquivos |
| TypeScript | Passou com `tsc --noEmit` |
| Compilação de produção | Passou com `npm run build` |
| ESLint com a regra de formatação desativada para isolar a análise funcional | Sem erros, com 9 avisos sobre exportações para atualização durante desenvolvimento |
| ESLint completo com a configuração do projeto | Continua apontando formatação em arquivos existentes; a última auditoria encontrou 558 ocorrências antes dos ajustes finais desta etapa |
| Manifesto e ícones obtidos do GitHub | PNGs válidos em 192 × 192, 512 × 512, máscara 512 × 512 e ícone Apple 180 × 180 |

A análise funcional do ESLint foi executada com `prettier/prettier` desativada somente na linha de comando. A configuração do repositório foi preservada. Esta revisão não fez reformatação geral dos arquivos.

## Cobertura do mock

Os testes exercitam as telas de convite, entrada simulada, perfil de comércio, envio de oferta, cadastro, criação e recuperação de rascunhos. Também verificam o contrato de nomes, confirmação, dois prêmios, preservação dos ganhadores, Listão, avisos ao comerciante e retirada.

Os testes de backup geram um ZIP real e conferem a restauração de sorteios, parceiros e um arquivo de vídeo fictício em armazenamento vazio. Incluem cópia antiga, vídeo ausente, conflitos, falhas de escrita, retomada interrompida e alterações durante importação. As operações dos parceiros são comparadas em adaptadores local e em memória.

## Limites da verificação

As telas foram exercitadas em DOM simulado. A execução do Chromium foi bloqueada neste ambiente. Captura e reprodução reais, câmera, microfone, compartilhamento nativo, instalação no celular e apresentação responsiva ainda precisam de verificação em navegador ou aparelho real. Os testes de integração substituem o armazenamento de vídeo por memória e usam um Blob fictício. A conferência dos ícones valida os arquivos e as dimensões, sem comprovar uma instalação real.

O mock está validado dentro dessa cobertura automatizada. Este relatório não certifica ausência total de falhas nem encerra as verificações em aparelho real.

## Dados e próxima ação

O app continua usando localStorage para os registros e IndexedDB para vídeos. A camada remota está documentada para implementação futura. Conexão com banco, criação de tabelas, autenticação real e migração dependem de autorização explícita do responsável.

O próximo passo é integrar esta revisão à versão principal e acompanhar o resultado da revisão do GitHub. As pendências em aparelho real e de formatação permanecem registradas acima.
