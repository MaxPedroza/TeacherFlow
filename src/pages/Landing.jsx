import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  DollarSign,
  Users,
  CheckCircle,
  ArrowRight,
  BookOpen,
  TrendingUp,
  Bell,
} from 'lucide-react';
import './Landing.scss';

const features = [
  {
    icon: CalendarDays,
    title: 'Agenda inteligente',
    desc: 'Visualize todas as suas aulas da semana em um calendário simples. Crie, edite e cancele com poucos cliques.',
  },
  {
    icon: DollarSign,
    title: 'Controle financeiro',
    desc: 'Acompanhe pagamentos pendentes e recebidos. Veja sua receita do mês e projeção futura sem planilhas.',
  },
  {
    icon: Users,
    title: 'Gestão de alunos',
    desc: 'Cadastre alunos, defina o valor da aula, instrumento e origem. Tudo organizado em um só lugar.',
  },
  {
    icon: TrendingUp,
    title: 'Relatórios rápidos',
    desc: 'Filtre por período, aluno ou status e tenha visão clara do que foi recebido e o que ainda está em aberto.',
  },
  {
    icon: Bell,
    title: 'Status de presença',
    desc: 'Marque aulas como realizadas, falta avisada ou no-show. Saiba exatamente o que cobrar de cada aluno.',
  },
  {
    icon: BookOpen,
    title: 'Feito para professores',
    desc: 'Interface simples, rápida e mobile-first. Funciona no celular como um app, sem instalação.',
  },
];

const freeFeatures = [
  'Até 5 alunos ativos',
  'Agenda de aulas',
  'Controle financeiro básico',
  'Acesso pelo celular',
];

const proFeatures = [
  'Alunos ilimitados',
  'Agenda de aulas',
  'Controle financeiro completo',
  'Relatórios por período',
  'Acesso pelo celular',
  'Suporte prioritário',
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* ── Header ── */}
      <header className="landing__header">
        <div className="landing__header-inner">
          <span className="landing__logo">TeacherFlow</span>
          <button className="landing__btn-ghost" onClick={() => navigate('/login')}>
            Entrar
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="landing__hero">
        <div className="landing__hero-inner">
          <div className="landing__badge">Para professores particulares</div>
          <h1 className="landing__headline">
            Pare de perder dinheiro por falta de organização
          </h1>
          <p className="landing__subheadline">
            TeacherFlow é o app que organiza sua agenda, controla pagamentos e te
            mostra exatamente quanto você vai receber no mês — em menos de 2 minutos
            por dia.
          </p>
          <div className="landing__hero-actions">
            <button
              className="landing__btn-primary"
              onClick={() => navigate('/login')}
            >
              Começar grátis
              <ArrowRight size={18} />
            </button>
            <a href="#planos" className="landing__btn-ghost">
              Ver planos
            </a>
          </div>
          <p className="landing__hero-note">Grátis para até 5 alunos. Sem cartão.</p>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing__features">
        <div className="landing__container">
          <h2 className="landing__section-title">Tudo que você precisa, nada que você não usa</h2>
          <div className="landing__features-grid">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="landing__feature-card">
                <div className="landing__feature-icon">
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ── */}
      <section className="landing__proof">
        <div className="landing__container">
          <blockquote className="landing__quote">
            "Antes eu anotava tudo no caderno e sempre esquecia de cobrar alguém.
            Agora vejo tudo no celular e sei exatamente o que tenho a receber."
          </blockquote>
          <cite className="landing__cite">— Professor de violão, São Paulo</cite>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="landing__pricing" id="planos">
        <div className="landing__container">
          <h2 className="landing__section-title">Planos simples, sem surpresa</h2>
          <div className="landing__pricing-grid">
            {/* Free */}
            <div className="landing__plan">
              <div className="landing__plan-header">
                <h3>Grátis</h3>
                <div className="landing__plan-price">
                  <span className="landing__plan-amount">R$0</span>
                  <span className="landing__plan-period">para sempre</span>
                </div>
              </div>
              <ul className="landing__plan-features">
                {freeFeatures.map(f => (
                  <li key={f}>
                    <CheckCircle size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="landing__btn-outline"
                onClick={() => navigate('/login')}
              >
                Começar grátis
              </button>
            </div>

            {/* Pro */}
            <div className="landing__plan landing__plan--pro">
              <div className="landing__plan-badge">Mais popular</div>
              <div className="landing__plan-header">
                <h3>Pro</h3>
                <div className="landing__plan-price">
                  <span className="landing__plan-amount">R$39</span>
                  <span className="landing__plan-period">/mês</span>
                </div>
              </div>
              <ul className="landing__plan-features">
                {proFeatures.map(f => (
                  <li key={f}>
                    <CheckCircle size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className="landing__btn-primary"
                onClick={() => navigate('/login')}
              >
                Assinar Pro
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="landing__cta">
        <div className="landing__container">
          <h2>Pronto para organizar sua vida de professor?</h2>
          <p>Crie sua conta grátis em menos de 1 minuto.</p>
          <button
            className="landing__btn-primary"
            onClick={() => navigate('/login')}
          >
            Criar conta grátis
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing__footer">
        <p>© {new Date().getFullYear()} TeacherFlow · Feito para professores brasileiros</p>
      </footer>
    </div>
  );
}
