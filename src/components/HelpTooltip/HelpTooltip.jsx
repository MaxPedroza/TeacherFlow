import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import './HelpTooltip.scss';

const HelpTooltip = ({ text }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setVisible(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible]);

  return (
    <span className="help-tooltip" ref={ref}>
      <button
        type="button"
        className="help-tooltip__trigger"
        onClick={() => setVisible((v) => !v)}
        aria-label="Ajuda"
      >
        <HelpCircle size={14} />
      </button>
      {visible && (
        <span className="help-tooltip__bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
};

export default HelpTooltip;
