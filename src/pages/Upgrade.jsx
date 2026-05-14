import React, { useState } from 'react';
import { Check, Zap, Crown } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import usePlan from '../hooks/usePlan.js';
import { useToast } from '../context/ToastContext.jsx';
import './Upgrade.scss';

const FREE_LIMITS = [
  'Até 5 alunos ativos',
  'Agenda e financeiro básico',
  'Acesso via navegador',
];

const PRO_FEATURES = [
  'Alunos ilimitados',
  'TeacherAI — assistente com IA',
  'Relatório financeiro completo',
  'Exportação de dados',
  'Suporte prioritário',
];

const formatDate = (date) =>
  date
    ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

const Upgrade = () => {
  const { isPro, planExpiresAt, loading } = usePlan();
  const { addToast } = useToast();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleSubscribe = async () => {
    setCheckoutLoading(true);
    // Abre janela imediatamente (antes do async) para evitar bloqueio de popup
    const newTab = window.open('', '_blank', 'noopener,noreferrer');
    try {
      const functions = getFunctions(undefined, 'us-central1');
      const createCheckout = httpsCallable(functions, 'createCheckout');
      const result = await createCheckout();
      if (newTab) {
        newTab.location.href = result.data.checkoutUrl;
      } else {
        window.location.href = result.data.checkoutUrl;
      }
    } catch (error) {
      console.error('Erro ao criar checkout:', error);
      if (newTab) newTab.close();
      addToast('Não foi possível abrir o checkout agora. Tente novamente.', 'error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Lê status da URL após retorno do MP
  const urlStatus = new URLSearchParams(window.location.search).get('status');

  return (
    <section className="upgrade-page container">
      <header className="upgrade-page__header">
        <Crown size={32} strokeWidth={1.5} />
        <div>
          <h1>Planos TeacherFlow</h1>
          <p>Escolha o plano ideal para o seu estúdio.</p>
        </div>
      </header>

      {urlStatus === 'sucesso' && (
        <div className="upgrade-page__success">
          <Check size={20} />
          <span>Pagamento recebido! Seu plano Pro será ativado em instantes.</span>
        </div>
      )}

      {isPro && planExpiresAt && (
        <div className="upgrade-page__active-badge">
          <Crown size={16} />
          <span>Plano Pro ativo até {formatDate(planExpiresAt)}</span>
        </div>
      )}

      <div className="upgrade-page__cards">
        {/* Plano Free */}
        <article className="upgrade-page__plan panel">
          <div className="upgrade-page__plan-header">
            <h2>Free</h2>
            <div className="upgrade-page__price">
              <span className="upgrade-page__price-value">R$ 0</span>
              <span className="upgrade-page__price-period">/mês</span>
            </div>
          </div>

          <ul className="upgrade-page__features">
            {FREE_LIMITS.map((item) => (
              <li key={item}>
                <Check size={15} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {!isPro && (
            <div className="upgrade-page__current-badge">Plano atual</div>
          )}
        </article>

        {/* Plano Pro */}
        <article className="upgrade-page__plan upgrade-page__plan--pro panel">
          <div className="upgrade-page__plan-badge">Recomendado</div>

          <div className="upgrade-page__plan-header">
            <h2>Pro</h2>
            <div className="upgrade-page__price">
              <span className="upgrade-page__price-value">R$ 39</span>
              <span className="upgrade-page__price-period">/mês</span>
            </div>
            <p className="upgrade-page__price-note">menos de uma aula por mês</p>
          </div>

          <ul className="upgrade-page__features">
            {PRO_FEATURES.map((item) => (
              <li key={item}>
                <Zap size={15} />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {isPro ? (
            <div className="upgrade-page__current-badge upgrade-page__current-badge--pro">
              <Crown size={14} />
              Plano ativo
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary upgrade-page__cta"
              onClick={handleSubscribe}
              disabled={checkoutLoading || loading}
            >
              {checkoutLoading ? 'Abrindo pagamento...' : 'Assinar Pro — R$ 39/mês'}
            </button>
          )}
        </article>
      </div>

      <p className="upgrade-page__note">
        Pagamento via PIX ou cartão de crédito. Cancele quando quiser pelo painel do Mercado Pago.
        A ativação é automática e imediata após confirmação do pagamento.
      </p>
    </section>
  );
};

export default Upgrade;
