import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext.jsx';
import './Login.scss';

const Login = () => {
  const { user, loading, loginWithGoogle } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    // Se não estiver carregando e o usuário já existir, redireciona para o dashboard
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="login-page">
      <header className="login-page__header">
        <h1 className="login-page__title">Teacher<span>Flow</span></h1>
        <p className="login-page__subtitle">Gestão financeira para professores modernos.</p>
      </header>
      
      <button className="login-page__button" onClick={loginWithGoogle}>
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
        Entrar com Google
      </button>
    </div>
  );
};

export default Login;