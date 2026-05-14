import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { useAuthContext } from '../context/AuthContext.jsx';

/**
 * Lê em tempo real o plano do professor autenticado em /users/{uid}.
 * Retorna:
 *   plan       — 'free' | 'pro'
 *   isPro      — true se plano pro e ainda não vencido
 *   planExpiresAt — Date | null
 *   loading    — true enquanto carrega
 */
const usePlan = () => {
  const { user } = useAuthContext();
  const [plan, setPlan] = useState('free');
  const [planExpiresAt, setPlanExpiresAt] = useState(null);
  const [isLifetimePro, setIsLifetimePro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlan('free');
      setPlanExpiresAt(null);
      setIsLifetimePro(false);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const expires = data.planExpiresAt?.toDate?.() || null;
        const hasManualProOverride = data.planOverride === 'pro' || data.isLifetimePro === true;
        const hasValidProByDate = data.plan === 'pro' && (expires ? expires > new Date() : true);
        const shouldBePro = hasManualProOverride || hasValidProByDate;

        setPlan(shouldBePro ? 'pro' : 'free');
        setPlanExpiresAt(hasManualProOverride ? null : expires);
        setIsLifetimePro(hasManualProOverride);
      } else {
        setPlan('free');
        setPlanExpiresAt(null);
        setIsLifetimePro(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const isPro = plan === 'pro';

  return { plan, isPro, planExpiresAt, isLifetimePro, loading };
};

export default usePlan;
