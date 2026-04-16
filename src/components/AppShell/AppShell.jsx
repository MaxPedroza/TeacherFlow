import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Sun,
  Moon,
  LayoutDashboard,
  Calendar,
  Users,
  BadgeDollarSign,
  Settings,
  LogOut,
} from 'lucide-react';
import BottomNav from '../BottomNav/BottomNav.jsx';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { useLessons } from '../../hooks/useLessons.js';
import { useStudents } from '../../hooks/useStudents.js';
import './AppShell.scss';

const SIX_MONTHS_IN_MS = 1000 * 60 * 60 * 24 * 180;
const STORAGE_KEY = 'teacherflow-theme';
const THEME_EVENT = 'teacherflow-theme-change';

const formatDateTime = (dateValue) => {
  if (!dateValue) return '--';
  return dateValue.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: Calendar },
  { to: '/alunos', label: 'Alunos', icon: Users },
  { to: '/financeiro', label: 'Financeiro', icon: BadgeDollarSign },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

const AppShell = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthContext();
  const { lessons, loading: lessonsLoading, updateLessonStatus } = useLessons();
  const { students, loading: studentsLoading } = useStudents();
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'dark');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState('');
  const notificationsPanelRef = useRef(null);

  const studentsById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  const now = new Date();

  const todaysLessons = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    return lessons
      .filter((lesson) => {
        const lessonDate = lesson.date?.toDate?.();
        return lessonDate && lessonDate >= start && lessonDate <= end;
      })
      .sort((a, b) => {
        const firstDate = a.date?.toDate?.()?.getTime() || 0;
        const secondDate = b.date?.toDate?.()?.getTime() || 0;
        return firstDate - secondDate;
      });
  }, [lessons, now]);

  const overduePendingLessons = useMemo(() => {
    return lessons
      .filter((lesson) => {
        const lessonDate = lesson.date?.toDate?.();
        return lesson.status === 'pending' && lessonDate && lessonDate < now;
      })
      .sort((a, b) => {
        const firstDate = a.date?.toDate?.()?.getTime() || 0;
        const secondDate = b.date?.toDate?.()?.getTime() || 0;
        return firstDate - secondDate;
      });
  }, [lessons, now]);

  const eligibleInactiveStudents = useMemo(() => {
    return students.filter((student) => {
      if (student.status !== 'inactive') return false;

      const inactiveDate = student.inactiveAt?.toDate?.() || student.lastLessonDate?.toDate?.();
      if (!inactiveDate) return false;

      return now.getTime() - inactiveDate.getTime() >= SIX_MONTHS_IN_MS;
    });
  }, [students, now]);

  const notificationsCount =
    todaysLessons.length + overduePendingLessons.length + eligibleInactiveStudents.length;

  const closeNotifications = () => {
    setIsNotificationsOpen(false);
  };

  const openNotifications = () => {
    setNotificationFeedback('');
    setIsNotificationsOpen((currentValue) => !currentValue);
  };

  const handleGoTo = (path) => {
    navigate(path);
    closeNotifications();
  };

  const handleMarkAsPaid = async (lessonId) => {
    try {
      await updateLessonStatus(lessonId, 'paid');
      setNotificationFeedback('Aula marcada como paga.');
    } catch (error) {
      console.error('Erro ao atualizar aula pendente:', error);
      setNotificationFeedback('Não foi possível atualizar o pagamento agora.');
    }
  };

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
    if (!isNotificationsOpen) return undefined;

    const handleClickOutside = (event) => {
      const isNotifyButton = event.target?.closest?.('.app-shell__notify-btn');
      if (isNotifyButton) return;

      if (notificationsPanelRef.current && !notificationsPanelRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__brand-wrap">
          <div className="app-shell__brand">
            <h1 className="app-shell__brand-title">TeacherFlow</h1>
            <p className="app-shell__brand-subtitle">Gestão financeira por aula.</p>
          </div>

          <div className="app-shell__quick-actions app-shell__quick-actions--desktop">
            <button
              type="button"
              className="app-shell__theme-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              type="button"
              className="app-shell__notify-btn app-shell__notify-btn--desktop"
              onClick={openNotifications}
              aria-label="Abrir avisos"
            >
              <Bell size={18} />
              {notificationsCount > 0 ? (
                <span className="app-shell__notify-badge">{notificationsCount}</span>
              ) : null}
            </button>
          </div>
        </div>

        <nav className="app-shell__nav" aria-label="Navegação principal">
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `app-shell__nav-link ${isActive ? 'app-shell__nav-link--active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-shell__profile">
          <div className="app-shell__profile-info">
            {user?.photoURL ? (
              <img
                className="app-shell__avatar"
                src={user.photoURL}
                alt={user.displayName || 'Usuário'}
              />
            ) : (
              <div className="app-shell__avatar app-shell__avatar--fallback">
                {(user?.displayName || 'T').slice(0, 1).toUpperCase()}
              </div>
            )}

            <div>
              <strong className="app-shell__profile-name">
                {user?.displayName || 'Professor'}
              </strong>
              <span className="app-shell__profile-email">{user?.email || ''}</span>
            </div>
          </div>

          <button type="button" className="app-shell__logout" onClick={logout}>
            <LogOut size={16} />
            <span>Sair</span>
          </button>

          <p className="app-shell__signature">Desenvolvido por Max Pedroza</p>
        </div>
      </aside>

      <div className="app-shell__content-wrap">
        <main className="app-shell__content">{children}</main>

        <div className="app-shell__quick-actions app-shell__quick-actions--mobile">
          <button
            type="button"
            className="app-shell__theme-btn app-shell__theme-btn--mobile"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            className="app-shell__notify-btn app-shell__notify-btn--mobile"
            onClick={openNotifications}
            aria-label="Abrir avisos"
          >
            <Bell size={18} />
            {notificationsCount > 0 ? (
              <span className="app-shell__notify-badge">{notificationsCount}</span>
            ) : null}
          </button>
        </div>

        <BottomNav />
      </div>

      {isNotificationsOpen ? (
        <aside className="app-shell__notifications" ref={notificationsPanelRef}>
          <header className="app-shell__notifications-header">
            <div>
              <h2>Avisos</h2>
              <p>{notificationsCount} pendência(s)</p>
            </div>
            <button type="button" onClick={closeNotifications}>Fechar</button>
          </header>

          {notificationFeedback ? (
            <p className="app-shell__notifications-feedback">{notificationFeedback}</p>
          ) : null}

          {lessonsLoading || studentsLoading ? (
            <p className="app-shell__notifications-empty">Carregando avisos...</p>
          ) : null}

          {!lessonsLoading && !studentsLoading ? (
            <div className="app-shell__notifications-list">
              <section className="app-shell__notifications-group">
                <div className="app-shell__notifications-title-row">
                  <h3>Aulas de hoje</h3>
                  <span>{todaysLessons.length}</span>
                </div>

                {todaysLessons.length === 0 ? (
                  <p className="app-shell__notifications-empty">Nenhuma aula para hoje.</p>
                ) : (
                  todaysLessons.map((lesson) => {
                    const student = studentsById.get(lesson.studentId);
                    const lessonDate = lesson.date?.toDate?.();

                    return (
                      <article key={lesson.id} className="app-shell__notification-item">
                        <div>
                          <strong>{student?.name || 'Aluno'}</strong>
                          <p>
                            {student?.instrument || 'Instrumento não informado'} • {formatDateTime(lessonDate)}
                          </p>
                        </div>

                        <button type="button" onClick={() => handleGoTo('/agenda')}>
                          Ir para agenda
                        </button>
                      </article>
                    );
                  })
                )}
              </section>

              <section className="app-shell__notifications-group">
                <div className="app-shell__notifications-title-row">
                  <h3>Pendentes vencidas</h3>
                  <span>{overduePendingLessons.length}</span>
                </div>

                {overduePendingLessons.length === 0 ? (
                  <p className="app-shell__notifications-empty">Sem aulas pendentes vencidas.</p>
                ) : (
                  overduePendingLessons.map((lesson) => {
                    const student = studentsById.get(lesson.studentId);
                    const lessonDate = lesson.date?.toDate?.();

                    return (
                      <article key={lesson.id} className="app-shell__notification-item">
                        <div>
                          <strong>{student?.name || 'Aluno'}</strong>
                          <p>{formatDateTime(lessonDate)} • pendente</p>
                        </div>

                        <div className="app-shell__notification-actions">
                          <button type="button" onClick={() => handleMarkAsPaid(lesson.id)}>
                            Marcar paga
                          </button>
                          <button type="button" onClick={() => handleGoTo('/financeiro')}>
                            Financeiro
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>

              <section className="app-shell__notifications-group">
                <div className="app-shell__notifications-title-row">
                  <h3>Elegíveis para exclusão</h3>
                  <span>{eligibleInactiveStudents.length}</span>
                </div>

                {eligibleInactiveStudents.length === 0 ? (
                  <p className="app-shell__notifications-empty">Nenhum aluno elegível no momento.</p>
                ) : (
                  eligibleInactiveStudents.map((student) => (
                    <article key={student.id} className="app-shell__notification-item">
                      <div>
                        <strong>{student.name}</strong>
                        <p>{student.instrument || 'Instrumento não informado'} • inativo há mais de 6 meses</p>
                      </div>

                      <button type="button" onClick={() => handleGoTo('/configuracoes')}>
                        Abrir ajustes
                      </button>
                    </article>
                  ))
                )}
              </section>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
};

export default AppShell;