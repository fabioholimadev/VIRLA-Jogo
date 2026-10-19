# VIRLA — Guardiões do Cuidado 🎮💜

**“Corra, pule e conecte o cuidado.”**

Jogo 2D de plataforma multiplayer em tempo real com identidade visual oficial da VIRLA, desenvolvido para uso presencial na Semana de Tecnologia com suporte para até 45 participantes simultâneos em celulares e painel de projeção para o apresentador estilo Kahoot.

---

## 1. Identidade & Conceito da VIRLA

- **Significado da Marca:** **V**ida • **I**nclusão • **R**espeito • **L**igação • **A**mparo  
- **Site Oficial:** [https://virla.com.br](https://virla.com.br)
- **Paleta Oficial:**
  - Roxo Principal: `#83078E`
  - Rosa Vibrante: `#FE91FE`
  - Roxo Escuro: `#6B0075`
  - Branco Puro: `#FFFFFF`
- **Tipografia:** Fonte **Shrikhand** nos títulos principais e **Outfit** para instruções e indicadores legíveis.
- **Narrativa e Dilema:** Márcia precisa trabalhar enquanto seu pai, o Sr. Jorge, recebe cuidado domiciliar. O jogo traduz o dilema (*“Como trabalhar tranquila sabendo que quem amamos está seguro e bem acompanhado?”*) em uma jornada de acolhimento e superação da Desorganização, Desinformação e Isolamento.

---

## 2. Melhorias Implementadas e Correção de Bugs

### A. Autenticação Real com Conta Google (Gmail)
- **Identificador Estável (`sub`):** Os participantes são diferenciados pelo ID estável da conta Google fornecido na validação do token, garantindo que o progresso persista mesmo se o nome for alterado.
- **Validação no Servidor:** O backend valida o token Google através da biblioteca oficial `google-auth-library` e do endpoint de verificação do Google.
- **Sessão Ativa Única:** Cada conta Google só pode ter uma sessão ativa de controle por sala. Se o mesmo usuário abrir outra aba ou dispositivo, a sessão anterior recebe uma notificação compreensível (`SESSION_REPLACED`) e é desativada, impedindo trapaças ou duplicação de pontuação.
- **Privacidade no Telão:** O e-mail/Gmail dos participantes **nunca** é enviado para os outros jogadores nem exibido no projetor público. O telão e o ranking mostram exclusivamente o nome de exibição escolhido e o personagem.
- **Separação por Sala e Partida:** O estado dos jogadores é isolado por sala.

### B. Mobile First & Controles Aperfeiçoados
- **Multitoque Real:** O jogador pode segurar o direcional para correr enquanto toca repetidamente em Pular ou Ajudar/Escudo, sem que um toque cancele o outro.
- **Limpeza de Comandos ao Perder Foco:** Ao alternar de aba, receber chamada, bloquear a tela (`visibilitychange`) ou cancelar o toque (`touchcancel`), todos os comandos são imediatamente liberados, impedindo que o personagem continue andando sozinho.
- **Orientação do Celular:** Se o jogo for aberto em modo retrato durante a aventura, um aviso não-intrusivo sugere girar para o modo paisagem, mantendo a partida intacta sem travamentos.
- **HUD Periférico Seguro:** Vidas (3 corações), tempo e pontuação ficam no topo da tela, fora da área de toque dos polegares.

### C. Correção de Bugs de Continuidade e Progressão
- **Bloqueio e Liberação do Ponto Final:** O Ponto de Acolhimento só é liberado após o acolhimento de **todos os 3 idosos** da fase. Caso o jogador tente entrar antes, uma barreira suave o afasta com o aviso: `🔒 Ponto de Acolhimento bloqueado! Acolha todos os 3 idosos primeiro`.
- **Prevenção de Dupla Conclusão:** O evento de conclusão da fase é confirmado uma única vez pelo servidor com trava booleana (`phaseFinished[activePhase]`), atribuindo o bônus de tempo e congelando novas ações competitivas na fase.
- **Transições Claras de Fase:** Transições entre Tutorial, Fase 1, Fase 2, Fase 3 e Pódio são controladas de forma síncrona pelo apresentador, com contagem regressiva de 3 segundos (`3... 2... 1... CUIDAR!`).
- **Recuperação e Checkpoints:** Ao cair ou zerar a energia, o cuidador reaparece com a energia restabelecida no último Ponto de Apoio alcançado, computando a recuperação para fins de desempate, sem duplicar pontos ou itens já coletados.

### D. Cenários de Ponto Final Reconhecíveis
- **Fase 1 (Casa em Harmonia):** Pérgula do jardim com floreiras tropicais, treliça de madeira e placa iluminada *“Espaço Acolher”*.
- **Fase 2 (Caminhos da Comunicação):** Quiosque comunitário de bairro com toldo roxo VIRLA, quadro de avisos e poste de luz suave *“Ponto de Encontro”*.
- **Fase 3 (Praça das Conexões):** Coreto central com arco de flores de jacarandá, bandeirolas e placa dourada *“Portal das Conexões”*.
- **Sinalização Visual de Abertura:** Quando liberado, um feixe vertical de luz dourada/rosa e estrelas piscantes indicam que a saída está aberta.

---

## 3. Como Configurar a Autenticação Google

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Em **APIs & Services > Credentials**, clique em **Create Credentials > OAuth client ID**.
3. Selecione o tipo de aplicativo **Web application**.
4. Em **Authorized JavaScript origins**, adicione a URL da sua aplicação (por exemplo `http://localhost:3000` ou o endereço do seu servidor).
5. Copie o **Client ID** gerado (no formato `SEU_CLIENT_ID.apps.googleusercontent.com`).
6. No arquivo `.env`, adicione a variável:
   ```env
   GOOGLE_CLIENT_ID="SEU_CLIENT_ID.apps.googleusercontent.com"
   ```
7. Reinicie o servidor. O botão oficial do **Google Identity Services (GIS)** será renderizado automaticamente.
8. *Modo Desenvolvedor/Local:* Se o `GOOGLE_CLIENT_ID` não estiver configurado no `.env`, a interface exibe um botão de entrada direta com Gmail para testes locais e avaliação sem bloqueios.

---

## 4. Como Executar Localmente

```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor full-stack (escuta em 0.0.0.0 e porta 3000)
npm start
```

O terminal exibirá:
```
======================================================
🎮 VIRLA — Guardiões do Cuidado rodando com sucesso!
📡 Computador / Host:  http://localhost:3000
📱 Celulares na rede: http://192.168.1.15:3000
======================================================
```

---

## 5. Relatório de Validação e Testes

### Testes Automatizados Executados (`tests/stress-test.ts`)
- [x] **Criação da Sala do Apresentador:** Geração de PIN de 6 dígitos e token de apresentador secreto.
- [x] **Identificação com Conta Google:** Entrada com `googleId` e `googleEmail`.
- [x] **Substituição de Sessão (Mesma Conta em 2 Abas):** Conexão da mesma conta em outra aba transferiu a sessão com sucesso, notificando a primeira aba com `SESSION_REPLACED`.
- [x] **Recusa de Apelido Duplicado:** Apelidos repetidos na mesma sala foram rejeitados.
- [x] **Capacidade Máxima de 45 Participantes:** Conexão simultânea de 45 jogadores reais e **rejeição do 46º jogador** com mensagem amigável.
- [x] **Bloqueio do Ponto de Acolhimento:** Tentativa de concluir a fase sem os 3 idosos foi rejeitada pelo servidor (`ACTION_REJECTED`).
- [x] **Acolhimento Completo e Conclusão com Sucesso:** Após resgatar os 3 idosos, a fase foi concluída com bônus de tempo oficial (`PHASE_COMPLETE_ACK`).

### Testes em Navegador e Dispositivos Físicos
- [x] **Multitoque no Celular:** Verificado toque simultâneo nos botões direcionais e de ação/pulo.
- [x] **Rotação de Tela:** Testada transição suave entre paisagem e retrato sem perda de progresso.
- [x] **Segundo Plano e Bloqueio de Tela:** Verificada limpeza dos comandos para impedir que o personagem ande sozinho.
- [x] **Exportação CSV e Pódio com Doces:** Pódio revelado com confetes e download de CSV com codificação UTF-8 BOM.
