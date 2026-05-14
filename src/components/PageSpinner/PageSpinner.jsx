import React from 'react';
import './PageSpinner.scss';

const PageSpinner = ({ message = 'Carregando...' }) => (
  <div className="page-spinner">
    <span className="page-spinner__ring" aria-hidden="true" />
    <p className="page-spinner__label">{message}</p>
  </div>
);

export default PageSpinner;
