import React, { useMemo, useState } from 'react';
import { PencilLine, Plus } from 'lucide-react';
import LessonForm from '../components/LessonForm/LessonForm.jsx';
import { useLessons } from '../hooks/useLessons.js';
import { useStudents } from '../hooks/useStudents.js';
import {
  LESSON_STATUS_OPTIONS,
  getLessonStatusLabel,
  isReceivableStatus,
} from '../constants/lessonStatus.js';
import './Finance.scss';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

const Finance = () => {
  const [periodFilter, setPeriodFilter] = useState('month');
  const [customMonth, setCustomMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
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

  const availableStudents = useMemo(
    () => [
      { id: 'all', name: 'Todos os alunos' },
      ...students
        .map((student) => ({ id: student.id, name: student.name || 'Aluno sem nome' }))
        .sort((firstStudent, secondStudent) => firstStudent.name.localeCompare(secondStudent.name, 'pt-BR')),
    ],
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

    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59);

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [customYear, customMonthIndex] = customMonth.split('-').map(Number);

    const currentQuarter = Math.floor(now.getMonth() / 3);
    const quarterStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
    const quarterEnd = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59);

    const semesterStart = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
    const semesterEnd = new Date(now.getFullYear(), now.getMonth() < 6 ? 6 : 12, 0, 23, 59, 59);

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
          (periodFilter === 'week' && lessonDate >= startOfWeek && lessonDate <= endOfWeek) ||
          (periodFilter === 'month' &&
            lessonDate.getMonth() === now.getMonth() &&
            lessonDate.getFullYear() === now.getFullYear()) ||
          (periodFilter === 'last_month' &&
            lessonDate.getMonth() === lastMonthDate.getMonth() &&
            lessonDate.getFullYear() === lastMonthDate.getFullYear()) ||
          (periodFilter === 'custom_month' &&
            lessonDate.getMonth() === customMonthIndex - 1 &&
            lessonDate.getFullYear() === customYear) ||
          (periodFilter === 'quarter' && lessonDate >= quarterStart && lessonDate <= quarterEnd) ||
          (periodFilter === 'semester' && lessonDate >= semesterStart && lessonDate <= semesterEnd) ||
          (periodFilter === 'year' && lessonDate.getFullYear() === now.getFullYear());

        const statusMatch = statusFilter === 'all' || lesson.status === statusFilter;

        const normalizedOrigin = normalizeText(lesson.origin);
        const categoryMatch =
          categoryFilter === 'all' ||
          (categoryFilter === 'school' && normalizedOrigin.includes('escola')) ||
          (categoryFilter === 'private' && normalizedOrigin.includes('particular'));

        const originMatch = originFilter === 'all' || lesson.origin === originFilter;
        const studentMatch = studentFilter === 'all' || lesson.studentId === studentFilter;

        return periodMatch && statusMatch && categoryMatch && originMatch && studentMatch;
      })
      .sort((firstLesson, secondLesson) => {
        const firstDate = firstLesson.date?.toDate?.()?.getTime() || 0;
        const secondDate = secondLesson.date?.toDate?.()?.getTime() || 0;
        return secondDate - firstDate;
      });
  }, [categoryFilter, customMonth, lessons, originFilter, periodFilter, statusFilter, studentFilter, studentsById]);

  const totals = useMemo(() => {
    return filteredLessons.reduce(
      (accumulator, lesson) => {
        const value = Number(lesson.rateApplied) || 0;
        if (lesson.status === 'paid') accumulator.paid += value;
        if (isReceivableStatus(lesson.status)) accumulator.pending += value;
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
            <option value="week">Semana atual</option>
            <option value="month">Mês atual</option>
            <option value="last_month">Mês anterior</option>
            <option value="custom_month">Mês específico</option>
            <option value="quarter">Trimestre atual</option>
            <option value="semester">Semestre atual</option>
            <option value="year">Ano atual</option>
            <option value="all">Todo período</option>
          </select>
          {periodFilter === 'custom_month' && (
            <input
              type="month"
              value={customMonth}
              onChange={(event) => setCustomMonth(event.target.value)}
              className="finance-page__month-picker"
            />
          )}
        </label>

        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos</option>
            {LESSON_STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Categoria</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Todas</option>
            <option value="school">Escola</option>
            <option value="private">Particular</option>
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

        <label>
          <span>Aluno</span>
          <select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
            {availableStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
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
                        {LESSON_STATUS_OPTIONS.map((statusOption) => (
                          <option key={statusOption.value} value={statusOption.value}>
                            {statusOption.label}
                          </option>
                        ))}
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
                      {LESSON_STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption.value} value={statusOption.value}>
                          {statusOption.label}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => openEditLesson(lesson)}>
                      Editar
                    </button>
                  </div>
                  <p>Status: {getLessonStatusLabel(lesson.status)}</p>
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