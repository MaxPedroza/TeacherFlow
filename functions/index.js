const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');
const mpWebhookSecret = defineSecret('MP_WEBHOOK_SECRET');
const resendApiKey = defineSecret('RESEND_API_KEY');

const DAILY_LIMIT_PER_USER = 50;
const TRANSACTIONAL_FROM = 'TeacherFlow <onboarding@resend.dev>';
// Promo temporária: pagamentos desativados enquanto todos os usuários ficam Pro.
// Para reativar, altere para true.
const PAYMENTS_ENABLED = false;

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const sendTransactionalEmail = async ({ to, subject, html }) => {
  if (!to || !subject || !html) return;
  if (!resendApiKey.value()) {
    console.warn('RESEND_API_KEY não configurada; email transacional ignorado.');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: TRANSACTIONAL_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    console.error('Erro ao enviar email transacional:', await response.text());
  }
};

const hasLockedProPlan = async (db, uid) => {
  if (!uid) return false;
  const userSnap = await db.doc(`users/${uid}`).get();
  const userData = userSnap.data() || {};
  return userData.planOverride === 'pro' || userData.isLifetimePro === true;
};

const resolveUserEmail = async ({ uid, emailFromProvider }) => {
  if (emailFromProvider) return String(emailFromProvider).trim();
  if (!uid) return '';
  try {
    const userRecord = await getAuth().getUser(uid);
    return userRecord.email || '';
  } catch (error) {
    console.warn(`Não foi possível buscar email do usuário ${uid}:`, error.message);
    return '';
  }
};

const SYSTEM_PROMPT = `Você é o TeacherAI, assistente inteligente do TeacherFlow — um aplicativo para professores gerenciarem agenda de aulas e finanças.

Suas responsabilidades:
1. TUTORIA: Explicar como usar cada tela e funcionalidade do app com clareza
2. ANÁLISE: Analisar dados de alunos e financeiros fornecidos, gerar insights e relatórios úteis
3. AÇÕES: Quando o usuário pedir para cadastrar/alterar/cancelar algo, retornar uma intenção de ação estruturada

Telas disponíveis no app:
- /dashboard: Visão geral com estatísticas (alunos ativos, aulas do dia, receita pendente, projeção)
- /agenda: Calendário de aulas — crie, edite e visualize aulas por semana
- /alunos: Lista de alunos — cadastre, edite, filtre por instrumento e origem
- /financeiro: Relatório financeiro — filtre por período (mês/trimestre/semestre/ano), status, aluno e origem. Mostra valores pendentes, pagos e projeção mensal
- /configuracoes: Dados do professor e preferências

Status de aulas:
- scheduled: Agendada (futura)
- pending: Realizada, aguardando pagamento
- paid: Paga
- canceled_in_time: Falta avisada (sem cobrança)
- no_show: Falta sem aviso (cobrar)

Origem dos alunos: Particular, Escola

REGRA PARA AÇÕES DE CRUD:
Quando o usuário pedir para executar uma ação (criar aluno, criar aula, atualizar status, cancelar aula), responda SOMENTE com este JSON (sem nenhum texto extra):
{
  "intent": "create_student" | "create_lesson" | "update_lesson_status" | "cancel_lesson",
  "payload": { ... },
  "confirmMessage": "Mensagem amigável confirmando o que será feito",
  "requiresConfirmation": true
}

Para create_student, o payload deve conter:
- name (obrigatório), phone, instrument, origin ("Particular" ou "Escola"), rateDefault (número), defaultDuration (número, padrão 60)

Para create_lesson, o payload deve conter:
- studentName (para confirmação visual), studentId (se disponível no contexto), date (string ISO), duration (número em minutos), rateApplied (número), type ("Normal" ou "Demonstrativa"), content (opcional)

Para update_lesson_status, o payload deve conter:
- lessonId, newStatus (um dos status listados), lessonDescription

Para cancel_lesson, o payload deve conter:
- lessonId, lessonDescription

Se não tiver as informações necessárias para uma ação, pergunte antes de retornar o JSON.

Para análises e tutoria, responda em texto normal. Seja direto, claro e útil.
Responda sempre em português brasileiro.`;

