import React, { useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { PencilLine, RotateCcw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useStudents } from '../hooks/useStudents';
import { INSTRUMENT_OPTIONS } from '../constants/instruments.js';
import { db } from '../services/firebase.js';
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
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [busyStudentId, setBusyStudentId] = useState('');
  const { students, loading } = useStudents();

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
    setFeedbackMessage('');
    setSelectedStudent(null);
    setIsFormOpen(true);
  };

  const openEditForm = (student) => {
    setFeedbackMessage('');
    setSelectedStudent(student);
    setIsFormOpen(true);
  };

  const runStudentAction = async (studentId, action, successMessage) => {
    setBusyStudentId(studentId);
    setFeedbackMessage('');
    try {
      await action();
      setFeedbackMessage(successMessage);
    } catch (error) {
      console.error('Erro ao atualizar aluno:', error);
      setFeedbackMessage('Não foi possível concluir a ação agora.');
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

  const removeStudent = async (student) => {
    if (!isEligibleForHardDelete(student)) {
      setFeedbackMessage('Esse aluno ainda não pode ser excluído definitivamente.');
      return;
    }

    await runStudentAction(
      student.id,
      () => deleteDoc(doc(db, 'students', student.id)),
      'Aluno excluído definitivamente.'
    );
  };

  if (loading) return <div className="container">Carregando alunos...</div>;

  return (
    <main className="container">
      <header className="page-header students-page__header">
        <div>
          <h1>Gestão de Alunos</h1>
          <p>
            Filtre por origem e status, edite cadastros e controle o ciclo de vida sem perder histórico.
          </p>
        </div>

        <button className="btn-primary" onClick={openCreateForm}>
          <UserPlus size={18} />
          <span>Novo Aluno</span>
        </button>
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

      {feedbackMessage ? <p className="students-page__feedback">{feedbackMessage}</p> : null}

      <div className="students-page__list">
        {filteredStudents.length === 0 ? (
          <div className="students-page__empty panel">
            <h2>Nenhum aluno encontrado</h2>
            <p>Ajuste os filtros ou cadastre um novo aluno para começar.</p>
          </div>
        ) : (
          filteredStudents.map((student) => (
            <article key={student.id} className="student-card panel">
              <div className="student-card__top-row">
                <div>
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

                <strong className="student-card__rate">{formatCurrency(student.rateDefault)}</strong>
              </div>

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
            </article>
          ))
        )}
      </div>

      {isFormOpen ? (
        <StudentForm
          student={selectedStudent}
          onClose={closeForm}
          onSuccess={() => {
            setFeedbackMessage(selectedStudent ? 'Aluno atualizado com sucesso.' : 'Aluno cadastrado com sucesso.');
          }}
        />
      ) : null}
    </main>
  );
};

export default Students;