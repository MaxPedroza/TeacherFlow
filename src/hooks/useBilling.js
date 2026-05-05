import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase.js'; 
import { useAuthContext } from '../context/AuthContext.jsx';
import { isReceivableStatus } from '../constants/lessonStatus.js';

const periodLabelMap = {
  month: 'mês selecionado',
  quarter: 'trimestre selecionado',
  semester: 'semestre selecionado',
  year: 'ano selecionado',
};

const parseReferenceMonth = (referenceMonth) => {
  if (typeof referenceMonth !== 'string') return new Date();

  const [yearValue, monthValue] = referenceMonth.split('-').map(Number);

  if (!Number.isInteger(yearValue) || !Number.isInteger(monthValue)) return new Date();

  return new Date(yearValue, monthValue - 1, 1);
};

const getPeriodRange = (period, referenceDate) => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  if (period === 'quarter') {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      start: new Date(year, quarterStartMonth, 1),
      end: new Date(year, quarterStartMonth + 3, 1),
    };
  }

  if (period === 'semester') {
    const semesterStartMonth = month < 6 ? 0 : 6;
    return {
      start: new Date(year, semesterStartMonth, 1),
      end: new Date(year, semesterStartMonth + 6, 1),
    };
  }

  if (period === 'year') {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year + 1, 0, 1),
    };
  }

  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
};

/**
 * Hook para cálculo de faturamento baseado no status das aulas.
 */
export const useBilling = ({ period = 'month', referenceMonth } = {}) => {
  const [billing, setBilling] = useState({
    pendingTotal: 0,
    paidTotal: 0,
    scheduledTotal: 0,
    monthlyProjection: 0,
    periodLabel: periodLabelMap.month,
    loading: true,
  });
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) {
      setBilling((previousData) => ({
        ...previousData,
        periodLabel: periodLabelMap[period] || periodLabelMap.month,
        loading: false,
      }));
      return undefined;
    }

    const lessonsRef = collection(db, 'lessons');
    const q = query(lessonsRef, where('teacherId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const referenceDate = parseReferenceMonth(referenceMonth);
      const { start, end } = getPeriodRange(period, referenceDate);

      const totals = snapshot.docs.reduce((acc, doc) => {
        const { rateApplied, status, date } = doc.data();
        const value = Number(rateApplied) || 0;

        const lessonDate = date?.toDate?.();
        if (!lessonDate) return acc;

        const isInPeriod = lessonDate >= start && lessonDate < end;
        if (!isInPeriod) return acc;

        if (isReceivableStatus(status)) acc.pendingTotal += value;
        if (status === 'paid') acc.paidTotal += value;
        if (status === 'scheduled') acc.scheduledTotal += value;

        return acc;
      }, { pendingTotal: 0, paidTotal: 0, scheduledTotal: 0 });

      setBilling({
        ...totals,
        monthlyProjection: totals.pendingTotal + totals.paidTotal,
        periodLabel: periodLabelMap[period] || periodLabelMap.month,
        loading: false
      });
    }, (error) => {
      console.error("Erro ao calcular faturamento:", error);
      setBilling(prev => ({ ...prev, periodLabel: periodLabelMap[period] || periodLabelMap.month, loading: false }));
    });

    return () => unsubscribe();
  }, [period, referenceMonth, user]);

  return billing;
};