exports.aiChat = onCall(
  { secrets: [geminiApiKey], cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const uid = request.auth.uid;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const db = getFirestore();
    const usageRef = db.doc(`aiUsage/${uid}/daily/${today}`);

    // Verifica e incrementa cota diária por usuário
    const usageSnap = await usageRef.get();
    const currentCount = usageSnap.exists ? (usageSnap.data().count || 0) : 0;

    if (currentCount >= DAILY_LIMIT_PER_USER) {
      throw new HttpsError(
        'resource-exhausted',
        `Limite diário de ${DAILY_LIMIT_PER_USER} perguntas atingido. Tente novamente amanhã.`
      );
    }

    await usageRef.set({ count: FieldValue.increment(1), updatedAt: new Date() }, { merge: true });

    const { messages, context } = request.data;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError('invalid-argument', 'Lista de mensagens inválida.');
    }

    if (messages.length > 30) {
      throw new HttpsError('invalid-argument', 'Histórico de mensagens muito longo. Inicie uma nova conversa.');
    }

    // Valida estrutura e tamanho de cada mensagem
    const VALID_ROLES = new Set(['user', 'assistant']);
    const MAX_MESSAGE_LENGTH = 4000;
    for (const msg of messages) {
      if (!msg || typeof msg !== 'object') {
        throw new HttpsError('invalid-argument', 'Mensagem inválida no histórico.');
      }
      if (!VALID_ROLES.has(msg.role)) {
        throw new HttpsError('invalid-argument', `Role inválido: ${msg.role}`);
      }
      if (typeof msg.text !== 'string') {
        throw new HttpsError('invalid-argument', 'O campo text de cada mensagem deve ser string.');
      }
      if (msg.text.length > MAX_MESSAGE_LENGTH) {
        throw new HttpsError('invalid-argument', `Mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
      }
    }

    // Valida e sanitiza o contexto (dados opcionais enviados pelo frontend)
    const safeContext = {};
    if (context && typeof context === 'object') {
      if (Array.isArray(context.students)) {
        safeContext.students = context.students.slice(0, 200).map((s) => ({
          id: String(s.id || '').slice(0, 128),
          name: String(s.name || '').slice(0, 100),
          instrument: String(s.instrument || '').slice(0, 60),
          origin: String(s.origin || '').slice(0, 60),
          status: String(s.status || '').slice(0, 20),
          rateDefault: Number(s.rateDefault) || 0,
        }));
      }
      if (context.billing && typeof context.billing === 'object') {
        safeContext.billing = {
          pendingTotal: Number(context.billing.pendingTotal) || 0,
          paidTotal: Number(context.billing.paidTotal) || 0,
          monthlyProjection: Number(context.billing.monthlyProjection) || 0,
        };
      }
      if (Array.isArray(context.upcomingLessons)) {
        safeContext.upcomingLessons = context.upcomingLessons.slice(0, 20).map((l) => ({
          id: String(l.id || '').slice(0, 128),
          studentName: String(l.studentName || '').slice(0, 100),
          date: String(l.date || '').slice(0, 30),
        }));
      }
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const contextParts = [];
    if (safeContext.students?.length) {
      const studentSummary = safeContext.students
        .map(s => `${s.name} (${s.instrument || 'sem instrumento'}, ${s.origin}, ${s.status === 'active' ? 'ativo' : 'inativo'}, R$${s.rateDefault || 0}/aula, id: ${s.id})`)
        .join('; ');
      contextParts.push(`Alunos cadastrados: ${studentSummary}`);
    }
    if (safeContext.billing) {
      const b = safeContext.billing;
      contextParts.push(
        `Financeiro atual: Pendente R$${(b.pendingTotal || 0).toFixed(2)}, Pago R$${(b.paidTotal || 0).toFixed(2)}, Projeção mensal R$${(b.monthlyProjection || 0).toFixed(2)}`
      );
    }
    if (safeContext.upcomingLessons?.length) {
      const upcoming = safeContext.upcomingLessons
        .slice(0, 8)
        .map(l => `${l.studentName} em ${new Date(l.date).toLocaleDateString('pt-BR')} (id: ${l.id || ''})`)
        .join('; ');
      contextParts.push(`Próximas aulas: ${upcoming}`);
    }

    const systemWithContext = contextParts.length
      ? `${SYSTEM_PROMPT}\n\nContexto atual do professor:\n${contextParts.join('\n')}`
      : SYSTEM_PROMPT;

    const history = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(msg.text || '') }],
    }));

    const chat = model.startChat({
      // Gemini espera systemInstruction como Content, nao string simples.
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemWithContext }],
      },
      history,
    });

    const lastMessage = messages[messages.length - 1];
    let responseText = '';

    try {
      const result = await chat.sendMessage(String(lastMessage.text || ''));
      responseText = result.response.text();
    } catch (err) {
      const status = Number(err?.status) || 500;
      const providerMessage = err?.message || 'Falha ao comunicar com o provedor de IA.';
      const normalizedMessage = String(providerMessage).toLowerCase();

      if (
        normalizedMessage.includes('api_key_invalid') ||
        normalizedMessage.includes('api key not valid')
      ) {
        throw new HttpsError('failed-precondition', 'A chave da IA configurada no servidor esta invalida. Atualize a GEMINI_API_KEY no Firebase Secret Manager.');
      }

      if (
        status === 404 ||
        normalizedMessage.includes('model') && normalizedMessage.includes('not found')
      ) {
        throw new HttpsError('failed-precondition', 'Modelo Gemini indisponivel para esta chave. Ajuste o modelo configurado na Cloud Function.');
      }

      if (status === 429) {
        throw new HttpsError('resource-exhausted', 'Cota do provedor de IA temporariamente esgotada. Tente novamente em instantes.');
      }

      if (status >= 400 && status < 500) {
        throw new HttpsError('invalid-argument', `Requisicao rejeitada pelo provedor de IA: ${providerMessage}`);
      }

      throw new HttpsError('internal', 'Falha interna ao processar resposta da IA. Tente novamente em alguns instantes.');
    }

    let action = null;
    try {
      const jsonMatch = responseText.trim().match(/\{[\s\S]*"intent"[\s\S]*\}/);
      if (jsonMatch) {
        action = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Resposta é texto normal, não uma ação
    }

    return {
      text: action?.confirmMessage || responseText,
      action: action || null,
    };
  }
);

// ── createCheckout ────────────────────────────────────────────────────────────
// Cria uma assinatura recorrente no Mercado Pago e retorna a URL de pagamento.
exports.createCheckout = onCall(
  { secrets: [mpAccessToken], cors: true },
  async (request) => {
    if (!PAYMENTS_ENABLED) {
      throw new HttpsError(
        'failed-precondition',
        'Pagamentos temporariamente desativados. Todos os usuários estão no plano Pro durante a campanha.'
      );
    }

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const uid = request.auth.uid;
    const email = request.auth.token.email || '';

    const body = {
      reason: 'TeacherFlow Pro — Plano Mensal',
      external_reference: uid,
      payer_email: email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 39,
        currency_id: 'BRL',
      },
      back_url: 'https://teacherflow-db0be.web.app/planos?status=sucesso',
    };

    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mpAccessToken.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      console.error('MP createCheckout error:', err);
      throw new HttpsError('internal', 'Não foi possível criar a assinatura agora.');
    }

    const data = await mpRes.json();
    return { checkoutUrl: data.init_point, subscriptionId: data.id };
  }
);

// ── mpWebhook ─────────────────────────────────────────────────────────────────
// Recebe notificações do Mercado Pago e atualiza o plano do usuário no Firestore.
exports.mpWebhook = onRequest(
  { secrets: [mpAccessToken, mpWebhookSecret, resendApiKey] },
  async (req, res) => {
    if (!PAYMENTS_ENABLED) {
      res.sendStatus(200);
      return;
    }

    // MP envia GET para verificar o endpoint na configuração — responde 200
    if (req.method === 'GET') {
      res.sendStatus(200);
      return;
    }

    // ── Validação da assinatura HMAC-SHA256 do MP ─────────────────────────
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const { type, data } = req.body || {};

    if (xSignature && mpWebhookSecret.value()) {
      const crypto = require('crypto');
      const parts = xSignature.split(',');
      const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1];
      const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1];
      if (ts && v1) {
        const manifest = `id:${data?.id};request-id:${xRequestId};ts:${ts};`;
        const expected = crypto
          .createHmac('sha256', mpWebhookSecret.value())
          .update(manifest)
          .digest('hex');
        if (expected !== v1) {
          console.warn('mpWebhook: assinatura inválida');
          res.sendStatus(401);
          return;
        }
      }
    }

    const db = getFirestore();

    // ── Pagamento recorrente mensal processado ─────────────────────────────
    if (type === 'subscription_authorized_payment' && data?.id) {
      const paymentRes = await fetch(
        `https://api.mercadopago.com/authorized_payments/${data.id}`,
        { headers: { Authorization: `Bearer ${mpAccessToken.value()}` } }
      );

      if (!paymentRes.ok) {
        console.error('MP payment fetch error:', await paymentRes.text());
        res.sendStatus(500);
        return;
      }

      const payment = await paymentRes.json();
      const preapprovalId = payment.preapproval_id;

      if (!preapprovalId) {
        res.sendStatus(200);
        return;
      }

      // Busca a assinatura para obter o external_reference (uid)
      const subRes = await fetch(
        `https://api.mercadopago.com/preapproval/${preapprovalId}`,
        { headers: { Authorization: `Bearer ${mpAccessToken.value()}` } }
      );

      if (!subRes.ok) {
        console.error('MP sub fetch error:', await subRes.text());
        res.sendStatus(500);
        return;
      }

      const subscription = await subRes.json();
      const uid = subscription.external_reference;

      if (!uid) {
        res.sendStatus(200);
        return;
      }

      // Renova a data de expiração por mais 1 mês + 3 dias de carência
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      expiresAt.setDate(expiresAt.getDate() + 3);

      await db.doc(`users/${uid}`).set(
        { plan: 'pro', planExpiresAt: expiresAt, updatedAt: new Date() },
        { merge: true }
      );  

      const payerEmail = await resolveUserEmail({
        uid,
        emailFromProvider: subscription.payer_email,
      });
      if (payerEmail) {
        await sendTransactionalEmail({
          to: payerEmail,
          subject: 'TeacherFlow Pro renovado com sucesso',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
              <h2 style="margin:0 0 12px;">Pagamento confirmado</h2>
              <p>Seu plano <strong>TeacherFlow Pro</strong> foi renovado com sucesso.</p>
              <p>Seu acesso continua ativo normalmente.</p>
              <p style="margin-top:24px;color:#475569;">Equipe TeacherFlow</p>
            </div>
          `,
        });
      }

      console.log(`Plano PRO renovado para uid=${uid} — pagamento ${data.id}`);
      res.sendStatus(200);
      return;
    }

    // ── Criação / atualização de assinatura ───────────────────────────────
    if (type !== 'subscription_preapproval' || !data?.id) {
      res.sendStatus(200);
      return;
    }

    // Busca os detalhes da assinatura no MP
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
      headers: { Authorization: `Bearer ${mpAccessToken.value()}` },
    });

    if (!mpRes.ok) {
      console.error('MP webhook fetch error:', await mpRes.text());
      res.sendStatus(500);
      return;
    }

    const subscription = await mpRes.json();
    const uid = subscription.external_reference;

    if (!uid) {
      console.error('mpWebhook: external_reference ausente na assinatura', subscription.id);
      res.sendStatus(200);
      return;
    }

    if (subscription.status === 'authorized') {
      // Ativa o plano pro com vencimento 1 mês + 3 dias de carência
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      expiresAt.setDate(expiresAt.getDate() + 3);

      await db.doc(`users/${uid}`).set(
        {
          plan: 'pro',
          planExpiresAt: expiresAt,
          mpSubscriptionId: subscription.id,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      const payerEmail = await resolveUserEmail({
        uid,
        emailFromProvider: subscription.payer_email,
      });
      if (payerEmail) {
        await sendTransactionalEmail({
          to: payerEmail,
          subject: 'Bem-vindo ao TeacherFlow Pro',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
              <h2 style="margin:0 0 12px;">Assinatura ativada</h2>
              <p>Seu plano <strong>TeacherFlow Pro</strong> está ativo.</p>
              <p>Agora você tem acesso aos recursos premium do app.</p>
              <p style="margin-top:24px;color:#475569;">Equipe TeacherFlow</p>
            </div>
          `,
        });
      }

      console.log(`Plano PRO ativado para uid=${uid}`);
    } else if (['cancelled', 'paused'].includes(subscription.status)) {
      const isLockedPro = await hasLockedProPlan(db, uid);

      if (isLockedPro) {
        await db.doc(`users/${uid}`).set(
          {
            mpSubscriptionId: subscription.id,
            updatedAt: new Date(),
          },
          { merge: true }
        );

        console.log(`Assinatura ${subscription.status} recebida, mas plano Pro fixo preservado para uid=${uid}`);
        res.sendStatus(200);
        return;
      }

      await db.doc(`users/${uid}`).set(
        {
          plan: 'free',
          mpSubscriptionId: subscription.id,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      const payerEmail = await resolveUserEmail({
        uid,
        emailFromProvider: subscription.payer_email,
      });
      if (payerEmail) {
        const safeStatus = escapeHtml(subscription.status);
        await sendTransactionalEmail({
          to: payerEmail,
          subject: 'Seu plano TeacherFlow voltou para o Free',
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
              <h2 style="margin:0 0 12px;">Atualização do plano</h2>
              <p>Seu plano foi alterado para <strong>Free</strong> (status: ${safeStatus}).</p>
              <p>Você pode reativar o Pro a qualquer momento na página de planos.</p>
              <p style="margin-top:24px;color:#475569;">Equipe TeacherFlow</p>
            </div>
          `,
        });
      }

      console.log(`Plano revertido para FREE — uid=${uid}, status=${subscription.status}`);
    }

    res.sendStatus(200);
  }
);
