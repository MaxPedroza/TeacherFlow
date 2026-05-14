/**
 * Script admin: promove um usuário para o plano Pro no Firestore.
 *
 * Uso:
 *   node scripts/set-pro.js <UID> [meses]
 *
 * Exemplos:
 *   node scripts/set-pro.js abc123xyz          → Pro por 12 meses
 *   node scripts/set-pro.js abc123xyz 3        → Pro por 3 meses
 *   node scripts/set-pro.js abc123xyz 9999     → Pro "eterno"
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
const months = parseInt(process.argv[3] ?? '12', 10);

if (!uid) {
  console.error('❌  Informe o UID: node scripts/set-pro.js <UID> [meses]');
  process.exit(1);
}

const expiresAt = new Date();
expiresAt.setMonth(expiresAt.getMonth() + months);

await db.collection('users').doc(uid).set(
  {
    plan: 'pro',
    planExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

const expiresStr = expiresAt.toLocaleDateString('pt-BR');
console.log(`✅  Usuário ${uid} agora é Pro até ${expiresStr} (${months} meses)`);
process.exit(0);
