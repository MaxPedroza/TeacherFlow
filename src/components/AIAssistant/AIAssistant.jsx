import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase.js';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useBilling } from '../../hooks/useBilling.js';
import { sendAIMessage } from '../../services/aiService.js';
import './AIAssistant.scss';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  text: 'Olá! Sou o TeacherAI 🤖\n\nPosso te ajudar com:\n• Análise financeira e insights dos seus dados\n• Como usar qualquer tela do app\n• Cadastrar alunos e aulas por texto\n• Atualizar ou cancelar aulas\n\nO que você precisa?',
};

const MAX_MESSAGES = 30;

const AIAssistant = ({ students = [], lessons = [], createLesson, updateLessonStatus }) => {
  const { user } = useAuthContext();
  const { billing } = useBilling();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const buildContext = useCallback(() => {
    const now = new Date();

    const upcomingLessons = lessons
      .filter(l => {
        const lessonDate = l.date?.toDate?.();
        return lessonDate && lessonDate >= now && l.status === 'scheduled';
      })
      .slice(0, 10)
      .map(l => {
        const student = students.find(s => s.id === l.studentId);
        return {
          id: l.id,
          studentName: student?.name || 'Aluno desconhecido',
          date: l.date?.toDate?.()?.toISOString(),
          duration: l.duration,
          rateApplied: l.rateApplied,
        };
      });

    return {
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        instrument: s.instrument,
        origin: s.origin,
        status: s.status,
        rateDefault: s.rateDefault,
      })),
      billing: billing
        ? {
            pendingTotal: billing.pendingTotal,
            paidTotal: billing.paidTotal,
            monthlyProjection: billing.monthlyProjection,
          }
        : null,
      upcomingLessons,
    };
  }, [students, lessons, billing]);

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), ...msg }]);
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    const userMessage = { role: 'user', text };
    setMessages(prev => [...prev, { id: Date.now().toString(), ...userMessage }]);
    setInputText('');
    setIsLoading(true);

    try {
      // Monta histórico sem a mensagem de boas-vindas, limitado ao máximo
      const historyMessages = [...messages.filter(m => m.id !== 'welcome'), userMessage]
        .slice(-MAX_MESSAGES)
        .map(m => ({ role: m.role, text: m.text }));

      const response = await sendAIMessage({
        messages: historyMessages,
        context: buildContext(),
      });

      addMessage({ role: 'assistant', text: response.text });

      if (response.action?.requiresConfirmation) {
        setPendingAction(response.action);
      }
    } catch (error) {
      const isQuotaError =
        error.message?.includes('429') ||
        error.message?.includes('quota') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.code === 'functions/resource-exhausted';

      addMessage({
        role: 'assistant',
        text: isQuotaError
          ? `⚠️ ${error.message?.includes('Limite diário') ? error.message : 'Cota de requisições atingida. Tente novamente mais tarde.'}`
          : `❌ Erro ao conectar com a IA: ${error.message || 'tente novamente.'}`,
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const executeAction = async (action) => {
    if (!user || !action) return;
    setPendingAction(null);
    setIsLoading(true);

    try {
      if (action.intent === 'create_student') {
        const { name, phone, instrument, origin, rateDefault, defaultDuration } = action.payload;

        if (!name?.trim()) throw new Error('Nome do aluno é obrigatório.');

        await addDoc(collection(db, 'students'), {
          teacherId: user.uid,
          name: name.trim(),
          phone: phone?.trim() || '',
          instrument: instrument?.trim() || '',
          origin: origin || 'Particular',
          rateDefault: Number(rateDefault) || 0,
          defaultDuration: Number(defaultDuration) || 60,
          status: 'active',
          isEffective: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        addMessage({
          role: 'assistant',
          text: `✅ Aluno **${name}** cadastrado com sucesso! Você pode vê-lo na tela /alunos.`,
        });
      } else if (action.intent === 'create_lesson') {
        if (!createLesson) throw new Error('Função de criar aula não disponível.');

        const { studentId, studentName, date, duration, rateApplied, type, content } = action.payload;

        if (!studentId) throw new Error(`Não encontrei o ID do aluno "${studentName}". Verifique se o aluno está cadastrado.`);
        if (!date) throw new Error('Data da aula é obrigatória.');

        await createLesson({
          studentId,
          date: new Date(date),
          duration: Number(duration) || 60,
          rateApplied: Number(rateApplied) || 0,
          type: type || 'Normal',
          content: content || '',
          status: 'scheduled',
          recurrenceWeeks: 1,
        });

        addMessage({
          role: 'assistant',
          text: `✅ Aula criada para **${studentName}** em ${new Date(date).toLocaleDateString('pt-BR')}. Veja na tela /agenda.`,
        });
      } else if (action.intent === 'update_lesson_status') {
        if (!updateLessonStatus) throw new Error('Função de atualizar aula não disponível.');

        const { lessonId, newStatus, lessonDescription } = action.payload;
        if (!lessonId) throw new Error('ID da aula não informado.');

        await updateLessonStatus(lessonId, newStatus);

        addMessage({
          role: 'assistant',
          text: `✅ Status da aula "${lessonDescription || lessonId}" atualizado com sucesso!`,
        });
      } else if (action.intent === 'cancel_lesson') {
        if (!updateLessonStatus) throw new Error('Função de atualizar aula não disponível.');

        const { lessonId, lessonDescription } = action.payload;
        if (!lessonId) throw new Error('ID da aula não informado.');

        await updateLessonStatus(lessonId, 'canceled_in_time');

        addMessage({
          role: 'assistant',
          text: `✅ Aula "${lessonDescription || lessonId}" cancelada com sucesso.`,
        });
      } else {
        throw new Error(`Ação desconhecida: ${action.intent}`);
      }
    } catch (err) {
      addMessage({
        role: 'assistant',
        text: `❌ Não foi possível executar a ação: ${err.message}`,
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    addMessage({
      role: 'assistant',
      text: 'Tudo bem, ação cancelada. Posso ajudar com mais alguma coisa?',
    });
  };

  const clearChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setPendingAction(null);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageText = (text) =>
    text.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));

  return (
    <>
      <button
        className={`ai-assistant__fab ${isOpen ? 'ai-assistant__fab--open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? 'Fechar assistente IA' : 'Abrir assistente IA'}
        title="TeacherAI"
      >
        {isOpen ? <X size={22} /> : <Bot size={22} />}
      </button>

      {isOpen && (
        <div className="ai-assistant__panel" role="dialog" aria-label="TeacherAI Assistente">
          <div className="ai-assistant__header">
            <div className="ai-assistant__header-info">
              <Bot size={18} />
              <span className="ai-assistant__title">TeacherAI</span>
              <span className="ai-assistant__badge">Gemini</span>
            </div>
            <div className="ai-assistant__header-actions">
              <button
                className="ai-assistant__icon-btn"
                onClick={clearChat}
                title="Limpar conversa"
                aria-label="Limpar conversa"
              >
                <Trash2 size={15} />
              </button>
              <button
                className="ai-assistant__icon-btn"
                onClick={() => setIsOpen(false)}
                title="Fechar"
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="ai-assistant__messages">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`ai-assistant__message ai-assistant__message--${msg.role}${msg.isError ? ' ai-assistant__message--error' : ''}`}
              >
                <div className="ai-assistant__bubble">
                  {renderMessageText(msg.text)}
                </div>
              </div>
            ))}

            {pendingAction && (
              <div className="ai-assistant__action-card">
                <p className="ai-assistant__action-label">Confirmar ação:</p>
                <p className="ai-assistant__action-desc">{pendingAction.confirmMessage}</p>
                <div className="ai-assistant__action-buttons">
                  <button
                    className="ai-assistant__action-btn ai-assistant__action-btn--confirm"
                    onClick={() => executeAction(pendingAction)}
                    disabled={isLoading}
                  >
                    <CheckCircle size={14} />
                    Confirmar
                  </button>
                  <button
                    className="ai-assistant__action-btn ai-assistant__action-btn--cancel"
                    onClick={cancelAction}
                    disabled={isLoading}
                  >
                    <XCircle size={14} />
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="ai-assistant__message ai-assistant__message--assistant">
                <div className="ai-assistant__bubble ai-assistant__bubble--loading">
                  <Loader2 size={14} className="ai-assistant__spinner" />
                  <span>Pensando...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="ai-assistant__input-area">
            <textarea
              ref={inputRef}
              className="ai-assistant__input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo ou peça uma ação..."
              rows={1}
              disabled={isLoading}
              maxLength={1000}
            />
            <button
              className="ai-assistant__send"
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              aria-label="Enviar mensagem"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
