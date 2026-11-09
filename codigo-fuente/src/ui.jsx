import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { ST } from './util.js';
import { retry } from './store.js';

export const cx = (...a) => a.filter(Boolean).join(' ');

/* Tarjeta de vidrio con luz que sigue al puntero (ver App: pointermove) */
export function Glass({ as: T = 'div', className, children, ...p }) {
  return (
    <T className={cx('glass', className)} {...p}>
      <span className="glow" aria-hidden="true" />
      {children}
    </T>
  );
}

/* Botón con destello diagonal (estilo Uiverse) */
export function Btn({ kind, block, icon, className, children, ...p }) {
  return (
    <button type="button" className={cx('btn', kind, block && 'block', className)} {...p}>
      {icon && <Icon n={icon} />}
      {children}
    </button>
  );
}

export const Pill = ({ st, children }) => <span className={cx('pill', 's-' + st)}>{children ?? ST[st]?.t}</span>;

/* Interruptor con halo y visto que se dibuja (estilo Uiverse) */
export function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="sw"
      onClick={() => onChange(!checked)}
    />
  );
}

/* Selector con píldora que se desliza (glider) */
export function Seg({ options, value, onChange, label }) {
  const ref = useRef(null);
  const [g, setG] = useState({ w: 0, h: 0, x: 0 });
  useLayoutEffect(() => {
    const el = ref.current && ref.current.querySelector('[aria-selected="true"]');
    if (el) setG({ w: el.offsetWidth, h: el.offsetHeight, x: el.offsetLeft });
  }, [value, options.length]);
  useEffect(() => {
    const f = () => {
      const el = ref.current && ref.current.querySelector('[aria-selected="true"]');
      if (el) setG({ w: el.offsetWidth, h: el.offsetHeight, x: el.offsetLeft });
    };
    addEventListener('resize', f);
    document.fonts && document.fonts.ready.then(f);
    return () => removeEventListener('resize', f);
  }, []);
  return (
    <div className="seg" role="tablist" aria-label={label} ref={ref}>
      {options.map((o) => (
        <button key={o.v} type="button" role="tab" aria-selected={o.v === value} onClick={() => onChange(o.v)}>
          {o.t}
        </button>
      ))}
      <span className="glider" aria-hidden="true" style={{ width: g.w, height: g.h, transform: `translateX(${g.x}px)` }} />
    </div>
  );
}

export function Steps({ n, labels }) {
  return (
    <ol className="steps" aria-label={`Paso ${n} de ${labels.length}`}>
      {labels.map((t, i) => (
        <li key={t} className={cx(i + 1 === n && 'now', i + 1 < n && 'done')}>
          <b>{i + 1 < n ? <Icon n="check" /> : i + 1}</b>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

export function Sheet({ node, onClose }) {
  useEffect(() => {
    if (!node) return;
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [node, onClose]);
  if (!node) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {node}
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!toast.id) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 4200);
    return () => clearTimeout(t);
  }, [toast.id]);
  return (
    <div className={cx('toast glass', show && 'show')} role="status" aria-live="polite">
      {toast.text}
    </div>
  );
}

export function Empty({ emoji = '🙂', title, children }) {
  return (
    <div className="empty">
      <div className="e">{emoji}</div>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

/* ============ MARCA Y GESTO FIRMA: el brote que sale del surco ============ */
const LEAF_L = 'M24 27C14 27 9.5 20 9.5 12.5C18 12.5 24 17 24 27Z';
const LEAF_R = 'M24 22.5C24 14 29.5 8.5 39 8.5C39 17.5 33.5 22.5 24 22.5Z';

export function Mark({ className }) {
  return (
    <svg className={cx('mark', className)} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="mk-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c9a4e" />
          <stop offset="1" stopColor="#8fbf2e" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#mk-g)" />
      <path d="M24 39V25" stroke="#fff8e1" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d={LEAF_L} fill="#fff8e1" />
      <path d={LEAF_R} fill="#ffd166" />
    </svg>
  );
}

/* Brote animado para cargas y estados vacíos. dry = seco (sin conexión) */
export function Sprout({ dry }) {
  return (
    <svg className={cx('sprout', dry && 'dry')} viewBox="0 0 160 110" aria-hidden="true">
      <path className="sp-furrow" d="M4 92C30 78 50 106 80 92S130 78 156 92" />
      <path className="sp-furrow f2" d="M4 104C30 90 50 118 80 104S130 90 156 104" />
      <g transform="translate(56 6) scale(1.1)">
        <path className="sp-stem" d="M24 78V32" pathLength="100" />
        <path className="sp-leaf l" d={LEAF_L} />
        <path className="sp-leaf r" d={LEAF_R} />
      </g>
    </svg>
  );
}

/* Línea de surco que separa secciones */
export const Surco = () => <div className="surco" aria-hidden="true" />;

/* Pantalla mientras la tienda abre por primera vez en este equipo */
export function Gate({ sync }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  if (sync.offline) {
    const server = sync.err > 0;
    return (
      <div className="gate">
        <div className="glass gate-card" role="alert">
          <Sprout dry />
          <h2>{server ? 'La tienda no pudo abrirse' : 'No hay internet por ahora'}</h2>
          <p>
            {server
              ? 'Intente de nuevo en un momento. Si sigue igual, avise a quien administra la tienda.'
              : 'Cuando vuelva la señal, la tienda se abre sola. También puede tocar el botón.'}
          </p>
          <Btn kind="primary" block onClick={retry}>
            Volver a intentar
          </Btn>
          {server && <small className="hint">Código {sync.err}</small>}
        </div>
      </div>
    );
  }
  return (
    <div className="gate" role="status" aria-live="polite">
      <Sprout />
      <p className="gate-t">Abriendo la tienda…</p>
      {slow && <p className="hint">Está tardando más de lo normal. Ya casi.</p>}
    </div>
  );
}
