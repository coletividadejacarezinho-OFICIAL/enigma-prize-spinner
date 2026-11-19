# Trilha do giro (E06)

- **Origem:** composição original deste projeto, gerada no próprio aparelho pelo navegador (Web Audio, osciladores). Não há arquivo de áudio, amostra ou download; nada depende da internet.
- **Licença:** feita para o Enigma Premiado, livre para redistribuir junto com o app.
- **Música:** melodia alegre em dó maior (8 notas em loop) com baixo a cada 4 notas, em `src/lib/enigma/jingle.ts`. As notas seguem a mesma curva de desaceleração da roleta, então a música desacelera com ela. A revelação (acorde de dó subindo) toca quando a roleta para no resultado salvo.
- **Quando toca:** só quando começa a animação de um resultado já salvo. Para ao terminar, ao sair da tela cheia ou ao sair da Roleta. Com "Sem som" nada toca. Com movimento reduzido no aparelho, a roleta só encaixa no resultado e toca apenas a revelação.
- **Preferências:** "Música da roleta" (liga/sem som) e volume ficam salvos no aparelho (`sound`, `volume`).
