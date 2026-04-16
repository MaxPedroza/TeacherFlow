import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase.js'; 
import { useAuthContext } from '../context/AuthContext.jsx';

/**
 * Hook para cálculo de faturamento baseado no status das aulas.
 */
export const useBilling = () => {
  const [billing, setBilling] = useState({
    pendingTotal: 0,
    paidTotal: 0,
    scheduledTotal: 0,
    monthlyProjection: 0,
    loading: true,
  });
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) {
      setBilling((previousData) => ({
        ...previousData,
        loading: false,
      }));
      return undefined;
    }

    const lessonsRef = collection(db, 'lessons');
    const q = query(lessonsRef, where('teacherId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const totals = snapshot.docs.reduce((acc, doc) => {
        const { rateApplied, status, date } = doc.data();
        const value = Number(rateApplied) || 0;

        const lessonDate = date?.toDate?.();
        if (!lessonDate) return acc;

        const sameMonth =
          lessonDate.getMonth() === now.getMonth() &&
          lessonDate.getFullYear() === now.getFullYear();

        if (!sameMonth) return acc;

        if (status === 'pending') acc.pendingTotal += value;
        if (status === 'paid') acc.paidTotal += value;
        if (status === 'scheduled') acc.scheduledTotal += value;

        return acc;
      }, { pendingTotal: 0, paidTotal: 0, scheduledTotal: 0 });

      setBilling({
        ...totals,
        monthlyProjection: totals.pendingTotal + totals.paidTotal,
        loading: false
      });
    }, (error) => {
      console.error("Erro ao calcular faturamento:", error);
      setBilling(prev => ({ ...prev, loading: false }));
    });

    return () => unsubscribe();
  }, [user]);

  return billing;
};