import { imgSrc } from './store.js';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { Btn, Empty, Glass, Pill, Steps, Surco, cx } from './ui.jsx';
import { useApp } from './ctx.js';
import { InstallButton } from './install.jsx';
import Chat from './Chat.jsx';
import { askBot, createOrder, saveCustomer, setStatus, toast, useDB, useSession } from './store.js';
import {
  APP_NAME,
  DONE,
  FLOW,
  ST,
  addDays,
  dayLabel,
  dkey,
  itemsText,
  money,
  normPhone,
  telHref,
  todayKey,
} from './util.js';

const useMe = () => {
  const db = useDB();
  const { me } = useSession();
  return { db, me, c: db.customers[me] };
};
const availDays = (db) => {
  const out = [];
  const t = new Date();
  for (let i = 0; i < 28; i++) {
    const k = dkey(addDays(t, i));
    if (db.days[k]) out.push(k);
  }
  return out;
};

/* ============ BIENVENIDA ============ */
export function Welcome() {
  const { go } = useApp();
  return (
    <section className="hero">
      <p className="eyebrow">Su pedido, a su puerta</p>
      <h1 className="shine">{APP_NAME}</h1>
      <p className="sub">Escoja lo que necesita y el día que le queda bien. Nosotros se lo llevamos.</p>
      <Glass className="how">
        {['Escoja lo que necesita', 'Elija el día de entrega', 'Espere en casa, que nosotros llegamos'].map((t, i) => (
          <div className="row" key={t}>
            <b className="n">{i + 1}</b>
            <span>{t}</span>
          </div>
        ))}
      </Glass>
      <div className="cta">
        <Btn kind="primary big" block onClick={() => go('register')}>
          Hacer mi pedido
        </Btn>
        <InstallButton />
      </div>
      <Surco />
      <p className="owner-link">
        <button type="button" onClick={() => go('pin')}>
          <Icon n="lock" /> Soy el dueño
        </button>
      </p>
    </section>
  );
}

/* ============ REGISTRO (una pregunta por pantalla) ============ */
const REG = [
  {
    k: 'name',
    q: '¿Cómo se llama?',
    h: 'Escriba su nombre para saber quién es.',
    ph: 'Ejemplo: María Gómez',
    type: 'text',
    ac: 'name',
    im: 'text',
    check: (v) => (v.trim().length < 2 ? 'Por favor escriba su nombre.' : ''),
  },
  {
    k: 'phone',
    q: '¿Cuál es su número de celular?',
    h: 'Es para avisarle cuando su pedido llegue.',
    ph: '3001234567',
    type: 'tel',
    ac: 'tel',
    im: 'numeric',
    check: (v) => (normPhone(v).length !== 10 ? 'Escriba los 10 números de su celular, sin espacios.' : ''),
  },
  {
    k: 'address',
    q: '¿A dónde le llevamos el pedido?',
    h: 'Escriba la dirección con calle, número y barrio.',
    ph: 'Ejemplo: Calle 5 #10-20, barrio Granada',
    type: 'text',
    ac: 'street-address',
    im: 'text',
    check: (v) => (v.trim().length < 5 ? 'Escriba la dirección completa, por favor.' : ''),
  },
];

