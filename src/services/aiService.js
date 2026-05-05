import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';

/**
 * TeacherAI Service — chama o Gemini via Firebase Functions (modo seguro).
 * A chave de API fica protegida no backend. Cada usuario tem limite diario individual.
 */

const aiChatFn = httpsCallable(functions, 'aiChat');

/**
 * Envia uma mensagem para o TeacherAI e retorna a resposta.
 *
 * @param {Object} params
 * @param {Array<{role: 'user'|'assistant', text: string}>} params.messages
 * @param {Object} params.context - Dados do professor (students, billing, upcomingLessons)
 * @returns {Promise<{text: string, action: Object|null}>}
 */
export const sendAIMessage = async ({ messages, context }) => {
  const result = await aiChatFn({ messages, context });
  return result.data;
};
