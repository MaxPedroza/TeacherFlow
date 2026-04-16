import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { useAuthContext } from '../context/AuthContext.jsx';

const normalizeLessonDate = (value) => {
  if (value instanceof Date) return value;
  return new Date(value);
};

export const useLessons = () => {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) {
      setLessons([]);
      setLoading(false);
      return undefined;
    }

    const q = query(collection(db, 'lessons'), where('teacherId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((lessonDoc) => ({
        id: lessonDoc.id,
        ...lessonDoc.data(),
      }));

      data.sort((firstLesson, secondLesson) => {
        const firstDate = firstLesson.date?.toDate?.()?.getTime() || 0;
        const secondDate = secondLesson.date?.toDate?.()?.getTime() || 0;
        return firstDate - secondDate;
      });

      setLessons(data);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const syncStudentLastLessonDate = useCallback(async (studentId, lessonDate) => {
    if (!studentId) return;

    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) return;

    const currentLastLesson = studentSnap.data()?.lastLessonDate?.toDate?.();
    if (!currentLastLesson || lessonDate > currentLastLesson) {
      await updateDoc(studentRef, {
        lastLessonDate: Timestamp.fromDate(lessonDate),
        updatedAt: serverTimestamp(),
      });
    }
  }, []);

  const recalculateStudentLastLessonDate = useCallback(async (studentId) => {
    if (!user || !studentId) return;

    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) return;

    const lessonsSnapshot = await getDocs(
      query(
        collection(db, 'lessons'),
        where('teacherId', '==', user.uid),
        where('studentId', '==', studentId)
      )
    );

    const latestLessonDate = lessonsSnapshot.docs
      .map((lessonDoc) => lessonDoc.data()?.date?.toDate?.())
      .filter(Boolean)
      .sort((firstDate, secondDate) => secondDate - firstDate)[0] || null;

    await updateDoc(studentRef, {
      lastLessonDate: latestLessonDate ? Timestamp.fromDate(latestLessonDate) : null,
      updatedAt: serverTimestamp(),
    });
  }, [user]);

  const createLesson = useCallback(async (payload) => {
    if (!user) throw new Error('Usuário não autenticado.');

    const lessonDate = normalizeLessonDate(payload.date);
    const isDemoLesson = payload.type === 'Demonstrativa';
    const duration = isDemoLesson ? 30 : Number(payload.duration) || 60;
    const rateApplied = isDemoLesson ? 0 : Number(payload.rateApplied) || 0;
    const recurrenceWeeks = Math.max(1, Number(payload.recurrenceWeeks) || 1);
    const lessonsToCreate = Array.from({ length: recurrenceWeeks }, (_, weekIndex) => {
      const occurrenceDate = new Date(lessonDate);
      occurrenceDate.setDate(occurrenceDate.getDate() + (weekIndex * 7));
      return occurrenceDate;
    });

    await Promise.all(
      lessonsToCreate.map((occurrenceDate) => addDoc(collection(db, 'lessons'), {
        teacherId: user.uid,
        studentId: payload.studentId,
        date: Timestamp.fromDate(occurrenceDate),
        duration,
        rateApplied,
        content: payload.content?.trim() || '',
        type: payload.type || 'Normal',
        status: payload.status || 'scheduled',
        recurrenceWeeks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }))
    );

    await syncStudentLastLessonDate(payload.studentId, lessonsToCreate[lessonsToCreate.length - 1]);
  }, [syncStudentLastLessonDate, user]);

  const updateLesson = useCallback(async (lessonId, payload) => {
    if (!lessonId) throw new Error('Lesson id inválido.');

    const lessonRef = doc(db, 'lessons', lessonId);
    const currentLessonSnapshot = await getDoc(lessonRef);
    const previousStudentId = currentLessonSnapshot.data()?.studentId || null;

    const lessonDate = normalizeLessonDate(payload.date);
    const isDemoLesson = payload.type === 'Demonstrativa';
    const duration = isDemoLesson ? 30 : Number(payload.duration) || 60;
    const rateApplied = isDemoLesson ? 0 : Number(payload.rateApplied) || 0;

    await updateDoc(lessonRef, {
      studentId: payload.studentId,
      date: Timestamp.fromDate(lessonDate),
      duration,
      rateApplied,
      content: payload.content?.trim() || '',
      type: payload.type || 'Normal',
      status: payload.status || 'scheduled',
      updatedAt: serverTimestamp(),
    });

    if (previousStudentId && previousStudentId !== payload.studentId) {
      await recalculateStudentLastLessonDate(previousStudentId);
    }

    await recalculateStudentLastLessonDate(payload.studentId);
  }, [recalculateStudentLastLessonDate]);

  const deleteLesson = useCallback(async (lessonId) => {
    if (!lessonId) throw new Error('Lesson id inválido.');

    const lessonRef = doc(db, 'lessons', lessonId);
    const lessonSnapshot = await getDoc(lessonRef);
    const studentId = lessonSnapshot.data()?.studentId || null;

    await deleteDoc(lessonRef);

    if (studentId) {
      await recalculateStudentLastLessonDate(studentId);
    }
  }, [recalculateStudentLastLessonDate]);

  const updateLessonStatus = useCallback(async (lessonId, status) => {
    await updateDoc(doc(db, 'lessons', lessonId), {
      status,
      updatedAt: serverTimestamp(),
    });
  }, []);

  return {
    lessons,
    loading,
    createLesson,
    updateLesson,
    deleteLesson,
    updateLessonStatus,
  };
};