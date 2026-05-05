export const LESSON_STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'pending', label: 'Pendente' },
  { value: 'paid', label: 'Paga' },
  { value: 'canceled_in_time', label: 'Falta avisada (sem cobrança)' },
  { value: 'no_show', label: 'Falta sem aviso (cobrar)' },
];

export const LESSON_STATUS_LABEL = LESSON_STATUS_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

export const getLessonStatusLabel = (status) => LESSON_STATUS_LABEL[status] || 'Status desconhecido';

export const RECEIVABLE_STATUSES = new Set(['pending', 'no_show']);

export const isReceivableStatus = (status) => RECEIVABLE_STATUSES.has(status);

export const normalizeLessonStatus = (status) => {
  if (status === 'missed') return 'canceled_in_time';
  return status;
};
