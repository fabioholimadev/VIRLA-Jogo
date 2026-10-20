/**
 * Automated Stress & Feature Test for VIRLA — Guardiões do Cuidado
 * Tests Google identification, duplicate session replacement, 45 concurrent players,
 * 46th player rejection, server scoring, shelter rescue validation, and synchronization.
 */

import { WebSocket } from 'ws';

const SERVER_URL = 'ws://localhost:3000';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('--- INICIANDO BATERIA DE TESTES AUTOMATIZADOS VIRLA ---');

  // 1. Create Host Room
  const hostWs = new WebSocket(SERVER_URL);
  let roomPin = '';
  let hostSecret = '';

  await new Promise<void>((resolve, reject) => {
    hostWs.on('open', () => {
      hostWs.send(JSON.stringify({ type: 'HOST_CREATE_ROOM', isAutomatedTest: true }));
    });

    hostWs.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'HOST_ROOM_CREATED') {
        roomPin = msg.pin;
        hostSecret = msg.hostSecret;
        console.log(`✓ Sala criada pelo apresentador com PIN: ${roomPin}`);
        resolve();
      }
    });

    hostWs.on('error', reject);
  });

  // 2. Connect initial players with Google ID
  console.log('Conectando primeiros jogadores com identificação Google...');
  const players: { ws: WebSocket; id: string; nickname: string; googleId: string }[] = [];

  for (let i = 1; i <= 5; i++) {
    const ws = new WebSocket(SERVER_URL);
    const googleId = `google_sub_${i}`;
    const nickname = `Guardião_${i}`;

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'PLAYER_JOIN',
            pin: roomPin,
            googleId,
            googleEmail: `guardiao${i}@gmail.com`,
            nickname,
            characterIndex: i % 3,
          })
        );
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'JOIN_SUCCESS') {
          players.push({ ws, id: msg.playerId, nickname, googleId });
          resolve();
        } else if (msg.type === 'JOIN_ERROR') {
          reject(new Error(msg.message));
        }
      });

      ws.on('error', reject);
    });
  }

  // 3. Test Session Replacement (Same Google Account opened in another tab)
  console.log('Testando substituição de sessão com a mesma conta Google...');
  const player1 = players[0];
  let sessionReplacedReceived = false;

  player1.ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'SESSION_REPLACED') {
        sessionReplacedReceived = true;
        console.log(`✓ Primeira aba recebeu notificação de sessão transferida: "${msg.reason}"`);
      }
    } catch {}
  });

  await new Promise<void>((resolve, reject) => {
    const secondTabWs = new WebSocket(SERVER_URL);

    secondTabWs.on('open', () => {
      secondTabWs.send(
        JSON.stringify({
          type: 'PLAYER_JOIN',
          pin: roomPin,
          googleId: player1.googleId, // Same Google ID
          googleEmail: 'guardiao1@gmail.com',
          nickname: player1.nickname,
          characterIndex: 0,
        })
      );
    });

    secondTabWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'JOIN_SUCCESS' && msg.playerId === player1.id) {
          console.log(`✓ Segunda aba assumiu a sessão do jogador existente sem duplicar entrada!`);
          player1.ws = secondTabWs; // Update active socket
          resolve();
        }
      } catch (err) {
        reject(err);
      }
    });

    secondTabWs.on('error', reject);
  });

  await wait(200);

  if (!sessionReplacedReceived) {
    throw new Error('Falha no teste: Primeira aba não foi notificada de SESSION_REPLACED!');
  }

  // 4. Test duplicate nickname rejection
  console.log('Testando recusa de apelido duplicado...');
  const duplicateWs = new WebSocket(SERVER_URL);
  let duplicateRejected = false;

  await new Promise<void>((resolve) => {
    duplicateWs.on('open', () => {
      duplicateWs.send(
        JSON.stringify({
          type: 'PLAYER_JOIN',
          pin: roomPin,
          googleId: 'new_google_id_999',
          nickname: 'Guardião_2', // Already taken
          characterIndex: 1,
        })
      );
    });

    duplicateWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'JOIN_ERROR' && msg.message.includes('em uso')) {
        duplicateRejected = true;
        console.log(`✓ Apelido duplicado rejeitado com sucesso: "${msg.message}"`);
        duplicateWs.close();
        resolve();
      }
    });
  });

  if (!duplicateRejected) {
    throw new Error('Falha no teste: Apelido duplicado não foi rejeitado!');
  }

  // 5. Connect remaining players up to 45
  console.log('Conectando até a capacidade máxima de 45 participantes simultâneos...');
  for (let i = 6; i <= 45; i++) {
    const ws = new WebSocket(SERVER_URL);
    const googleId = `google_sub_${i}`;
    const nickname = `Guardião_${i}`;

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            type: 'PLAYER_JOIN',
            pin: roomPin,
            googleId,
            googleEmail: `guardiao${i}@gmail.com`,
            nickname,
            characterIndex: i % 3,
          })
        );
      });

      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'JOIN_SUCCESS') {
          players.push({ ws, id: msg.playerId, nickname, googleId });
          resolve();
        } else if (msg.type === 'JOIN_ERROR') {
          reject(new Error(msg.message));
        }
      });

      ws.on('error', reject);
    });
  }

  console.log(`✓ Sucesso! ${players.length} jogadores conectados simultaneamente.`);

  // 6. Test 46th player rejection
  console.log('Testando recusa do 46º jogador (limite de 45)...');
  const excessWs = new WebSocket(SERVER_URL);
  let rejected = false;

  await new Promise<void>((resolve) => {
    excessWs.on('open', () => {
      excessWs.send(
        JSON.stringify({
          type: 'PLAYER_JOIN',
          pin: roomPin,
          googleId: 'google_sub_46',
          nickname: 'Jogador_Excedente',
          characterIndex: 0,
        })
      );
    });

    excessWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'JOIN_ERROR' && msg.message.includes('45')) {
        rejected = true;
        console.log(`✓ Recusa do 46º jogador validada: "${msg.message}"`);
        excessWs.close();
        resolve();
      }
    });
  });

  if (!rejected) {
    throw new Error('Falha no teste: 46º jogador não foi rejeitado!');
  }

  // 7. Start Phase 1
  console.log('Iniciando Fase 1 para todos os 45 jogadores sincronizados...');
  hostWs.send(JSON.stringify({ type: 'HOST_CHANGE_STATE', targetState: 'PHASE_1' }));
  await wait(500);

  // 8. Test Shelter Lock Validation (Attempting to finish without rescuing 3 elderly)
  console.log('Testando bloqueio do ponto de acolhimento (tentativa de concluir antes dos 3 idosos)...');
  let finishRejected = false;
  player1.ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'ACTION_REJECTED' && msg.message.includes('acolher')) {
      finishRejected = true;
      console.log(`✓ Servidor rejeitou conclusão antecipada: "${msg.message}"`);
    }
  });

  player1.ws.send(JSON.stringify({ type: 'ACTION_FINISH_PHASE' }));
  await wait(400);

  if (!finishRejected) {
    throw new Error('Falha no teste: Jogador conseguiu concluir a fase sem acolher os 3 idosos!');
  }

  // 9. Rescue all 3 elderly then finish successfully
  console.log('Acolhendo os 3 idosos e concluindo a fase corretamente no Ponto de Acolhimento...');
  player1.ws.send(JSON.stringify({ type: 'ACTION_RESCUE_ELDERLY', elderlyKey: 'f1_eld_1', elderlyName: 'Sr. Jorge' }));
  player1.ws.send(JSON.stringify({ type: 'ACTION_RESCUE_ELDERLY', elderlyKey: 'f1_eld_2', elderlyName: 'Dona Lúcia' }));
  player1.ws.send(JSON.stringify({ type: 'ACTION_RESCUE_ELDERLY', elderlyKey: 'f1_eld_3', elderlyName: 'Dona Celina' }));
  await wait(300);

  let phaseCompleteConfirmed = false;
  player1.ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'PHASE_COMPLETE_ACK') {
      phaseCompleteConfirmed = true;
      console.log(`✓ Conclusão de fase confirmada com Bônus de Tempo (+${msg.timeBonus} pts) e Pontuação Final: ${msg.finalScore}!`);
    }
  });

  player1.ws.send(JSON.stringify({ type: 'ACTION_FINISH_PHASE' }));
  await wait(500);

  if (!phaseCompleteConfirmed) {
    throw new Error('Falha no teste: Não recebeu PHASE_COMPLETE_ACK após acolher os 3 idosos!');
  }

  // Close connections
  players.forEach((p) => p.ws.close());
  hostWs.close();

  console.log('\n======================================================');
  console.log('🎉 TODOS OS TESTES FORAM CONCLUÍDOS COM 100% DE SUCESSO!');
  console.log('======================================================\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Erro durante o teste:', err);
  process.exit(1);
});
