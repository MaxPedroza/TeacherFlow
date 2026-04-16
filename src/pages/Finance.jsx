import React, { useMemo, useState } from 'react';
import { PencilLine, Plus } from 'lucide-react';
import LessonForm from '../components/LessonForm/LessonForm.jsx';
import { useLessons } from '../hooks/useLessons.js';
import { useStudents } from '../hooks/useStudents.js';
import './Finance.scss';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatDateTime = (timestampValue) => {
  const date = timestampValue?.toDate?.();
  if (!date) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusLabel = {
  scheduled: 'Agendada',
  pending: 'Pendente',
  paid: 'Paga',
};

const Finance = () => {
  const [periodFilter, setPeriodFilter] = useState('month');
  const [statusFilter, setStatusFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  const {
    lessons,
    loading: lessonsLoading,
    createLesson,
    updateLesson,
    updateLessonStatus,
  } = useLessons();
  const { students, loading: studentsLoading } = useStudents();

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  const availableOrigins = useMemo(
    () => ['all', ...new Set(students.map((student) => student.origin).filter(Boolean))],
    [students]
  );

  const activeStudents = useMemo(
    () => students.filter((student) => student.status === 'active'),
    [students]
  );

  const filteredLessons = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return lessons
      .map((lesson) => {
        const student = studentsById.get(lesson.studentId);
        return {
          ...lesson,
          studentName: student?.name || 'Aluno não encontrado',
          instrument: student?.instrument || 'Não informado',
          origin: student?.origin || 'Sem origem',
        };
      })
      .filter((lesson) => {
        const lessonDate = lesson.date?.toDate?.();
        if (!lessonDate) return false;

        const periodMatch =
          periodFilter === 'all' ||
          (periodFilter === 'today' && lessonDate >= startOfDay && lessonDate <= endOfDay) ||
          (periodFilter === 'month' &&
            lessonDate.getMonth() === now.getMonth() &&
            lessonDate.getFullYear() === now.getFullYear());

        const statusMatch = statusFilter === 'all' || lesson.status === statusFilter;
        const originMatch = originFilter === 'all' || lesson.origin === originFilter;

        return periodMatch && statusMatch && originMatch;
      })
      .sort((firstLesson, secondLesson) => {
        const firstDate = firstLesson.date?.toDate?.()?.getTime() || 0;
        const secondDate = secondLesson.date?.toDate?.()?.getTime() || 0;
        return secondDate - firstDate;
      });
  }, [lessons, originFilter, periodFilter, statusFilter, studentsById]);

  const totals = useMemo(() => {
    return filteredLessons.reduce(
      (accumulator, lesson) => {
        const value = Number(lesson.rateApplied) || 0;
        if (lesson.status === 'paid') accumulator.paid += value;
        if (lesson.status === 'pending') accumulator.pending += value;
        if (lesson.status === 'scheduled') accumulator.scheduled += value;
        return accumulator;
      },
      { paid: 0, pending: 0, scheduled: 0 }
    );
  }, [filteredLessons]);

  if (lessonsLoading || studentsLoading) {
    return <div className="container">Carregando financeiro...</div>;
  }

  const openCreateLesson = () => {
    setSelectedLesson(null);
    setIsLessonFormOpen(true);
  };

  const openEditLesson = (lesson) => {
    setSelectedLesson(lesson);
    setIsLessonFormOpen(true);
  };

  const handleStatusChange = async (lessonId, nextStatus) => {
    try {
      await updateLessonStatus(lessonId, nextStatus);
      setFeedbackMessage('Status da aula atualizado.');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setFeedbackMessage('Não foi possível atualizar o status agora.');
    }
  };

  return (
    <main className="container">
      <header className="page-header finance-page__header">
        <div>
          <h1>Relatório Financeiro</h1>
          <p>Filtre aulas por origem, período e status para analisar pendências e pagamentos.</p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={openCreateLesson}
          disabled={!activeStudents.length}
        >
          <Plus size={16} />
          <span>Nova Aula</span>
        </button>
      </header>

      <section className="finance-page__filters panel">
        <label>
          <span>Período</span>
          <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
            <option value="today">Hoje</option>
            <option value="month">Mês atual</option>
            <option value="all">Todo período</option>
          </select>
        </label>

        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="scheduled">Agendada</option>
            <option value="pending">Pendente</option>
            <option value="paid">Paga</option>
          </select>
        </label>

        <label>
          <span>Origem</span>
          <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)}>
            {availableOrigins.map((origin) => (
              <option key={origin} value={origin}>
                {origin === 'all' ? 'Todas as origens' : origin}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="finance-page__summary">
        <article className="finance-page__metric panel">
          <span>Recebido</span>
          <strong>{formatCurrency(totals.paid)}</strong>
        </article>
        <article className="finance-page__metric panel">
          <span>Pendente</span>
          <strong>{formatCurrency(totals.pending)}</strong>
        </article>
        <article className="finance-page__metric panel">
          <span>Projeção</span>
          <strong>{formatCurrency(totals.pending + totals.paid)}</strong>
        </article>
      </section>

      {feedbackMessage ? <p className="finance-page__feedback">{feedbackMessage}</p> : null}

      <section className="finance-page__table-wrap panel">
        {filteredLessons.length === 0 ? (
          <p className="finance-page__empty">Nenhuma aula encontrada para os filtros selecionados.</p>
        ) : (
          <>
            <table className="finance-page__table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Origem</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLessons.map((lesson) => (
                  <tr key={lesson.id}>
                    <td>{lesson.studentName}</td>
                    <td>{lesson.origin}</td>
                    <td>{formatDateTime(lesson.date)}</td>
                    <td>{lesson.type}</td>
                    <td>
                      <select
                        value={lesson.status}
                        onChange={(event) => handleStatusChange(lesson.id, event.target.value)}
                      >
                        <option value="scheduled">Agendada</option>
                        <option value="pending">Pendente</option>
                        <option value="paid">Paga</option>
                      </select>
                    </td>
                    <td>{formatCurrency(lesson.rateApplied)}</td>
                    <td>
                      <button
                        type="button"
                        className="finance-page__edit"
                        onClick={() => openEditLesson(lesson)}
                      >
                        <PencilLine size={15} />
                        <span>Editar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="finance-page__cards">
              {filteredLessons.map((lesson) => (
                <article key={lesson.id} className="finance-page__card">
                  <div className="finance-page__card-top">
                    <strong>{lesson.studentName}</strong>
                    <span>{formatCurrency(lesson.rateApplied)}</span>
                  </div>
                  <p>
                    {lesson.instrument} | {lesson.origin} | {lesson.type}
                  </p>
                  <p>{formatDateTime(lesson.date)}</p>
                  <div className="finance-page__card-actions">
                    <select
                      value={lesson.status}
                      onChange={(event) => handleStatusChange(lesson.id, event.target.value)}
                    >
                      <option value="scheduled">{statusLabel.scheduled}</option>
                      <option value="pending">{statusLabel.pending}</option>
                      <option value="paid">{statusLabel.paid}</option>
                    </select>
                    <button type="button" onClick={() => openEditLesson(lesson)}>
                      Editar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {isLessonFormOpen ? (
        <LessonForm
          lesson={selectedLesson}
          students={activeStudents}
          onClose={() => setIsLessonFormOpen(false)}
          onSave={async (payload) => {
            if (selectedLesson) {
              await updateLesson(selectedLesson.id, payload);
              setFeedbackMessage('Aula atualizada com sucesso.');
            } else {
              await createLesson(payload);
              setFeedbackMessage('Aula cadastrada com sucesso.');
            }
          }}
        />
      ) : null}
    </main>
  );
};

export default Finance;