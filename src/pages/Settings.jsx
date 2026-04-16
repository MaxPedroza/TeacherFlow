import React, { useEffect, useMemo, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../services/firebase.js';
import { useAuthContext } from '../context/AuthContext.jsx';
import './Settings.scss';

const STORAGE_KEY = 'teacherflow-theme';
const THEME_EVENT = 'teacherflow-theme-change';
const SIX_MONTHS_IN_DAYS = 180;

const getDaysInactive = (lastLessonDate) => {
  if (!lastLessonDate?.toDate) return null;
  const lastDate = lastLessonDate.toDate();
  const diffMs = Date.now() - lastDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const Settings = () => {
  const { user } = useAuthContext();
  const [theme, setTheme] = useState(
    () => localStorage.getItem(STORAGE_KEY) || document.documentElement.dataset.theme || 'dark'
  );
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState('');
  const [inactiveStudents, setInactiveStudents] = useState([]);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordResult, setPasswordResult] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (event) => {
      const nextTheme = event?.detail?.theme;
      if (!nextTheme || nextTheme === theme) return;
      setTheme(nextTheme);
    };

    window.addEventListener(THEME_EVENT, handleThemeChange);
    return () => {
      window.removeEventListener(THEME_EVENT, handleThemeChange);
    };
  }, [theme]);

  useEffect(() => {
    if (!user) return;

    const loadInactiveStudents = async () => {
      const q = query(
        collection(db, 'students'),
        where('teacherId', '==', user.uid),
        where('status', '==', 'inactive')
      );

      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map((studentDoc) => ({ id: studentDoc.id, ...studentDoc.data() }))
        .filter((student) => {
          const inactiveDays = getDaysInactive(student.lastLessonDate);
          return inactiveDays !== null && inactiveDays >= SIX_MONTHS_IN_DAYS;
        });

      setInactiveStudents(data);
    };

    loadInactiveStudents();
  }, [user, cleanupResult]);

  const eligibleCount = useMemo(() => inactiveStudents.length, [inactiveStudents]);

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      setPasswordResult('Não foi possível identificar o e-mail da conta.');
      return;
    }

    setPasswordLoading(true);
    setPasswordResult('');

    try {
      await sendPasswordResetEmail(auth, user.email);
      setPasswordResult(`Enviamos um link de redefinição para ${user.email}.`);
    } catch (error) {
      console.error('Erro ao enviar redefinição de senha:', error);
      setPasswordResult('Não foi possível enviar o e-mail de redefinição agora.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCleanup = async () => {
    if (!inactiveStudents.length) {
      setCleanupResult('Nenhum aluno inativo elegível para exclusão definitiva.');
      return;
    }

    setCleanupLoading(true);
    try {
      await Promise.all(inactiveStudents.map((student) => deleteDoc(doc(db, 'students', student.id))));
      setCleanupResult(`${inactiveStudents.length} aluno(s) removido(s) definitivamente.`);
    } catch (error) {
      console.error('Erro ao limpar alunos inativos:', error);
      setCleanupResult('Não foi possível concluir a limpeza agora.');
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <section className="settings-page container">
      <header className="settings-page__header">
        <div>
          <h1>Configurações</h1>
          <p>Preferências visuais e manutenção da base de alunos.</p>
        </div>
      </header>

      <div className="settings-page__grid">
        <article className="settings-card">
          <div className="settings-card__heading">
            <h2>Tema</h2>
            <p>Alterna entre dark e light mode usando variáveis globais.</p>
          </div>

          <div className="settings-card__theme-switcher">
            <button
              type="button"
              className={`settings-card__theme-option ${theme === 'dark' ? 'settings-card__theme-option--active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              Escuro
            </button>
            <button
              type="button"
              className={`settings-card__theme-option ${theme === 'light' ? 'settings-card__theme-option--active' : ''}`}
              onClick={() => setTheme('light')}
            >
              Claro
            </button>
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-card__heading">
            <h2>Conta</h2>
            <p>Gerencie segurança e acesso da sua conta.</p>
          </div>

          <div className="settings-card__account">
            <strong>{user?.displayName || 'Professor'}</strong>
            <span>{user?.email || 'E-mail não disponível'}</span>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={handleSendPasswordReset}
            disabled={passwordLoading}
          >
            {passwordLoading ? 'Enviando link...' : 'Alterar senha por e-mail'}
          </button>

          {passwordResult ? <p className="settings-card__message">{passwordResult}</p> : null}
        </article>

        <article className="settings-card">
          <div className="settings-card__heading">
            <h2>Limpeza de inativos</h2>
            <p>
              Remove em definitivo apenas alunos inativos há mais de 6 meses.
            </p>
          </div>

          <strong className="settings-card__counter">{eligibleCount} elegível(is)</strong>

          <button
            type="button"
            className="btn-primary btn-primary--danger"
            onClick={handleCleanup}
            disabled={cleanupLoading}
          >
            {cleanupLoading ? 'Limpando...' : 'Excluir elegíveis'}
          </button>

          {cleanupResult ? <p className="settings-card__message">{cleanupResult}</p> : null}
        </article>
      </div>
    </section>
  );
};

export default Settings;