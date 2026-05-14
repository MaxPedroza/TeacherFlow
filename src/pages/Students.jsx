import React, { useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { BookOpen, ChevronDown, ChevronUp, Crown, PencilLine, RotateCcw, ScrollText, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import { useStudents } from '../hooks/useStudents';
import { useLessons } from '../hooks/useLessons.js';
import { INSTRUMENT_OPTIONS } from '../constants/instruments.js';
import { getLessonStatusLabel } from '../constants/lessonStatus.js';
import { db } from '../services/firebase.js';
import { useToast } from '../context/ToastContext.jsx';
import usePlan from '../hooks/usePlan.js';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog.jsx';
import PageSpinner from '../components/PageSpinner/PageSpinner.jsx';
import StudentForm from './StudentForm.jsx';
import './Students.scss';

const SIX_MONTHS_IN_MS = 1000 * 60 * 60 * 24 * 180;

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const formatPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value || 'Não informado';
};

const isEligibleForHardDelete = (student) => {
  const inactiveDate = student.inactiveAt?.toDate?.() || student.lastLessonDate?.toDate?.();
  if (!inactiveDate) return false;
  return Date.now() - inactiveDate.getTime() >= SIX_MONTHS_IN_MS;
};

const Students = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [instrumentFilter, setInstrumentFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmStudent, setConfirmStudent] = useState(null);
  const [busyStudentId, setBusyStudentId] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [historyStudent, setHistoryStudent] = useState(null);
  const { addToast } = useToast();
  const { students, loading } = useStudents();
  const { lessons } = useLessons();
  const { isPro } = usePlan();

  const FREE_STUDENT_LIMIT = 5;
  const activeCount = useMemo(() => students.filter((s) => s.status === 'active').length, [students]);
  const atFreeLimit = !isPro && activeCount >= FREE_STUDENT_LIMIT;

  const origins = useMemo(() => {
    const values = students.map((student) => student.origin).filter(Boolean);
    return ['all', ...new Set(values)];
  }, [students]);

  const instruments = useMemo(() => {
    const values = students.map((student) => student.instrument?.trim()).filter(Boolean);
    return ['all', 'none', ...new Set([...INSTRUMENT_OPTIONS, ...values])];
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
      const matchesOrigin = originFilter === 'all' || student.origin === originFilter;
      const normalizedInstrument = student.instrument?.trim() || '';
      const matchesInstrument =
        instrumentFilter === 'all' ||
        (instrumentFilter === 'none' ? !normalizedInstrument : normalizedInstrument === instrumentFilter);
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.trim().toLowerCase());
      return matchesStatus && matchesOrigin && matchesInstrument && matchesSearch;
    });
  }, [students, statusFilter, originFilter, instrumentFilter, searchTerm]);

  const closeForm = () => {
    setSelectedStudent(null);
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    setSelectedStudent(null);
    setIsFormOpen(true);
  };

  const openEditForm = (student) => {
    setSelectedStudent(student);
    setIsFormOpen(true);
  };

  const runStudentAction = async (studentId, action, successMessage) => {
    setBusyStudentId(studentId);
    try {
      await action();
      addToast(successMessage);
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      addToast('Não foi possível concluir a ação agora.', 'error');
    } finally {
      setBusyStudentId('');
    }
  };

  const toggleStudentStatus = async (student) => {
    const nextStatus = student.status === 'active' ? 'inactive' : 'active';
    await runStudentAction(
      student.id,
      () => updateDoc(doc(db, 'students', student.id), {
        status: nextStatus,
        inactiveAt: nextStatus === 'inactive' ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      }),
      nextStatus === 'inactive' ? 'Aluno marcado como inativo.' : 'Aluno reativado.'
    );
  };

  const convertStudent = async (student) => {
    await runStudentAction(
      student.id,
      () => updateDoc(doc(db, 'students', student.id), {
        isEffective: true,
        updatedAt: serverTimestamp(),
      }),
      'Aluno convertido para efetivo.'
    );
  };

  const removeStudent = (student) => {
    if (!isEligibleForHardDelete(student)) {
      addToast('Esse aluno ainda não pode ser excluído definitivamente.', 'error');
      return;
    }
    setConfirmStudent(student);
  };

  const confirmRemoveStudent = async () => {
    const student = confirmStudent;
    setConfirmStudent(null);
    await runStudentAction(
      student.id,
      () => deleteDoc(doc(db, 'students', student.id)),
      'Aluno excluído definitivamente.'
    );
  };

  if (loading) return <PageSpinner message="Carregando alunos..." />;

  return (
    <main className="container">
      <header className="page-header students-page__header">
        <div>
          <h1>Gestão de Alunos</h1>
          <p>
            Filtre por origem e status, edite cadastros e controle o ciclo de vida sem perder histórico.
          </p>
        </div>

        {atFreeLimit ? (
          <a href="/planos" className="btn-primary students-page__upgrade-btn">
            <Crown size={16} />
            <span>Limite free atingido — Ver planos</span>
          </a>
        ) : (
          <button className="btn-primary" onClick={openCreateForm}>
            <UserPlus size={18} />
            <span>Novo Aluno</span>
          </button>
        )}
      </header>

      <section className="students-page__filters panel">
        <label className="students-page__filter-field">
          <span>Busca</span>
          <input
            type="search"
            placeholder="Buscar por nome"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="students-page__filter-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>

        <label className="students-page__filter-field">
          <span>Origem</span>
          <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)}>
            {origins.map((origin) => (
              <option key={origin} value={origin}>
                {origin === 'all' ? 'Todas' : origin}
              </option>
            ))}
          </select>
        </label>

        <label className="students-page__filter-field">
          <span>Instrumento</span>
          <select value={instrumentFilter} onChange={(event) => setInstrumentFilter(event.target.value)}>
            {instruments.map((instrument) => (
              <option key={instrument} value={instrument}>
                {instrument === 'all'
                  ? 'Todos'
                  : instrument === 'none'
                    ? 'Não informado'
                    : instrument}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="students-page__list">
        {filteredStudents.length === 0 ? (
          <div className="students-page__empty panel">
            <h2>Nenhum aluno encontrado</h2>
            <p>Ajuste os filtros ou cadastre um novo aluno para começar.</p>
          </div>
        ) : (
          filteredStudents.map((student) => {
            const isExpanded = expandedId === student.id;
            const toggle = () => setExpandedId(isExpanded ? null : student.id);

            return (
            <article key={student.id} className={`student-card panel${isExpanded ? ' student-card--expanded' : ''}`}>
              <button
                type="button"
                className="student-card__summary"
                onClick={toggle}
                aria-expanded={isExpanded}
              >
                <div className="student-card__summary-left">
                  <div className="student-card__meta">
                    <span className={`student-card__badge ${student.origin === 'Particular' ? 'student-card__badge--particular' : 'student-card__badge--school'}`}>
                      {student.origin}
                    </span>
                    {!student.isEffective ? (
                      <span className="student-card__badge student-card__badge--demo">Demonstrativo</span>
                    ) : null}
                    <span className={`student-card__badge ${student.status === 'active' ? 'student-card__badge--active' : 'student-card__badge--inactive'}`}>
                      {student.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <h3 className="student-card__name">{student.name}</h3>
                </div>

                <div className="student-card__summary-right">
                  <strong className="student-card__rate">{formatCurrency(student.rateDefault)}</strong>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {isExpanded && (
                <>
                  <div className="student-card__details">
                    <span>{student.defaultDuration || 60} min por aula</span>
                    <span>Telefone: {formatPhone(student.phone)}</span>
                    <span>Instrumento: {student.instrument || 'Não informado'}</span>
                    <span>
                      {student.lastLessonDate?.toDate
                        ? `Última aula: ${student.lastLessonDate.toDate().toLocaleDateString('pt-BR')}`
                        : 'Sem aula registrada'}
                    </span>
                  </div>

                  <div className="student-card__actions">
                    <button
                      type="button"
                      className="student-card__action"
                      onClick={() => openEditForm(student)}
                      disabled={busyStudentId === student.id}
                    >
                      <PencilLine size={16} />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      className="student-card__action"
                      onClick={() => setHistoryStudent(student)}
                    >
                      <ScrollText size={16} />
                      <span>Histórico</span>
                    </button>

                    <button
                      type="button"
                      className="student-card__action"
                      onClick={() => toggleStudentStatus(student)}
                      disabled={busyStudentId === student.id}
                    >
                      <RotateCcw size={16} />
                      <span>{student.status === 'active' ? 'Inativar' : 'Reativar'}</span>
                    </button>

                    {!student.isEffective ? (
                      <button
                        type="button"
                        className="student-card__action"
                        onClick={() => convertStudent(student)}
                        disabled={busyStudentId === student.id}
                      >
                        <ShieldCheck size={16} />
                        <span>Efetivar</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className="student-card__action student-card__action--danger"
                      onClick={() => removeStudent(student)}
                      disabled={busyStudentId === student.id || !isEligibleForHardDelete(student)}
                      title={isEligibleForHardDelete(student) ? 'Excluir definitivamente' : 'Disponível apenas após 6 meses de inatividade'}
                    >
                      <Trash2 size={16} />
                      <span>Excluir</span>
                    </button>
                  </div>
                </>
              )}
            </article>
            );
          })
        )}
      </div>

      {isFormOpen ? (
        <StudentForm
          student={selectedStudent}
          onClose={closeForm}
          onSuccess={() => addToast(selectedStudent ? 'Aluno atualizado com sucesso.' : 'Aluno cadastrado com sucesso.')}
        />
      ) : null}

      {confirmStudent ? (
        <ConfirmDialog
          title="Excluir aluno definitivamente?"
          message={`"${confirmStudent.name}" será removido permanentemente. Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          danger
          onConfirm={confirmRemoveStudent}
          onCancel={() => setConfirmStudent(null)}
        />
      ) : null}

      {historyStudent ? (
        <div className="student-history-modal__overlay" onClick={() => setHistoryStudent(null)}>
          <div className="student-history-modal" onClick={(e) => e.stopPropagation()}>
            <header className="student-history-modal__header">
              <div className="student-history-modal__title">
                <ScrollText size={18} />
                <h2>Histórico — {historyStudent.name}</h2>
              </div>
              <button
                type="button"
                className="student-history-modal__close"
                onClick={() => setHistoryStudent(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            {(() => {
              const studentLessons = lessons
                .filter((l) => l.studentId === historyStudent.id)
                .sort((a, b) => {
                  const aDate = a.date?.toDate?.()?.getTime() || 0;
                  const bDate = b.date?.toDate?.()?.getTime() || 0;
                  return bDate - aDate;
                });

              if (studentLessons.length === 0) {
                return (
                  <p className="student-history-modal__empty">
                    Nenhuma aula registrada para este aluno.
                  </p>
                );
              }

              return (
                <div className="student-history-modal__list">
                  {studentLessons.map((lesson) => {
                    const lessonDate = lesson.date?.toDate?.();
                    return (
                      <div key={lesson.id} className="student-history-modal__item">
                        <div className="student-history-modal__item-header">
                          <div className="student-history-modal__item-date">
                            <strong>
                              {lessonDate?.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) || '--'}
                            </strong>
                            <span>
                              {lessonDate?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '--:--'}
                            </span>
                          </div>
                          <div className="student-history-modal__item-meta">
                            <span className={`schedule__status schedule__status--${lesson.status}`}>
                              {getLessonStatusLabel(lesson.status)}
                            </span>
                            <span>{lesson.duration} min</span>
                            <span>{formatCurrency(lesson.rateApplied)}</span>
                          </div>
                        </div>
                        {lesson.content ? (
                          <p className="student-history-modal__item-content">
                            <BookOpen size={12} />
                            {lesson.content}
                          </p>
                        ) : (
                          <p className="student-history-modal__item-no-content">Sem conteúdo registrado</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default Students;