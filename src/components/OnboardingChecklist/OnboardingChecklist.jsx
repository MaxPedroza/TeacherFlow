import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import './OnboardingChecklist.scss';

const STORAGE_KEY = 'teacherflow-onboarding-dismissed';
const AI_OPENED_KEY = 'teacherflow-ai-opened';

// Chamado externamente pelo AIAssistant ao abrir pela primeira vez
export const markAIOpened = () => localStorage.setItem(AI_OPENED_KEY, '1');

const OnboardingChecklist = ({ students, lessons }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  );
  const [aiOpened, setAiOpened] = useState(
    () => localStorage.getItem(AI_OPENED_KEY) === '1'
  );

  // Detecta abertura da IA em outra aba/componente
  useEffect(() => {
    const check = () => setAiOpened(localStorage.getItem(AI_OPENED_KEY) === '1');
    window.addEventListener('storage', check);
    window.addEventListener('focus', check);
    return () => {
      window.removeEventListener('storage', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  const steps = [
    {
      id: 'student',
      label: 'Cadastre seu primeiro aluno',
      description: 'Vá em Alunos e clique em "Novo Aluno".',
      done: students.length > 0,
      href: '/alunos',
    },
    {
      id: 'lesson',
      label: 'Registre sua primeira aula',
      description: 'Clique em "Nova Aula" no Dashboard ou na Agenda.',
      done: lessons.length > 0,
      href: null,
    },
    {
      id: 'finance',
      label: 'Explore o Relatório Financeiro',
      description: 'Acesse o Financeiro para ver seus ganhos e pendências.',
      done: lessons.some((l) => ['paid', 'pending'].includes(l.status)),
      href: '/financeiro',
    },
    {
      id: 'ai',
      label: 'Conheça o TeacherAI',
      description: 'Toque no ícone de IA e faça sua primeira pergunta.',
      done: aiOpened,
      href: null,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Quando completar tudo, auto-dispensar após 3s
  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, '1');
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [allDone]);

  if (dismissed) return null;

  return (
    <div className="onboarding-checklist panel">
      <div className="onboarding-checklist__header" onClick={() => setCollapsed((c) => !c)}>
        <div>
          <h3>Primeiros passos</h3>
          <p>{completedCount} de {steps.length} concluídos</p>
        </div>
        <div className="onboarding-checklist__header-right">
          <div className="onboarding-checklist__progress">
            <div
              className="onboarding-checklist__progress-bar"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </div>
      </div>

      {!collapsed && (
        <ul className="onboarding-checklist__steps">
          {steps.map((step) => (
            <li key={step.id} className={`onboarding-checklist__step${step.done ? ' onboarding-checklist__step--done' : ''}`}>
              {step.done
                ? <CheckCircle2 size={18} className="onboarding-checklist__icon onboarding-checklist__icon--done" />
                : <Circle size={18} className="onboarding-checklist__icon" />
              }
              <div>
                <strong>
                  {step.href && !step.done
                    ? <a href={step.href}>{step.label}</a>
                    : step.label
                  }
                </strong>
                {!step.done && <p>{step.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {allDone && (
        <p className="onboarding-checklist__complete">
          Tudo pronto! Você já conhece o TeacherFlow. 🎉
        </p>
      )}

      {!allDone && (
        <button
          type="button"
          className="onboarding-checklist__dismiss"
          onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); setDismissed(true); }}
        >
          Dispensar
        </button>
      )}
    </div>
  );
};

export default OnboardingChecklist;
