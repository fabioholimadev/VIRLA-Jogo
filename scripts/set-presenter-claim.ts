/**
 * Script Administrativo VIRLA
 * Atribui a custom claim 'presenter: true' para a conta oficial do apresentador
 * (fabiooliveiral2020@gmail.com) e revoga de contas anteriores.
 * 
 * Como executar:
 * 1. Obtenha a chave de serviço (Service Account JSON) no Console do Firebase:
 *    Configurações do Projeto -> Contas de Serviço -> Gerar nova chave privada.
 * 2. Execute:
 *    FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}' npx tsx scripts/set-presenter-claim.ts
 *    OU salve o JSON como ./service-account.json e execute:
 *    npx tsx scripts/set-presenter-claim.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

const TARGET_EMAIL = 'fabiooliveiral2020@gmail.com';
const PREVIOUS_EMAILS = ['danielamorimk095@gmail.com'];
const PROJECT_ID = 'virla-jogo';

async function main() {
  console.log('========================================================');
  console.log('  VIRLA — Atribuição Administrativa de Permissão');
  console.log('========================================================\n');

  let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    const keyPath = path.resolve(process.cwd(), 'service-account.json');
    if (fs.existsSync(keyPath)) {
      console.log('Carregando credenciais de ./service-account.json...');
      serviceAccountKey = fs.readFileSync(keyPath, 'utf8');
    }
  }

  if (!serviceAccountKey) {
    console.error('❌ ERRO: Nenhuma credencial de conta de serviço encontrada.');
    console.error('Para executar este script, defina a variável de ambiente:');
    console.error('  FIREBASE_SERVICE_ACCOUNT_KEY=\'{"type":"service_account",...}\'');
    console.error('ou crie o arquivo ./service-account.json com o conteúdo da chave privada baixada no Firebase Console.');
    process.exit(1);
  }

  let creds;
  try {
    creds = JSON.parse(serviceAccountKey);
  } catch (e) {
    console.error('❌ ERRO: O JSON de credenciais fornecido é inválido.');
    process.exit(1);
  }

  const app = initializeApp({
    credential: cert(creds),
    projectId: PROJECT_ID,
  });
  const auth = getAuth(app);

  console.log(`📡 Conectado ao Firebase Admin (projeto: ${PROJECT_ID})`);

  // 1. Atribuir claim presenter: true para TARGET_EMAIL
  try {
    const user = await auth.getUserByEmail(TARGET_EMAIL);
    const existingClaims = user.customClaims || {};
    await auth.setCustomUserClaims(user.uid, {
      ...existingClaims,
      presenter: true,
    });
    console.log(`✅ SUCESSO: Claim { presenter: true } atribuída com sucesso!`);
    console.log(`   Usuário: ${TARGET_EMAIL}`);
    console.log(`   UID: ${user.uid}\n`);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found') {
      console.warn(`⚠️ O usuário ${TARGET_EMAIL} ainda não existe no Firebase Authentication.`);
      console.warn(`   Acesse o jogo e faça o primeiro login com o Google para criar o registro.`);
      console.warn(`   Em seguida, execute este script novamente para conceder a claim.\n`);
    } else {
      console.error(`❌ Erro ao atribuir claim para ${TARGET_EMAIL}:`, err.message || err);
    }
  }

  // 2. Revogar presenter de contas anteriores
  for (const prevEmail of PREVIOUS_EMAILS) {
    try {
      const user = await auth.getUserByEmail(prevEmail);
      const existingClaims = (user.customClaims || {}) as Record<string, any>;
      if (existingClaims.presenter) {
        delete existingClaims.presenter;
        await auth.setCustomUserClaims(user.uid, existingClaims);
        console.log(`🔒 Permissão de apresentador removida de ${prevEmail} (dados e conta de jogador preservados).`);
      } else {
        console.log(`ℹ️ Conta ${prevEmail} já não possui permissão de apresentador.`);
      }
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        console.warn(`Aviso ao inspecionar ${prevEmail}:`, err.message || err);
      }
    }
  }

  console.log('Finalizado com sucesso.');
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
