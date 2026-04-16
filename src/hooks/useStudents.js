import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase.js';
import { useAuthContext } from '../context/AuthContext.jsx';

export const useStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthContext();

  useEffect(() => {
    if (!user) {
      setStudents([]);
      setLoading(false);
      return undefined;
    }

    // Filtra alunos apenas do professor logado (estratégia multi-tenant)
    const q = query(collection(db, 'students'), where('teacherId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      data.sort((firstStudent, secondStudent) => {
        if (firstStudent.status !== secondStudent.status) {
          return firstStudent.status === 'active' ? -1 : 1;
        }

        return firstStudent.name.localeCompare(secondStudent.name, 'pt-BR');
      });
      setStudents(data);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { students, loading };
};