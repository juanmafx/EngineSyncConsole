import React from 'react';

export function Module({ title, colorClass, children }) {
  return (
    <section className={`module ${colorClass}`}>
      <div className="module-title">{title}</div>
      <div className="module-body">{children}</div>
    </section>
  );
}

export function StatusPill({ label, on, tone = 'ok' }) {
  return <span className={`pill ${on ? tone : 'off'}`}>{label}</span>;
}

export function DataRow({ label, values, unit, getTone, precision = 0 }) {
  return (
    <div className="data-row">
      <div className="row-label">{label}</div>
      <div className="row-values">
        {values.map((v, i) => {
          const tone = getTone ? getTone(v, i) : '';
          return (
            <div key={`${label}-${i}`} className={`value-cell ${tone}`}>
              <span className="engine-tag">E{i + 1}</span>
              <strong>{v.toFixed(precision)}</strong>
              <small>{unit}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ToggleButton({ active, onClick, label }) {
  return (
    <button className={`toggle ${active ? 'active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}
