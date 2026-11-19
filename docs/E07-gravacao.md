# Gravação na Roleta (E07)

- **Modos:** "Roleta com meu rosto" (câmera + microfone), "Só a roleta" (sem câmera) e "Só minha voz" (arquivo de áudio). Nos dois modos de vídeo o microfone pode ser desligado. Só o que o modo usa é pedido ao aparelho (`needsFor` em `src/lib/enigma/capture.ts`).
- **Prévia:** rosto no círculo (modo com rosto) e barra do microfone ("Fale algo para testar o microfone").
- **Sem permissão ou suporte:** a explicação aparece e são oferecidos os modos que sobram; "Continuar sem gravar" volta à roleta, que segue girando e compartilhando normalmente.
- **Conteúdo:** o vídeo desenha a mesma tela (cortesia exibida, nome completo e número do ganhador vindos do resultado salvo). O rosto fica no canto inferior direito, fora do ponteiro e do quadro do ganhador.
- **Trilha:** misturada direto no arquivo (não depende do alto-falante), a 35% do volume escolhido com microfone ligado e 80% sem microfone (`recordedMusicLevel`). "Sem som" = sem trilha no arquivo. No modo só voz não entra trilha.
- **Fim:** "Encerrar gravação", "Cancelar" (descarta o arquivo) ou sair da Roleta (encerra e guarda). Câmera e microfone são liberados nos três casos. O giro continua salvo antes da animação; falha na gravação nunca muda o ganhador.
- **Salvar:** "Gravação salva" só aparece depois de ler o arquivo de volta (mesmo tamanho) e confirmar o vínculo com o sorteio (`keepRecording`). Se falhar: "Tentar salvar novamente" ou "Baixar gravação".
- **Arquivos:** vídeo `.mp4` (ou `.webm`); áudio `.m4a` (audio/mp4), `.webm` ou `.ogg`, conforme o navegador gravou (`mediaExtension`).
- **Cópia de segurança:** o formato v1 continua o mesmo. A única mudança: arquivos só de áudio entram no ZIP com a extensão certa (`videos/<id>.m4a`), em vez de `.mp4`. A restauração lê o caminho que está em `copia.json`, então cópias antigas continuam sendo lidas; o tipo do arquivo (mimeType) é devolvido ao restaurar.
