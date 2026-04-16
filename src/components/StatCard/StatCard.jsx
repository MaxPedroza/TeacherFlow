import React from 'react';
import './StatCard.scss';

const StatCard = ({ label, value, type }) => {
  return (
    <div className={`stat-card stat-card--${type}`}>
      <span className="stat-card__label">{label}</span>
      <h2 className="stat-card__value">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
      </h2>
    </div>
  );
};

export default StatCard;