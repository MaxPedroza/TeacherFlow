import React, { useState } from 'react';
import { db } from '../services/firebase.js';
import { collection, addDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuthContext } from '../context/AuthContext.jsx';
import { X } from 'lucide-react';
import { INSTRUMENT_OPTIONS } from '../constants/instruments.js';
import './StudentForm.scss';

const OTHER_INSTRUMENT_OPTION = '__other__';

const defaultFormState = {
  name: '',
  phone: '',
  instrumentPreset: '',
  instrumentCustom: '',
  origin: 'Particular',
  rateDefault: '',
  defaultDuration: '60',
  isEffective: true,
};

const StudentForm = ({ onClose, student, onSuccess }) => {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const initialInstrument = student?.instrument?.trim() || '';
  const initialInstrumentIsPreset = INSTRUMENT_OPTIONS.includes(initialInstrument);
  const [formData, setFormData] = useState(() => ({
    ...defaultFormState,
    name: student?.name || '',
    phone: student?.phone || '',
    instrumentPreset: initialInstrumentIsPreset
      ? initialInstrument
      : initialInstrument
        ? OTHER_INSTRUMENT_OPTION
        : '',
    instrumentCustom: initialInstrumentIsPreset ? '' : initialInstrument,
    origin: student?.origin || 'Particular',
    rateDefault: student?.rateDefault?.toString() || '',
    defaultDuration: student?.defaultDuration?.toString() || '60',
    isEffective: student?.isEffective ?? true,
  }));

  const isEditing = Boolean(student?.id);

  const updateField = (field, value) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = formData.name.trim();
    const trimmedPhone = formData.phone.trim();
    const normalizedPhone = trimmedPhone.replace(/\D/g, '');
    const trimmedInstrument = (
      formData.instrumentPreset === OTHER_INSTRUMENT_OPTION
        ? formData.instrumentCustom
        : formData.instrumentPreset
    ).trim();
    const trimmedOrigin = formData.origin.trim();
    const rateValue = Number(formData.rateDefault);
    const defaultDurationValue = Number(formData.defaultDuration);

    if (!trimmedName || !trimmedOrigin) {
      setErrorMessage('Nome e origem são obrigatórios.');
      return;
    }

    if (Number.isNaN(rateValue) || rateValue < 0) {
      setErrorMessage('Informe um valor por aula válido.');
      return;
    }

    if (Number.isNaN(defaultDurationValue) || defaultDurationValue < 15) {
      setErrorMessage('Informe uma duração padrão válida (mínimo 15 min).');
      return;
    }

    if (trimmedPhone && ![10, 11].includes(normalizedPhone.length)) {
      setErrorMessage('Informe um telefone válido com DDD.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const payload = {
        name: trimmedName,
        phone: normalizedPhone || null,
        instrument: trimmedInstrument || null,
        origin: trimmedOrigin,
        rateDefault: rateValue,
        defaultDuration: defaultDurationValue,
        teacherId: user.uid,
        status: student?.status || 'active',
        isEffective: formData.isEffective,
        lastLessonDate: student?.lastLessonDate || null,
        inactiveAt: student?.inactiveAt || null,
        updatedAt: serverTimestamp(),
      };

      if (isEditing) {
        await updateDoc(doc(db, 'students', student.id), payload);
      } else {
        await addDoc(collection(db, 'students'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar aluno:", error);
      setErrorMessage('Erro ao salvar aluno. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content student-form">
        <header className="student-form__header">
          <h2>{isEditing ? 'Editar Aluno' : 'Novo Aluno'}</h2>
          <button type="button" className="student-form__close" onClick={onClose}>
            <X size={24} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="student-form__form">
          {errorMessage ? <p className="student-form__error">{errorMessage}</p> : null}

          <div className="form-group">
            <label>Nome do Aluno</label>
            <input 
              type="text" 
              required 
              placeholder="Nome completo"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Telefone</label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="(11) 99999-9999"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Instrumento</label>
            <select
              value={formData.instrumentPreset}
              onChange={(e) => updateField('instrumentPreset', e.target.value)}
            >
              <option value="">Não informado</option>
              {INSTRUMENT_OPTIONS.map((instrumentName) => (
                <option key={instrumentName} value={instrumentName}>
                  {instrumentName}
                </option>
              ))}
              <option value={OTHER_INSTRUMENT_OPTION}>Outro (digitar)</option>
            </select>

            {formData.instrumentPreset === OTHER_INSTRUMENT_OPTION ? (
              <input
                type="text"
                placeholder="Digite o instrumento"
                value={formData.instrumentCustom}
                onChange={(e) => updateField('instrumentCustom', e.target.value)}
              />
            ) : null}
          </div>

          <div className="form-group">
            <label>Origem (Escola ou Particular)</label>
            <input 
              type="text" 
              required 
              placeholder="Ex: Particular"
              value={formData.origin}
              onChange={(e) => updateField('origin', e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Valor/Aula (R$)</label>
              <input 
                type="number" 
                required 
                placeholder="0.00"
                min="0"
                step="0.01"
                value={formData.rateDefault}
                onChange={(e) => updateField('rateDefault', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Duração (min)</label>
              <input
                type="number"
                min="15"
                step="5"
                required
                placeholder="Ex: 50"
                value={formData.defaultDuration}
                onChange={(e) => updateField('defaultDuration', e.target.value)}
              />
            </div>
          </div>

          <label className="student-form__checkbox">
            <input
              type="checkbox"
              checked={formData.isEffective}
              onChange={(e) => updateField('isEffective', e.target.checked)}
            />
            <span>Aluno efetivado</span>
          </label>

          <div className="student-form__actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Aluno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentForm;