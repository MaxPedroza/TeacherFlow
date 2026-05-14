/**
 * Script admin: promove um usuário para o plano Pro no Firestore.
 *
 * Uso:
 *   node scripts/set-pro.js <UID> [meses|lifetime]
 *
 * Exemplos:
 *   node scripts/set-pro.js abc123xyz          → Pro por 12 meses
 *   node scripts/set-pro.js abc123xyz 3        → Pro por 3 meses
 *   node scripts/set-pro.js abc123xyz lifetime → Pro vitalício (não rebaixa no webhook)
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega a service account do projeto
const serviceAccountPath = resolve(__dirname, '../serviceAccount.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch {
  console.error('❌  Arquivo serviceAccount.json não encontrado em', serviceAccountPath);
  console.error('   Baixe em: Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const uid = process.argv[2];
const planArg = (process.argv[3] || '12').toLowerCase();
const isLifetime = ['lifetime', 'vitalicio', 'forever', 'permanent', '-1'].includes(planArg);
const months = isLifetime ? 0 : parseInt(planArg, 10);

if (!uid) {
  console.error('❌  Informe o UID: node scripts/set-pro.js <UID> [meses|lifetime]');
  process.exit(1);
}

if (!isLifetime && (Number.isNaN(months) || months <= 0)) {
  console.error('❌  Meses inválidos. Use um número > 0 ou "lifetime".');
  process.exit(1);
}

const payload = {
  plan: 'pro',
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
};

if (isLifetime) {
  payload.isLifetimePro = true;
  payload.planOverride = 'pro';
  payload.planExpiresAt = null;
} else {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);
  payload.isLifetimePro = false;
  payload.planOverride = admin.firestore.FieldValue.delete();
  payload.planExpiresAt = admin.firestore.Timestamp.fromDate(expiresAt);
}

await db.collection('users').doc(uid).set(
  payload,
  { merge: true }
);

if (isLifetime) {
  console.log(`✅  Usuário ${uid} agora é Pro vitalício (override ativo)`);
} else {
  const expiresAt = payload.planExpiresAt.toDate();
  const expiresStr = expiresAt.toLocaleDateString('pt-BR');
  console.log(`✅  Usuário ${uid} agora é Pro até ${expiresStr} (${months} meses)`);
}
process.exit(0);
