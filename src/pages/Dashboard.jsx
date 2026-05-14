import React, { useMemo, useState } from 'react';
import { Check, CircleDollarSign, Plus, UserPlus, XCircle } from 'lucide-react';
import PageSpinner from '../components/PageSpinner/PageSpinner.jsx';
import StatCard from '../components/StatCard/StatCard.jsx';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog.jsx';
import { useBilling } from '../hooks/useBilling.js';
import { useLessons } from '../hooks/useLessons.js';
import { useStudents } from '../hooks/useStudents.js';
import LessonForm from '../components/LessonForm/LessonForm.jsx';
import { getLessonStatusLabel } from '../constants/lessonStatus.js';
import { useToast } from '../context/ToastContext.jsx';
import OnboardingChecklist from '../components/OnboardingChecklist/OnboardingChecklist.jsx';
import './Dashboard.scss';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const getCurrentMonthValue = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const Dashboard = () => {
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState('month');
  const [busyLessonId, setBusyLessonId] = useState('');
  const [rescheduleLesson, setRescheduleLesson] = useState(null);
  const { addToast } = useToast();
  const [referenceMonth, setReferenceMonth] = useState(getCurrentMonthValue);
  const { pendingTotal, paidTotal, monthlyProjection, periodLabel, loading } = useBilling({
    period: billingPeriod,
    referenceMonth,
  });
  const {
    lessons,
    loading: lessonsLoading,
    createLesson,
    updateLessonStatus,
  } = useLessons();
  const { students, loading: studentsLoading } = useStudents();

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  const activeStudents = useMemo(
    () => students.filter((student) => student.status === 'active'),
    [students]
  );

  const todaysLessons = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return lessons
      .filter((lesson) => {
        const lessonDate = lesson.date?.toDate?.();
        if (!lessonDate) return false;
        return lessonDate >= start && lessonDate <= end;
      })
      .sort((firstLesson, secondLesson) => {
        const firstDate = firstLesson.date?.toDate?.()?.getTime() || 0;
        const secondDate = secondLesson.date?.toDate?.()?.getTime() || 0;
        return firstDate - secondDate;
      });
  }, [lessons]);

  const isBusy = loading || lessonsLoading || studentsLoading;

  if (isBusy) return <PageSpinner message="Carregando dados..." />;

  if (!studentsLoading && !lessonsLoading && students.length === 0 && lessons.length === 0) {
    return (
      <main className="container">
        <div className="dashboard__onboarding panel">
          <UserPlus size={40} strokeWidth={1.5} />
          <h1>Bem-vindo ao TeacherFlow!</h1>
          <p>Você ainda não tem nenhum aluno cadastrado. Comece adicionando seu primeiro aluno para desbloquear todas as funcionalidades.</p>
          <a href="/alunos" className="btn-primary">Cadastrar primeiro aluno</a>
        </div>
      </main>
    );
  }

  const handleQuickStatus = async (lessonId, status) => {
    setBusyLessonId(lessonId);
    try {
      const previousStatus = await updateLessonStatus(lessonId, status);
      const statusFeedbackMap = {
        pending: 'Aula marcada como pendente.',
        paid: 'Aula marcada como paga.',
        canceled_in_time: 'Aula marcada como falta avisada (sem cobrança).',
        no_show: 'Aula marcada como falta sem aviso (com cobrança).',
      };
      addToast(
        statusFeedbackMap[status] || 'Status da aula atualizado.',
        'success',
        6000,
        {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await updateLessonStatus(lessonId, previousStatus);
              if (status === 'canceled_in_time') {
                setRescheduleLesson(null);
              }
              addToast('Alteração desfeita.', 'info');
            } catch (undoError) {
              console.error('Erro ao desfazer status da aula:', undoError);
              addToast('Não foi possível desfazer a alteração agora.', 'error');
            }
          },
        }
      );
      if (status === 'canceled_in_time') {
        const lesson = todaysLessons.find((l) => l.id === lessonId);
        if (lesson) setRescheduleLesson(lesson);
      }
    } catch (error) {
      console.error('Erro ao atualizar status da aula:', error);
      addToast('Não foi possível atualizar o status da aula agora.', 'error');
    } finally {
      setBusyLessonId('');
    }
  };

  return (
    <main className="container">
      <header className="page-header dashboard__header">
        <div>
          <h1>Resumo Financeiro</h1>
          <p>Visão do {periodLabel} com as aulas programadas para hoje.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setIsLessonFormOpen(true)}
          disabled={!activeStudents.length}
        >
          <Plus size={16} />
          <span>Nova Aula</span>
        </button>
      </header>

      <OnboardingChecklist students={students} lessons={lessons} />

      <section className="dashboard__filters panel">
        <label>
          <span>Período</span>
          <select value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value)}>
            <option value="month">Mensal</option>
            <option value="quarter">Trimestral</option>
            <option value="semester">Semestral</option>
            <option value="year">Anual</option>
          </select>
        </label>

        <label>
          <span>Mês de referência</span>
          <input
            type="month"
            value={referenceMonth}
            onChange={(event) => setReferenceMonth(event.target.value)}
          />
        </label>
      </section>
      
      <div className="dashboard__grid">
        <StatCard 
          label="Saldo Recebido" 
          value={paidTotal} 
          type="paid" 
        />
        <StatCard 
          label="Estimativa a Receber" 
          value={pendingTotal} 
          type="pending" 
        />
        <StatCard 
          label="Projeção do Período" 
          value={monthlyProjection} 
          type="scheduled" 
        />
      </div>

      <section className="dashboard__today panel">
        <div className="dashboard__today-header">
          <h2>Aulas de Hoje</h2>
          <span>{todaysLessons.length} registro(s)</span>
        </div>

        {!activeStudents.length ? (
          <p className="dashboard__empty">
            Cadastre alunos ativos para começar a registrar aulas.
          </p>
        ) : todaysLessons.length === 0 ? (
          <p className="dashboard__empty">Sem aulas registradas para hoje.</p>
        ) : (
          <div className="dashboard__lesson-list">
            {todaysLessons.map((lesson) => {
              const student = studentsById.get(lesson.studentId);
              const lessonDate = lesson.date?.toDate?.();

              return (
                <article key={lesson.id} className="dashboard__lesson-item">
                  <div>
                    <strong>{student?.name || 'Aluno não encontrado'}</strong>
                    <p>
                      {student?.instrument || 'Instrumento não informado'} | {student?.origin || 'Sem origem'} |{' '}
                      {lessonDate ? lessonDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </p>
                  </div>

                  <div className="dashboard__lesson-meta">
                    <span className={`dashboard__status dashboard__status--${lesson.status}`}>
                      {getLessonStatusLabel(lesson.status)}
                    </span>
                    <strong>{formatCurrency(lesson.rateApplied)}</strong>
                  </div>

                  <div className="dashboard__lesson-actions">
                    {lesson.status === 'scheduled' ? (
                      <button
                        type="button"
                        className="dashboard__action"
                        onClick={() => handleQuickStatus(lesson.id, 'pending')}
                        disabled={busyLessonId === lesson.id}
                      >
                        <Check size={16} />
                        <span>Check-in</span>
                      </button>
                    ) : null}

                    {lesson.status === 'scheduled' || lesson.status === 'pending' || lesson.status === 'no_show' ? (
                      <button
                        type="button"
                        className="dashboard__action"
                        onClick={() => handleQuickStatus(lesson.id, 'paid')}
                        disabled={busyLessonId === lesson.id}
                      >
                        <CircleDollarSign size={16} />
                        <span>Marcar paga</span>
                      </button>
                    ) : null}

                    {lesson.status === 'scheduled' ? (
                      <button
                        type="button"
                        className="dashboard__action dashboard__action--danger"
                        onClick={() => handleQuickStatus(lesson.id, 'canceled_in_time')}
                        disabled={busyLessonId === lesson.id}
                      >
                        <XCircle size={16} />
                        <span>Falta avisada</span>
                      </button>
                    ) : null}

                    {lesson.status === 'scheduled' ? (
                      <button
                        type="button"
                        className="dashboard__action dashboard__action--danger"
                        onClick={() => handleQuickStatus(lesson.id, 'no_show')}
                        disabled={busyLessonId === lesson.id}
                      >
                        <XCircle size={16} />
                        <span>Falta sem aviso</span>
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isLessonFormOpen ? (
        <LessonForm
          students={activeStudents}
          lesson={rescheduleLesson ? { studentId: rescheduleLesson.studentId, rateApplied: rescheduleLesson.rateApplied, duration: rescheduleLesson.duration, type: rescheduleLesson.type } : undefined}
          onClose={() => { setIsLessonFormOpen(false); setRescheduleLesson(null); }}
          onSave={async (payload) => {
            await createLesson(payload);
            setRescheduleLesson(null);
            addToast('Aula reagendada com sucesso.');
          }}
        />
      ) : null}

      {rescheduleLesson && !isLessonFormOpen ? (
        <ConfirmDialog
          title="Reagendar aula?"
          message={`O aluno avisou com antecedência. Deseja criar uma nova aula para ${studentsById.get(rescheduleLesson.studentId)?.name || 'este aluno'}?`}
          confirmLabel="Reagendar"
          cancelLabel="Não, obrigado"
          onConfirm={() => setIsLessonFormOpen(true)}
          onCancel={() => setRescheduleLesson(null)}
        />
      ) : null}
    </main>
  );
};

export default Dashboard;