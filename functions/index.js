const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const geminiApiKey = defineSecret('GEMINI_API_KEY');

const DAILY_LIMIT_PER_USER = 50;

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

    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const contextParts = [];
    if (context?.students?.length) {
      const studentSummary = context.students
        .map(s => `${s.name} (${s.instrument || 'sem instrumento'}, ${s.origin}, ${s.status === 'active' ? 'ativo' : 'inativo'}, R$${s.rateDefault || 0}/aula, id: ${s.id})`)
        .join('; ');
      contextParts.push(`Alunos cadastrados: ${studentSummary}`);
    }
    if (context?.billing) {
      const b = context.billing;
      contextParts.push(
        `Financeiro atual: Pendente R$${(b.pendingTotal || 0).toFixed(2)}, Pago R$${(b.paidTotal || 0).toFixed(2)}, Projeção mensal R$${(b.monthlyProjection || 0).toFixed(2)}`
      );
    }
    if (context?.upcomingLessons?.length) {
      const upcoming = context.upcomingLessons
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
      systemInstruction: systemWithContext,
      history,
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(String(lastMessage.text || ''));
    const responseText = result.response.text();

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
