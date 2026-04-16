import React, { useMemo, useState } from 'react';
import { Check, CircleDollarSign, Plus } from 'lucide-react';
import StatCard from '../components/StatCard/StatCard.jsx';
import { useBilling } from '../hooks/useBilling.js';
import { useLessons } from '../hooks/useLessons.js';
import { useStudents } from '../hooks/useStudents.js';
import LessonForm from '../components/LessonForm/LessonForm.jsx';
import './Dashboard.scss';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const Dashboard = () => {
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const { pendingTotal, paidTotal, monthlyProjection, loading } = useBilling();
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

  if (isBusy) return <div className="container">Carregando dados...</div>;

  const handleQuickStatus = async (lessonId, status) => {
    try {
      await updateLessonStatus(lessonId, status);
      setFeedbackMessage(
        status === 'pending' ? 'Aula marcada como pendente.' : 'Aula marcada como paga.'
      );
    } catch (error) {
      console.error('Erro ao atualizar status da aula:', error);
      setFeedbackMessage('Não foi possível atualizar o status da aula agora.');
    }
  };

  return (
    <main className="container">
      <header className="page-header dashboard__header">
        <div>
          <h1>Resumo Financeiro</h1>
          <p>Visão do mês atual com as aulas programadas para hoje.</p>
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
          label="Projeção Mensal" 
          value={monthlyProjection} 
          type="scheduled" 
        />
      </div>

      {feedbackMessage ? <p className="dashboard__feedback">{feedbackMessage}</p> : null}

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
                      {lesson.status === 'scheduled'
                        ? 'Agendada'
                        : lesson.status === 'pending'
                          ? 'Pendente'
                          : 'Paga'}
                    </span>
                    <strong>{formatCurrency(lesson.rateApplied)}</strong>
                  </div>

                  <div className="dashboard__lesson-actions">
                    {lesson.status === 'scheduled' ? (
                      <button
                        type="button"
                        className="dashboard__action"
                        onClick={() => handleQuickStatus(lesson.id, 'pending')}
                      >
                        <Check size={16} />
                        <span>Check-in</span>
                      </button>
                    ) : null}

                    {lesson.status !== 'paid' ? (
                      <button
                        type="button"
                        className="dashboard__action"
                        onClick={() => handleQuickStatus(lesson.id, 'paid')}
                      >
                        <CircleDollarSign size={16} />
                        <span>Marcar paga</span>
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
          onClose={() => setIsLessonFormOpen(false)}
          onSave={async (payload) => {
            await createLesson(payload);
            setFeedbackMessage('Aula cadastrada com sucesso.');
          }}
        />
      ) : null}
    </main>
  );
};

export default Dashboard;