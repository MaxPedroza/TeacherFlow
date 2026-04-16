import React, { useMemo, useState } from 'react';
import { Calendar, List, Calendar as CalendarWeek, PencilLine, Plus, Trash2 } from 'lucide-react';
import LessonForm from '../components/LessonForm/LessonForm.jsx';
import { useLessons } from '../hooks/useLessons.js';
import { useStudents } from '../hooks/useStudents.js';
import './Schedule.scss';

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const Schedule = () => {
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar', 'list', 'week'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState('all');
  const [studentFilter, setStudentFilter] = useState('all');
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const { lessons, loading: lessonsLoading, createLesson, updateLesson, deleteLesson } = useLessons();
  const { students, loading: studentsLoading } = useStudents();

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  const activeStudents = useMemo(
    () => students.filter((student) => student.status === 'active'),
    [students]
  );

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      const statusMatch = statusFilter === 'all' || lesson.status === statusFilter;
      const studentMatch = studentFilter === 'all' || lesson.studentId === studentFilter;
      return statusMatch && studentMatch;
    });
  }, [lessons, statusFilter, studentFilter]);

  // Obter lições do mês atual (para calendário)
  const monthLessons = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);

    return filteredLessons.filter((lesson) => {
      const lessonDate = lesson.date?.toDate?.();
      return lessonDate >= start && lessonDate <= end;
    });
  }, [filteredLessons, currentDate]);

  // Obter lições da semana atual (para view semanal)
  const weekLessons = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59);

    return filteredLessons
      .filter((lesson) => {
        const lessonDate = lesson.date?.toDate?.();
        return lessonDate >= startOfWeek && lessonDate <= endOfWeek;
      })
      .sort((a, b) => {
        const aDate = a.date?.toDate?.()?.getTime() || 0;
        const bDate = b.date?.toDate?.()?.getTime() || 0;
        return aDate - bDate;
      });
  }, [filteredLessons]);

  // Gerar dias do calendário
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return days;
  }, [currentDate]);

  const getLessonsForDay = (day) => {
    if (!day) return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startOfDay = new Date(year, month, day, 0, 0, 0);
    const endOfDay = new Date(year, month, day, 23, 59, 59);

    return monthLessons.filter((lesson) => {
      const lessonDate = lesson.date?.toDate?.();
      return lessonDate >= startOfDay && lessonDate <= endOfDay;
    });
  };

  const isTodayCell = (day) => {
    if (!day) return false;

    const today = new Date();
    return (
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth() &&
      day === today.getDate()
    );
  };

  const openCreateLessonForDay = (day) => {
    if (!day || !activeStudents.length) return;

    setSelectedLesson(null);
    setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 9, 0, 0));
    setIsLessonFormOpen(true);
  };

  const openEditLesson = (lesson) => {
    setSelectedLesson(lesson);
    setSelectedDate(null);
    setFeedbackMessage('');
    setIsLessonFormOpen(true);
  };

  const handleDeleteLesson = async (lesson) => {
    const studentName = studentsById.get(lesson.studentId)?.name || 'este aluno';
    const confirmed = window.confirm(`Excluir a aula de ${studentName}?`);

    if (!confirmed) return;

    try {
      await deleteLesson(lesson.id);
      setFeedbackMessage('Aula excluída com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir aula:', error);
      setFeedbackMessage('Não foi possível excluir a aula agora.');
    }
  };

  const isBusy = lessonsLoading || studentsLoading;

  if (isBusy) return <div className="container">Carregando agenda...</div>;

  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <main className="container">
      <header className="page-header schedule__header">
        <div>
          <h1>Agenda</h1>
          <p>Visualize todas as suas aulas de forma flexível: calendário, lista ou semana.</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setSelectedLesson(null);
            setSelectedDate(new Date());
            setIsLessonFormOpen(true);
          }}
          disabled={!activeStudents.length}
        >
          <Plus size={16} />
          <span>Nova Aula</span>
        </button>
      </header>

      {feedbackMessage ? <p className="schedule__feedback">{feedbackMessage}</p> : null}

      <section className="schedule__controls panel">
        <div className="schedule__view-switcher">
          <button
            type="button"
            className={`schedule__view-btn ${viewMode === 'calendar' ? 'schedule__view-btn--active' : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            <Calendar size={18} />
            <span>Calendário</span>
          </button>
          <button
            type="button"
            className={`schedule__view-btn ${viewMode === 'week' ? 'schedule__view-btn--active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            <CalendarWeek size={18} />
            <span>Semana</span>
          </button>
          <button
            type="button"
            className={`schedule__view-btn ${viewMode === 'list' ? 'schedule__view-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={18} />
            <span>Lista</span>
          </button>
        </div>

        <div className="schedule__filters">
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="scheduled">Agendadas</option>
              <option value="pending">Pendentes</option>
              <option value="paid">Pagas</option>
            </select>
          </label>

          <label>
            <span>Aluno</span>
            <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
              <option value="all">Todos</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {viewMode === 'calendar' && (
        <section className="schedule__calendar panel">
          <div className="schedule__calendar-header">
            <button
              type="button"
              className="schedule__nav-btn"
              onClick={() =>
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
              }
            >
              ← Anterior
            </button>
            <h2>{monthName}</h2>
            <button
              type="button"
              className="schedule__nav-btn"
              onClick={() =>
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
              }
            >
              Próximo →
            </button>
          </div>

          <div className="schedule__weekdays">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sab</div>
          </div>

          <div className="schedule__grid">
            {calendarDays.map((day, index) => {
              const lessonsOfDay = day ? getLessonsForDay(day) : [];
              return (
                day ? (
                  <button
                    key={index}
                    type="button"
                    className={`schedule__day ${lessonsOfDay.length > 0 ? 'schedule__day--has-lessons' : ''} ${
                      isTodayCell(day) ? 'schedule__day--today' : ''
                    }`}
                    onClick={() => openCreateLessonForDay(day)}
                    title="Clique para cadastrar uma aula neste dia"
                  >
                    <div className="schedule__day-number">{day}</div>
                    <div className="schedule__day-lessons">
                      {lessonsOfDay.length > 0 ? (
                        lessonsOfDay.map((lesson) => {
                          const student = studentsById.get(lesson.studentId);
                          const lessonDate = lesson.date?.toDate?.();
                          const lessonTime = lessonDate
                            ? lessonDate.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            : '--:--';

                          return (
                            <div key={lesson.id} className="schedule__lesson-entry">
                              <span
                                className={`schedule__lesson-dot schedule__lesson-dot--${lesson.status}`}
                                aria-hidden="true"
                              />
                              <div className="schedule__lesson-text">
                                <span className="schedule__lesson-name">
                                  {student?.name || 'Aluno'} ({lessonTime})
                                </span>
                                <span className="schedule__lesson-instrument">
                                  {student?.instrument || 'Instrumento não informado'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <span className="schedule__lesson-empty">Clique para adicionar</span>
                      )}
                    </div>
                  </button>
                ) : (
                  <div key={index} className="schedule__day schedule__day--empty" />
                )
              );
            })}
          </div>
        </section>
      )}

      {viewMode === 'week' && (
        <section className="schedule__week panel">
          <h2>Próximos 7 dias</h2>
          {weekLessons.length === 0 ? (
            <p className="schedule__empty">Nenhuma aula agendada para esta semana.</p>
          ) : (
            <div className="schedule__week-list">
              {weekLessons.map((lesson) => {
                const student = studentsById.get(lesson.studentId);
                const lessonDate = lesson.date?.toDate?.();

                return (
                  <article key={lesson.id} className="schedule__week-item">
                    <div className="schedule__week-date">
                      <strong>{lessonDate?.toLocaleDateString('pt-BR')}</strong>
                      <span>{lessonDate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="schedule__week-info">
                      <strong>{student?.name || 'Aluno'}</strong>
                      <p>{student?.instrument || 'Instrumento não informado'} • {student?.origin} • {lesson.duration} min • {formatCurrency(lesson.rateApplied)}</p>
                    </div>

                    <div className="schedule__item-side">
                      <span className={`schedule__status schedule__status--${lesson.status}`}>
                        {lesson.status === 'scheduled'
                          ? 'Agendada'
                          : lesson.status === 'pending'
                            ? 'Pendente'
                            : 'Paga'}
                      </span>

                      <div className="schedule__item-actions">
                        <button
                          type="button"
                          className="schedule__action-btn"
                          onClick={() => openEditLesson(lesson)}
                        >
                          <PencilLine size={14} />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          className="schedule__action-btn schedule__action-btn--danger"
                          onClick={() => handleDeleteLesson(lesson)}
                        >
                          <Trash2 size={14} />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {viewMode === 'list' && (
        <section className="schedule__list panel">
          <h2>Todas as aulas</h2>
          {filteredLessons.length === 0 ? (
            <p className="schedule__empty">Nenhuma aula encontrada com os filtros aplicados.</p>
          ) : (
            <div className="schedule__list-items">
              {filteredLessons
                .sort((a, b) => {
                  const aDate = a.date?.toDate?.()?.getTime() || 0;
                  const bDate = b.date?.toDate?.()?.getTime() || 0;
                  return aDate - bDate;
                })
                .map((lesson) => {
                  const student = studentsById.get(lesson.studentId);
                  const lessonDate = lesson.date?.toDate?.();

                  return (
                    <article key={lesson.id} className="schedule__list-item">
                      <div className="schedule__list-left">
                        <div className="schedule__list-date">
                          <strong>{lessonDate?.toLocaleDateString('pt-BR')}</strong>
                          <span>{lessonDate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="schedule__list-middle">
                        <strong>{student?.name || 'Aluno'}</strong>
                        <p>{student?.instrument || 'Instrumento não informado'} • {student?.origin} • {lesson.duration} min • {lesson.content || 'Sem descrição'}</p>
                      </div>

                      <div className="schedule__list-right">
                        <span className={`schedule__status schedule__status--${lesson.status}`}>
                          {lesson.status === 'scheduled'
                            ? 'Agendada'
                            : lesson.status === 'pending'
                              ? 'Pendente'
                              : 'Paga'}
                        </span>
                        <strong>{formatCurrency(lesson.rateApplied)}</strong>

                        <div className="schedule__item-actions">
                          <button
                            type="button"
                            className="schedule__action-btn"
                            onClick={() => openEditLesson(lesson)}
                          >
                            <PencilLine size={14} />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            className="schedule__action-btn schedule__action-btn--danger"
                            onClick={() => handleDeleteLesson(lesson)}
                          >
                            <Trash2 size={14} />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {isLessonFormOpen ? (
        <LessonForm
          lesson={selectedLesson}
          students={activeStudents}
          initialDate={selectedDate}
          onClose={() => {
            setIsLessonFormOpen(false);
            setSelectedDate(null);
            setSelectedLesson(null);
          }}
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

export default Schedule;