export function Register() {
  const { go, draft, setDraft, regStep, setRegStep, editing, setEditing } = useApp();
  const { c } = useMe();
  const [err, setErr] = useState('');
  const ref = useRef(null);
  const s = REG[regStep];
  const last = regStep === REG.length - 1;

  useEffect(() => {
    const t = setTimeout(() => ref.current && ref.current.focus({ preventScroll: true }), 120);
    return () => clearTimeout(t);
  }, [regStep]);

  const next = () => {
    const msg = s.check(draft[s.k] || '');
    if (msg) return setErr(msg);
    setErr('');
    if (!last) return setRegStep(regStep + 1);
    const name = draft.name.trim();
    saveCustomer({ name, phone: normPhone(draft.phone), address: draft.address.trim() });
    toast(editing ? '✅ Sus datos quedaron guardados' : `¡Bienvenido, ${name.split(' ')[0]}! 👋`);
    setEditing(false);
    go(editing ? 'track' : 'order');
  };
  const back = () => {
    setErr('');
    if (regStep > 0) return setRegStep(regStep - 1);
    setEditing(false);
    go(c ? 'track' : 'welcome');
  };

  return (
    <section className="reg">
      <div className="bars" aria-hidden="true">
        {REG.map((_, i) => (
          <i key={i} className={cx(i <= regStep && 'on')} />
        ))}
      </div>
      <p className="eyebrow">
        Paso {regStep + 1} de {REG.length}
      </p>
      <h2 className="q">{s.q}</h2>
      <p className="lead">{s.h}</p>
      <Glass className="fieldbox">
        <input
          ref={ref}
          className="big-input"
          type={s.type}
          inputMode={s.im}
          autoComplete={s.ac}
          aria-label={s.q}
          placeholder={s.ph}
          maxLength={s.k === 'phone' ? 14 : 90}
          enterKeyHint={last ? 'done' : 'next'}
          value={draft[s.k] || ''}
          onChange={(e) => setDraft({ ...draft, [s.k]: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && next()}
        />
      </Glass>
      <p className="err" role="alert">
        {err}
      </p>
      <div className="cta">
        <Btn kind="primary big" block onClick={next} icon={last ? 'check' : undefined}>
          {last ? 'Listo' : 'Siguiente'}
        </Btn>
        <Btn kind="ghost" block onClick={back}>
          Atrás
        </Btn>
      </div>
    </section>
  );
}

/* Botones de arriba (Atrás / Continuar) para no tener que bajar hasta el final */
function TopNav({ onBack, onNext, nextLabel = 'Continuar', dim }) {
  return (
    <div className="topnav">
      {onBack ? (
        <Btn kind="ghost small" icon="back" onClick={onBack}>
          Atrás
        </Btn>
      ) : (
        <span />
      )}
      {onNext && (
        <Btn kind="primary small" className={cx(dim && 'dim')} onClick={onNext}>
          {nextLabel}
          <Icon n="back" className="flip" />
        </Btn>
      )}
    </div>
  );
}

/* ============ PEDIR: 1 · ELEGIR ============ */
const STEPS = ['Elegir', 'Día', 'Revisar'];

function ProductCard({ p, q, onChange }) {
  return (
    <Glass className={cx('pcard', q > 0 && 'sel', p.img && 'hasimg')}>
      {p.img && (
        <div className="pimg">
          <img src={imgSrc(p.img)} alt="" loading="lazy" />
          {q > 0 && <span className="qbadge">Lleva {q}</span>}
        </div>
      )}
      <div className="ph">
        {!p.img && (
          <div className="emo" aria-hidden="true">
            {p.emoji}
          </div>
        )}
        <div>
          <h3>{p.name}</h3>
          {p.desc && <p>{p.desc}</p>}
        </div>
      </div>
      <div className="pf">
        <div className="price">{money(p.price)}</div>
        <div className="qty">
          <button type="button" aria-label={`Quitar uno de ${p.name}`} onClick={() => onChange(-1)} disabled={!q}>
            <Icon n="minus" />
          </button>
          <b aria-live="polite">{q}</b>
          <button type="button" className="plus" aria-label={`Agregar uno de ${p.name}`} onClick={() => onChange(1)}>
            <Icon n="plus" />
          </button>
        </div>
      </div>
    </Glass>
  );
}

export const cartItems = (db, cart) =>
  Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([pid, qty]) => {
      const p = db.products.find((x) => x.id === pid);
      return p && { pid, qty, name: p.name, emoji: p.emoji, price: p.price };
    })
    .filter(Boolean);

export function Order() {
  const { go, cart, setCart } = useApp();
  const { db, me, c } = useMe();
  const [shake, setShake] = useState(false);
  const prods = db.products.filter((p) => p.on);
  const items = cartItems(db, cart);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const active = db.orders.filter((o) => o.cid === me && !DONE.includes(o.status)).sort((a, b) => b.at - a.at)[0];

  const change = (id, d) => setCart((prev) => ({ ...prev, [id]: Math.max(0, Math.min(20, (prev[id] || 0) + d)) }));
  const next = () => {
    if (!items.length) {
      toast('Elija al menos un producto 👆');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    go('day');
  };

  return (
    <section>
      <TopNav onNext={next} dim={!items.length} />
      <p className="eyebrow">Hola, {c.name.split(' ')[0]} 👋</p>
      <h2 className="q">¿Qué desea pedir?</h2>
      <Steps n={1} labels={STEPS} />
      {active && (
        <Glass as="button" className="banner" onClick={() => go('track')}>
          <span className="bi">{ST[active.status].emoji}</span>
          <span>
            <b>Ya tiene un pedido</b>
            <br />
            {ST[active.status].t} · toque para verlo
          </span>
        </Glass>
      )}
      {prods.length === 0 ? (
        <Empty emoji="🛍️" title="Por ahora no hay productos">
          Escríbanos y con gusto le ayudamos.
        </Empty>
      ) : (
        prods.map((p) => <ProductCard key={p.id} p={p} q={cart[p.id] || 0} onChange={(d) => change(p.id, d)} />)
      )}
      {items.length > 0 && (
        <div className="totalbar">
          <span>Total</span>
          <b>{money(total)}</b>
        </div>
      )}
      <Btn kind="primary big" block className={cx(!items.length && 'dim', shake && 'shake')} onClick={next}>
        Continuar
      </Btn>
    </section>
  );
}

/* ============ PEDIR: 2 · DÍA ============ */
export function Day() {
  const { go, day, setDay } = useApp();
  const { db } = useMe();
  const [shake, setShake] = useState(false);
  const days = availDays(db);

  useEffect(() => {
    if (day && !db.days[day]) setDay('');
  }, [day, db.days, setDay]);

  const next = () => {
    if (!day) {
      toast('Toque el día que le sirve 👆');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    go('confirm');
  };

  return (
    <section>
      <TopNav onBack={() => go('order')} onNext={days.length ? next : undefined} dim={!day} />
      <p className="eyebrow">Ya casi</p>
      <h2 className="q">¿Qué día le llevamos su pedido?</h2>
      <Steps n={2} labels={STEPS} />
      {db.settings.hours && (
        <p className="hours">
          <Icon n="clock" /> {db.settings.hours}
        </p>
      )}
      {days.length === 0 ? (
        <Empty emoji="📅" title="Por ahora no hay días disponibles">
          Escríbanos por el chat y le avisamos apenas haya fechas.
        </Empty>
      ) : (
        <div role="radiogroup" aria-label="Día de entrega" className="days">
          {days.map((k) => {
            const l = dayLabel(k);
            const on = day === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={on}
                className="daybtn"
                onClick={() => setDay(k)}
              >
                <span>
                  {l.main}
                  {l.tag && <em className="tag">{l.tag}</em>}
                </span>
                <i className="chk">
                  <Icon n="check" />
                </i>
              </button>
            );
          })}
        </div>
      )}
      <div className="cta">
        {days.length === 0 ? (
          <Btn kind="primary big" block onClick={() => go('chat')} icon="chat">
            Escribir por el chat
          </Btn>
        ) : (
          <Btn kind="primary big" block className={cx(!day && 'dim', shake && 'shake')} onClick={next}>
            Continuar
          </Btn>
        )}
        <Btn kind="ghost" block onClick={() => go('order')}>
          Atrás
        </Btn>
      </div>
    </section>
  );
}

/* ============ PEDIR: 3 · REVISAR ============ */
export function Confirm() {
  const { go, cart, setCart, day, setDay, startEdit } = useApp();
  const { db, me, c } = useMe();
  const items = cartItems(db, cart);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  useEffect(() => {
    if (!items.length) go('order');
  }, [items.length, go]);
  if (!items.length || !day) return null;

  const send = () => {
    if (!db.days[day] || day < todayKey()) {
      toast('Ese día ya no está disponible, escoja otro por favor.');
      setDay('');
      go('day');
      return;
    }
    createOrder({ cid: me, items, total, day });
    setCart({});
    setDay('');
    toast('✅ ¡Pedido enviado! Pronto le avisamos.');
    go('track');
  };

  return (
    <section>
      <TopNav onBack={() => go('day')} onNext={send} nextLabel="Enviar pedido" />
      <p className="eyebrow">Último paso</p>
      <h2 className="q">Revise su pedido</h2>
      <Steps n={3} labels={STEPS} />
      <Glass className="sum">
        {items.map((i) => (
          <div className="line" key={i.pid}>
            <span>
              {i.emoji} {i.qty} × {i.name}
            </span>
            <b>{money(i.qty * i.price)}</b>
          </div>
        ))}
        <div className="line total">
          <span>Total a pagar</span>
          <b>{money(total)}</b>
        </div>
      </Glass>
      <Glass className="sum">
        <div className="kv">
          <Icon n="calendar" />
          <span>
            <small>Día de entrega</small>
            {dayLabel(day).main}
          </span>
        </div>
        <div className="kv">
          <Icon n="pin" />
          <span>
            <small>Dirección</small>
            {c.address}
          </span>
        </div>
        <button type="button" className="linkbtn" onClick={startEdit}>
          Cambiar mis datos o dirección
        </button>
      </Glass>
      <div className="cta">
        <Btn kind="primary big" block icon="check" onClick={send}>
          Enviar mi pedido
        </Btn>
        <Btn kind="ghost" block onClick={() => go('day')}>
          Atrás
        </Btn>
      </div>
    </section>
  );
}

/* ============ MI PEDIDO ============ */
const TL = [
  ['nuevo', 'Pedido recibido'],
  ['preparando', 'Preparando su pedido'],
  ['camino', 'Ya va para allá'],
  ['llego', 'Ya llegó'],
  ['entregado', 'Entregado'],
];

export function OrderTimeline({ o }) {
  const idx = FLOW.indexOf(o.status);
  return (
    <ul className="tl">
      {TL.map(([k, t], i) => (
        <li key={k} className={cx(i < idx && 'done', i === idx && 'now')} aria-current={i === idx ? 'step' : undefined}>
          <span className="d">{i < idx || k === 'entregado' && i === idx ? <Icon n="check" /> : null}</span>
          {t}
        </li>
      ))}
    </ul>
  );
}

export function DelayBox({ o }) {
  if (!o.delay) return null;
  return (
    <div className="warnbox" role="status">
      <span className="bi">⏳</span>
      <div>
        <b>Se va a demorar un poquito</b>
        <br />
        {o.delay.min ? `Unos ${o.delay.min} minutos más. ` : ''}
        {o.delay.msg}
      </div>
    </div>
  );
}

export function Track() {
  const { go, startEdit } = useApp();
  const { db, me, c } = useMe();
  const { ask } = useApp();
  const mine = db.orders.filter((o) => o.cid === me).sort((a, b) => b.at - a.at);
  const active = mine.find((o) => !DONE.includes(o.status));
  const shown = active || mine[0];
  const past = mine.filter((o) => o !== shown);

  const cancel = () =>
    ask({
      title: '¿Cancelar su pedido?',
      text: 'Si cambia de opinión, puede hacer uno nuevo cuando quiera.',
      yes: 'Sí, cancelar',
      no: 'No, dejarlo',
      danger: true,
      onYes: () => setStatus(shown.id, 'cancelado'),
    });

  return (
    <section>
      <p className="eyebrow">Mi pedido</p>
      {!shown ? (
        <>
          <Empty emoji="🛍️" title="Todavía no ha hecho pedidos">
            Cuando haga uno, aquí podrá ver por dónde va.
          </Empty>
          <Btn kind="primary big" block onClick={() => go('order')}>
            Hacer un pedido
          </Btn>
        </>
      ) : (
        <>
          <Glass className={cx('hero-status', shown.status)}>
            <div className="bigemo" aria-hidden="true">
              {ST[shown.status].emoji}
            </div>
            <h2>{ST[shown.status].cust}</h2>
            <p className="muted">
              Pedido n.º {shown.n} · {dayLabel(shown.day).main}
            </p>
          </Glass>
          <DelayBox o={shown} />
          {shown.status !== 'cancelado' && (
            <Glass className="card">
              <OrderTimeline o={shown} />
            </Glass>
          )}
          <Glass className="sum">
            {shown.items.map((i) => (
              <div className="line" key={i.pid}>
                <span>
                  {i.emoji} {i.qty} × {i.name}
                </span>
                <b>{money(i.qty * i.price)}</b>
              </div>
            ))}
            <div className="line total">
              <span>Total a pagar</span>
              <b>{money(shown.total)}</b>
            </div>
          </Glass>
          <div className="cta">
            {active ? (
              <Btn kind="primary big" block icon="chat" onClick={() => go('chat')}>
                Escribirle al vendedor
              </Btn>
            ) : (
              <Btn kind="primary big" block icon="bag" onClick={() => go('order')}>
                Hacer un pedido nuevo
              </Btn>
            )}
            {db.settings.ownerPhone && (
              <a className="btn ghost block" href={telHref(db.settings.ownerPhone)}>
                <Icon n="phone" /> Llamar
              </a>
            )}
            {active && active.status === 'nuevo' && (
              <button type="button" className="linkbtn danger" onClick={cancel}>
                Cancelar este pedido
              </button>
            )}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 className="sec">Pedidos anteriores</h3>
          {past.map((o) => (
            <Glass className="mini" key={o.id}>
              <div>
                <b>Pedido n.º {o.n}</b>
                <small>
                  {dayLabel(o.day).main} · {itemsText(o)}
                </small>
              </div>
              <Pill st={o.status} />
            </Glass>
          ))}
        </>
      )}

      <Glass className="sum mydata">
        <h3>Mis datos</h3>
        <div className="kv">
          <Icon n="chat" />
          <span>
            <small>Nombre</small>
            {c.name}
          </span>
        </div>
        <div className="kv">
          <Icon n="phone" />
          <span>
            <small>Celular</small>
            {c.phone}
          </span>
        </div>
        <div className="kv">
          <Icon n="pin" />
          <span>
            <small>Dirección</small>
            {c.address}
          </span>
        </div>
        <button type="button" className="linkbtn" onClick={startEdit}>
          Cambiar mis datos o dirección
        </button>
        <button type="button" className="linkbtn mute" onClick={() => go('pin')}>
          <Icon n="lock" /> Soy el dueño
        </button>
      </Glass>
    </section>
  );
}

/* ============ CHAT (cliente) ============ */
function FaqSheet({ cid, close }) {
  const db = useDB();
  return (
    <>
      <h3>Preguntas frecuentes</h3>
      <p className="muted">Toque una pregunta y le respondemos al instante.</p>
      <div className="faqlist">
        {db.faqs
          .filter((f) => f.q.trim() && f.a.trim())
          .map((f) => (
            <button
              key={f.id}
              type="button"
              className="faqitem"
              onClick={() => {
                askBot(cid, f);
                close();
              }}
            >
              <span>{f.q}</span>
              <Icon n="back" className="flip" />
            </button>
          ))}
      </div>
      <Btn kind="ghost" block onClick={close}>
        Cerrar
      </Btn>
    </>
  );
}

export function ClientChat() {
  const { db, me } = useMe();
  const { openSheet, closeSheet } = useApp();
  const hasFaq = db.faqs.some((f) => f.q.trim() && f.a.trim());
  return (
    <section className="chatscreen">
      <p className="eyebrow">Chat</p>
      <h2 className="q">Escríbale a {db.settings.ownerName}</h2>
      <Chat
        cid={me}
        viewer="cliente"
        top={
          hasFaq && (
            <button type="button" className="faqbtn" onClick={() => openSheet(<FaqSheet cid={me} close={closeSheet} />)}>
              <span>💡</span> Preguntas frecuentes
            </button>
          )
        }
        quick={['¿Ya viene mi pedido?', 'Quiero cambiar mi pedido', 'Llámeme por favor', 'Muchas gracias 🙏']}
      />
    </section>
  );
}

/* ============ MI PERFIL (cambiar nombre, celular y dirección) ============ */
const LABELS = { name: 'Nombre', phone: 'Celular', address: 'Dirección de entrega' };

export function Profile() {
  const { go, backTo } = useApp();
  const { c } = useMe();
  const [f, setF] = useState({ name: c.name, phone: c.phone, address: c.address });
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    setErrs({ ...errs, [k]: '' });
  };
  const back = () => go(backTo || 'track');
  const save = () => {
    const e = {};
    REG.forEach((s) => {
      const m = s.check(f[s.k] || '');
      if (m) e[s.k] = m;
    });
    if (Object.keys(e).length) return setErrs(e);
    saveCustomer({ name: f.name.trim(), phone: normPhone(f.phone), address: f.address.trim() });
    toast('✅ Sus datos quedaron guardados');
    back();
  };

  return (
    <section>
      <TopNav onBack={back} onNext={save} nextLabel="Guardar" />
      <p className="eyebrow">Mi perfil</p>
      <h2 className="q">Mis datos</h2>
      <p className="lead">Cambie lo que necesite y toque «Guardar».</p>
      {REG.map((s) => (
        <div className="pfield" key={s.k}>
          <label className="lbl" htmlFor={'pf-' + s.k}>
            {LABELS[s.k]}
          </label>
          <Glass className="fieldbox sm">
            <input
              id={'pf-' + s.k}
              className="big-input"
              type={s.type}
              inputMode={s.im}
              autoComplete={s.ac}
              placeholder={s.ph}
              maxLength={s.k === 'phone' ? 14 : 90}
              value={f[s.k] || ''}
              onChange={set(s.k)}
            />
          </Glass>
          <p className="err" role="alert">
            {errs[s.k]}
          </p>
        </div>
      ))}
      <p className="hint">Si cambia la dirección, el repartidor la verá en todos sus pedidos que aún no hayan llegado.</p>
      <div className="cta">
        <Btn kind="primary big" block icon="check" onClick={save}>
          Guardar cambios
        </Btn>
        <Btn kind="ghost" block onClick={back}>
          Atrás
        </Btn>
      </div>
    </section>
  );
}
