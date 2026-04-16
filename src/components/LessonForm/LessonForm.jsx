import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import './LessonForm.scss';

const toInputDateTime = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const tzOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const LessonForm = ({ lesson, students, initialDate, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatCount, setRepeatCount] = useState(4);
  const resolvedInitialDate = lesson?.date?.toDate
    ? lesson.date.toDate()
    : lesson?.date || initialDate || new Date();
  const [formData, setFormData] = useState(() => ({
    studentId: lesson?.studentId || students[0]?.id || '',
    date: toInputDateTime(resolvedInitialDate),
    duration: String(lesson?.duration || 60),
    rateApplied: String(lesson?.rateApplied ?? ''),
    content: lesson?.content || '',
    type: lesson?.type || 'Normal',
    status: lesson?.status || 'scheduled',
  }));

  const isEditing = Boolean(lesson?.id);
  const isDemo = formData.type === 'Demonstrativa';

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === formData.studentId),
    [students, formData.studentId]
  );

  const setField = (field, value) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  };

  const handleStudentChange = (studentId) => {
    const nextStudent = students.find((student) => student.id === studentId);

    setFormData((currentData) => ({
      ...currentData,
      studentId,
      duration: currentData.type === 'Demonstrativa' ? '30' : String(nextStudent?.defaultDuration || currentData.duration || 60),
      rateApplied: currentData.type === 'Demonstrativa' ? '0' : String(nextStudent?.rateDefault ?? currentData.rateApplied ?? ''),
    }));
  };

  const handleTypeChange = (type) => {
    setFormData((currentData) => ({
      ...currentData,
      type,
      duration: type === 'Demonstrativa' ? '30' : currentData.duration,
      rateApplied: type === 'Demonstrativa' ? '0' : currentData.rateApplied,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formData.studentId) {
      setErrorMessage('Selecione um aluno para a aula.');
      return;
    }

    const lessonDate = new Date(formData.date);
    const rateValue = Number(formData.rateApplied);
    const durationValue = Number(formData.duration);

    if (Number.isNaN(lessonDate.getTime())) {
      setErrorMessage('Informe uma data válida para a aula.');
      return;
    }

    if (!isDemo && (Number.isNaN(rateValue) || rateValue < 0)) {
      setErrorMessage('Informe um valor válido para a aula.');
      return;
    }

    if (!isDemo && (Number.isNaN(durationValue) || durationValue <= 0)) {
      setErrorMessage('Informe uma duração válida para a aula.');
      return;
    }

    if (!isEditing && repeatWeekly && (Number.isNaN(Number(repeatCount)) || Number(repeatCount) < 2 || Number(repeatCount) > 52)) {
      setErrorMessage('A repetição semanal deve estar entre 2 e 52 semanas.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await onSave({
        studentId: formData.studentId,
        date: lessonDate,
        duration: isDemo ? 30 : durationValue,
        rateApplied: isDemo ? 0 : rateValue,
        content: formData.content,
        type: formData.type,
        status: formData.status,
        recurrenceWeeks: !isEditing && repeatWeekly ? Number(repeatCount) : 1,
      });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar aula:', error);
      setErrorMessage('Não foi possível salvar a aula agora.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content lesson-form">
        <header className="lesson-form__header">
          <h2>{isEditing ? 'Editar Aula' : 'Nova Aula'}</h2>
          <button type="button" className="lesson-form__close" onClick={onClose}>
            <X size={24} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="lesson-form__form">
          {errorMessage ? <p className="lesson-form__error">{errorMessage}</p> : null}

          <div className="form-group">
            <label>Aluno</label>
            <select
              value={formData.studentId}
              onChange={(event) => handleStudentChange(event.target.value)}
              required
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data e horário</label>
              <input
                type="datetime-local"
                value={formData.date}
                onChange={(event) => setField('date', event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(event) => setField('status', event.target.value)}
              >
                <option value="scheduled">Agendada</option>
                <option value="pending">Pendente</option>
                <option value="paid">Paga</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tipo</label>
              <select value={formData.type} onChange={(event) => handleTypeChange(event.target.value)}>
                <option value="Normal">Normal</option>
                <option value="Demonstrativa">Demonstrativa</option>
              </select>
            </div>

            <div className="form-group">
              <label>Duração (min)</label>
              <input
                type="number"
                min="15"
                step="5"
                value={isDemo ? '30' : formData.duration}
                onChange={(event) => setField('duration', event.target.value)}
                disabled={isDemo}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Valor aplicado (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={isDemo ? '0' : formData.rateApplied}
              onChange={(event) => setField('rateApplied', event.target.value)}
              disabled={isDemo}
              required
            />
          </div>

          <div className="form-group">
            <label>Conteúdo ministrado</label>
            <textarea
              rows={3}
              placeholder="Resumo do conteúdo da aula"
              value={formData.content}
              onChange={(event) => setField('content', event.target.value)}
            />
          </div>

          {!isEditing ? (
            <div className="lesson-form__recurrence">
              <label className="lesson-form__checkbox">
                <input
                  type="checkbox"
                  checked={repeatWeekly}
                  onChange={(event) => setRepeatWeekly(event.target.checked)}
                />
                <span>Repetir semanalmente</span>
              </label>

              {repeatWeekly ? (
                <div className="form-group">
                  <label>Quantidade de semanas</label>
                  <input
                    type="number"
                    min="2"
                    max="52"
                    value={repeatCount}
                    onChange={(event) => setRepeatCount(event.target.value)}
                    required
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {selectedStudent ? (
            <p className="lesson-form__hint">
              Instrumento: {selectedStudent.instrument || 'Não informado'} | Origem: {selectedStudent.origin} | Padrão aluno: {selectedStudent.defaultDuration || 60} min /{' '}
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                selectedStudent.rateDefault || 0
              )}
            </p>
          ) : null}

          <div className="lesson-form__actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : isEditing ? 'Salvar Aula' : 'Cadastrar Aula'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonForm;