import { imgSrc, uploadImage } from './store.js';
import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';
import { Btn, Empty, Glass, Pill, Seg, Switch, cx } from './ui.jsx';
import { useApp } from './ctx.js';
import { InstallButton } from './install.jsx';
import Chat from './Chat.jsx';
import { DelayBox } from './client.jsx';
import {
  clearDelay,
  seedExamples,
  setDays,
  setDelay,
  setSession,
  setStatus,
  toast,
  updateFaq,
  updateProduct,
  updateSettings,
  useDB,
  wipeOrders,
} from './store.js';
import {
  DONE,
  FLOW,
  ST,
  addDays,
  dayLabel,
  digits,
  dkey,
  hm,
  itemsText,
  mapsHref,
  money,
  mondayOf,
  normPhone,
  telHref,
  todayKey,
  waHref,
} from './util.js';

const firstName = (n) => (n || 'Cliente').split(' ')[0];

/* ============ CLAVE ============ */
export function Pin() {
  const { go } = useApp();
  const db = useDB();
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(false);

  const press = (d) => {
    if (pin.length >= 4) return;
    const n = pin + d;
    setPin(n);
    if (n.length === 4) {
      if (n === db.settings.pin) {
        setSession({ role: 'owner' });
        go('a-orders');
      } else {
        setBad(true);
        setTimeout(() => {
          setBad(false);
          setPin('');
        }, 500);
      }
    }
  };
  useEffect(() => {
    const k = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  return (
    <section className="pinscr">
      <p className="eyebrow">Zona del dueño</p>
      <h2 className="q">Escriba su clave</h2>
      <div className={cx('dots', bad && 'shake')} aria-label={`${pin.length} de 4 números`}>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={cx(i < pin.length && 'on')} />
        ))}
      </div>
      <div className="keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" onClick={() => press(String(n))}>
            {n}
          </button>
        ))}
        <button type="button" className="ghost" aria-label="Borrar" onClick={() => setPin(pin.slice(0, -1))}>
          ⌫
        </button>
        <button type="button" onClick={() => press('0')}>
          0
        </button>
        <button type="button" className="ghost txt" onClick={() => go('welcome')}>
          Volver
        </button>
      </div>
      {db.settings.pin === '1234' && <p className="hint">Clave inicial: 1234 (cámbiela en Ajustes)</p>}
    </section>
  );
}

/* ============ PEDIDOS ============ */
const sortOrders = (a, b) => (a.day === b.day ? a.at - b.at : a.day < b.day ? -1 : 1);

export function Orders() {
  const { go } = useApp();
  const db = useDB();
  const [f, setF] = useState('activos');
  const t = todayKey();
  const act = db.orders.filter((o) => !DONE.includes(o.status));
  const list = (f === 'activos' ? act : db.orders.filter((o) => DONE.includes(o.status))).sort(sortOrders);
  if (f !== 'activos') list.reverse();
  const unread = (cid) => db.messages.filter((m) => m.cid === cid && m.from === 'cliente' && !m.read).length;

  return (
    <section>
      <p className="eyebrow">Panel del dueño</p>
      <h2 className="q">Pedidos</h2>
      <div className="stats">
        <Glass>
          <b className="stat">{act.filter((o) => o.status === 'nuevo').length}</b>
          <span>Nuevos</span>
        </Glass>
        <Glass>
          <b className="stat">{act.filter((o) => o.day === t).length}</b>
          <span>Para hoy</span>
        </Glass>
        <Glass>
          <b className="stat">{act.filter((o) => o.status === 'camino').length}</b>
          <span>En camino</span>
        </Glass>
      </div>
      <Seg
        label="Ver pedidos"
        value={f}
        onChange={setF}
        options={[
          { v: 'activos', t: `Por atender (${act.length})` },
          { v: 'hechos', t: 'Terminados' },
        ]}
      />
      {list.length === 0 ? (
        <Empty emoji={f === 'activos' ? '📭' : '🗂️'} title={f === 'activos' ? 'No hay pedidos por atender' : 'Aún no hay pedidos terminados'}>
          {f === 'activos' ? 'Cuando un cliente haga un pedido, aparece aquí. Puede cargar ejemplos en Ajustes.' : ''}
        </Empty>
      ) : (
        list.map((o) => {
          const c = db.customers[o.cid];
          const u = unread(o.cid);
          return (
            <Glass as="button" key={o.id} className="ocard" onClick={() => go('a-order', o.id)}>
              <div className="top">
                <b>
                  Pedido n.º {o.n} {u > 0 && <i className="dot" title="Mensaje nuevo" />}
                </b>
                <span className="pills">
                  {o.delay && <Pill st="warn">Retrasado</Pill>}
                  <Pill st={o.status} />
                </span>
              </div>
              <div className="who">
                {c ? c.name : 'Cliente'} · {c ? c.address : ''}
              </div>
              <div className="its">{itemsText(o)}</div>
              <div className="bot">
                <span>
                  <Icon n="calendar" /> {dayLabel(o.day).tag || dayLabel(o.day).main}
                </span>
                <b>{money(o.total)}</b>
              </div>
            </Glass>
          );
        })
      )}
    </section>
  );
}

function DelaySheet({ id, close }) {
  const [min, setMin] = useState(15);
  const [msg, setMsg] = useState('');
  return (
    <>
      <h3>¿Cuánto se va a demorar?</h3>
      <p className="muted">El cliente verá el aviso y recibirá un mensaje en el chat.</p>
      <div className="chips">
        {[10, 15, 30, 45, 60].map((m) => (
          <button key={m} type="button" className={cx('chip', min === m && 'on')} onClick={() => setMin(m)}>
            {m} min
          </button>
        ))}
      </div>
      <input
        className="field"
        placeholder="Mensaje opcional: hay mucho tráfico…"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        maxLength={120}
      />
      <div className="cta">
        <Btn
          kind="primary"
          block
          onClick={() => {
            setDelay(id, min, msg.trim());
            toast('⏳ Se avisó al cliente del retraso');
            close();
          }}
        >
          Avisar al cliente
        </Btn>
        <Btn kind="ghost" block onClick={close}>
          Cancelar
        </Btn>
      </div>
    </>
  );
}

export function OrderDetail() {
  const { route, go, openSheet, closeSheet, ask } = useApp();
  const db = useDB();
  const o = db.orders.find((x) => x.id === route.sel);
  useEffect(() => {
    if (!o) go('a-orders');
  }, [o, go]);
  if (!o) return null;
  const c = db.customers[o.cid] || { name: 'Cliente', phone: '', address: '' };
  const unread = db.messages.filter((m) => m.cid === o.cid && m.from === 'cliente' && !m.read).length;
  const done = DONE.includes(o.status);

  return (
    <section>
      <button type="button" className="back" onClick={() => go('a-orders')}>
        <Icon n="back" /> Pedidos
      </button>
      <Glass className="card">
        <div className="top">
          <h2>Pedido n.º {o.n}</h2>
          <Pill st={o.status} />
        </div>
        <p className="muted">
          Recibido a las {hm(o.at)} · Entrega: {dayLabel(o.day).main}
        </p>
      </Glass>
      <DelayBox o={o} />

      <Glass className="sum">
        <h3>{c.name}</h3>
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
        <div className="actions">
          {c.phone && (
            <a className="btn ghost" href={telHref(c.phone)}>
              <Icon n="phone" /> Llamar
            </a>
          )}
          {c.phone && (
            <a className="btn ghost" href={waHref(c.phone)} target="_blank" rel="noreferrer">
              <Icon n="chat" /> WhatsApp
            </a>
          )}
          {c.address && (
            <a className="btn ghost" href={mapsHref(c.address)} target="_blank" rel="noreferrer">
              <Icon n="pin" /> Mapa
            </a>
          )}
        </div>
      </Glass>

      <Glass className="sum">
        {o.items.map((i) => (
          <div className="line" key={i.pid}>
            <span>
              {i.emoji} {i.qty} × {i.name}
            </span>
            <b>{money(i.qty * i.price)}</b>
          </div>
        ))}
        <div className="line total">
          <span>Total</span>
          <b>{money(o.total)}</b>
        </div>
      </Glass>

      <h3 className="sec">¿Cómo va el pedido?</h3>
      <div className="stgrid">
        {FLOW.map((s) => (
          <button
            key={s}
            type="button"
            className={cx('st', o.status === s && 'on')}
            aria-pressed={o.status === s}
            onClick={() => setStatus(o.id, s)}
          >
            <span>{ST[s].emoji}</span>
            {ST[s].t}
          </button>
        ))}
      </div>
      {!done && (
        <div className="cta">
          {o.delay ? (
            <Btn kind="ghost" block onClick={() => clearDelay(o.id)}>
              Quitar aviso de retraso
            </Btn>
          ) : (
            <Btn kind="warn" block icon="clock" onClick={() => openSheet(<DelaySheet id={o.id} close={closeSheet} />)}>
              Avisar retraso
            </Btn>
          )}
        </div>
      )}
      <div className="cta">
        <Btn kind="primary" block icon="chat" onClick={() => go('a-chat', o.cid)}>
          Chat con {firstName(c.name)} {unread > 0 && `(${unread})`}
        </Btn>
        {!done && (
          <button
            type="button"
            className="linkbtn danger"
            onClick={() =>
              ask({
                title: '¿Cancelar este pedido?',
                text: 'El cliente verá que fue cancelado.',
                yes: 'Sí, cancelar',
                no: 'No',
                danger: true,
                onYes: () => setStatus(o.id, 'cancelado'),
              })
            }
          >
            Cancelar pedido
          </button>
        )}
      </div>
    </section>
  );
}

/* ============ DÍAS ============ */
const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WDN = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function Days() {
  const db = useDB();
  const today = todayKey();
  const cells = Array.from({ length: 28 }, (_, i) => addDays(mondayOf(new Date()), i));
  const future = cells.map(dkey).filter((k) => k >= today);

  const toggleCol = (i) => {
    const keys = cells.filter((_, j) => j % 7 === i).map(dkey).filter((k) => k >= today);
    setDays(keys, !keys.every((k) => db.days[k]));
  };

  return (
    <section>
      <p className="eyebrow">Disponibilidad</p>
      <h2 className="q">¿Qué días puede entregar?</h2>
      <p className="lead">Toque un día para activarlo o quitarlo. Los clientes solo verán los días activos.</p>
      <Glass className="card cal">
        <div className="wd">
          {WD.map((l, i) => (
            <button key={i} type="button" aria-label={`Activar o quitar todos los ${WDN[i]}`} onClick={() => toggleCol(i)}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid7">
          {cells.map((d) => {
            const k = dkey(d);
            const past = k < today;
            const on = !past && !!db.days[k];
            return (
              <button
                key={k}
                type="button"
                disabled={past}
                aria-pressed={on}
                aria-label={dayLabel(k).main}
                className={cx('dg', on && 'on', k === today && 'today')}
                onClick={() => setDays([k], !db.days[k])}
              >
                {d.getDate()}
                {(d.getDate() === 1 || k === dkey(cells[0])) && (
                  <small>{d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</small>
                )}
              </button>
            );
          })}
        </div>
        <p className="hint">Toque una letra (L, M, J…) para cambiar todos los días de esa columna.</p>
      </Glass>
      <div className="actions two">
        <Btn kind="ghost" onClick={() => setDays(future, true)}>
          Activar todos
        </Btn>
        <Btn kind="ghost" onClick={() => setDays(future, false)}>
          Quitar todos
        </Btn>
      </div>
      <Glass className="sum">
        <label className="lbl" htmlFor="hours">
          Horario de entrega (lo ven los clientes)
        </label>
        <input
          id="hours"
          className="field"
          value={db.settings.hours}
          onChange={(e) => updateSettings({ hours: e.target.value })}
          placeholder="Ejemplo: Entregamos entre 9 a. m. y 5 p. m."
          maxLength={100}
        />
      </Glass>
    </section>
  );
}

/* ============ PRODUCTOS ============ */
function PhotoPicker({ p }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      const id = await uploadImage(f);
      updateProduct(p.id, { img: id });
    } catch {
      setErr('No se pudo subir la foto. Intente con otra.');
    }
    setBusy(false);
  };
  return (
    <div className="pe-photo">
      <div className="pe-thumb">{p.img ? <img src={imgSrc(p.img)} alt="" /> : <span>{p.emoji}</span>}</div>
      <div className="pe-acts">
        <label className="btn ghost small pe-up">
          {busy ? 'Subiendo…' : p.img ? 'Cambiar foto' : 'Subir foto'}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={pick} />
        </label>
        {p.img && (
          <button type="button" className="linkbtn mute" onClick={() => updateProduct(p.id, { img: '' })}>
            Quitar foto
          </button>
        )}
      </div>
      {err && <p className="hint err">{err}</p>}
    </div>
  );
}

export function Products() {
  const db = useDB();
  return (
    <section>
      <p className="eyebrow">Lo que ven sus clientes</p>
      <h2 className="q">Mis 3 productos</h2>
      <p className="lead">Cambie el nombre, el precio o apague uno si se agotó.</p>
      {db.products.map((p, i) => (
        <Glass className="sum prod-edit" key={p.id}>
          <div className="pe-top">
            <b>Producto {i + 1}</b>
            <label className="switch">
              <span>{p.on ? 'Disponible' : 'Agotado'}</span>
              <Switch checked={p.on} label={`Producto ${i + 1} disponible`} onChange={(v) => updateProduct(p.id, { on: v })} />
            </label>
          </div>
          <PhotoPicker p={p} />
          <input
            className="field"
            aria-label="Nombre"
            value={p.name}
            maxLength={40}
            onChange={(e) => updateProduct(p.id, { name: e.target.value })}
          />
          <input
            className="field"
            aria-label="Descripción"
            placeholder="Qué incluye (opcional)"
            value={p.desc}
            maxLength={80}
            onChange={(e) => updateProduct(p.id, { desc: e.target.value })}
          />
          <div className="pe-price">
            <span>Precio</span>
            <input
              className="field"
              aria-label="Precio en pesos"
              inputMode="numeric"
              value={p.price ? String(p.price) : ''}
              placeholder="0"
              onChange={(e) => updateProduct(p.id, { price: Number(digits(e.target.value).slice(0, 8)) || 0 })}
            />
            <b>{money(p.price)}</b>
          </div>
        </Glass>
      ))}
    </section>
  );
}

/* ============ CHATS ============ */
export function Chats() {
  const { go } = useApp();
  const db = useDB();
  const convs = Object.values(db.customers)
    .map((c) => {
      const ms = db.messages.filter((m) => m.cid === c.id).sort((a, b) => a.at - b.at);
      return { c, last: ms[ms.length - 1], unread: ms.filter((m) => m.from === 'cliente' && !m.read).length };
    })
    .filter((x) => x.last)
    .sort((a, b) => b.last.at - a.last.at);

  return (
    <section>
      <p className="eyebrow">Mensajes</p>
      <h2 className="q">Chats</h2>
      {convs.length === 0 ? (
        <Empty emoji="💬" title="Aún no hay conversaciones">
          Cuando un cliente se registre o le escriba, aparece aquí.
        </Empty>
      ) : (
        convs.map(({ c, last, unread }) => (
          <Glass as="button" key={c.id} className="crow" onClick={() => go('a-chat', c.id)}>
            <span className="av">{c.name.charAt(0).toUpperCase()}</span>
            <span className="cm">
              <b>{c.name}</b>
              <small>
                {last.from === 'dueno' ? 'Usted: ' : ''}
                {last.text}
              </small>
            </span>
            <span className="ct">
              <small>{hm(last.at)}</small>
              {unread > 0 && <i className="badge static">{unread}</i>}
            </span>
          </Glass>
        ))
      )}
    </section>
  );
}

export function AdminChat() {
  const { route, go } = useApp();
  const db = useDB();
  const c = db.customers[route.sel];
  if (!c) return null;
  return (
    <section className="chatscreen">
      <button type="button" className="back" onClick={() => go('a-chats')}>
        <Icon n="back" /> Chats
      </button>
      <div className="chat-head">
        <h2 className="q">{c.name}</h2>
        {c.phone && (
          <a className="btn ghost small" href={telHref(c.phone)} aria-label={`Llamar a ${c.name}`}>
            <Icon n="phone" />
          </a>
        )}
      </div>
      <Chat
        cid={c.id}
        viewer="dueno"
        quick={['Ya salgo 🛵', 'Voy en camino', 'Me demoro unos 15 min', 'Ya llegué, salga por favor', 'Muchas gracias 🙏']}
      />
    </section>
  );
}

/* ============ AJUSTES ============ */
export function Settings() {
  const { go, ask, exitOwner } = useApp();
  const db = useDB();
  const [pin, setPin] = useState(db.settings.pin);
  const pinOk = /^\d{4}$/.test(pin);

  return (
    <section>
      <p className="eyebrow">Panel del dueño</p>
      <h2 className="q">Ajustes</h2>
      <Glass className="sum">
        <label className="lbl" htmlFor="oname">
          Nombre que ven los clientes en el chat
        </label>
        <input
          id="oname"
          className="field"
          value={db.settings.ownerName}
          maxLength={30}
          onChange={(e) => updateSettings({ ownerName: e.target.value })}
        />
        <label className="lbl" htmlFor="ophone">
          Su celular (los clientes pueden llamarle)
        </label>
        <input
          id="ophone"
          className="field"
          type="tel"
          inputMode="numeric"
          placeholder="3001234567"
          value={db.settings.ownerPhone}
          maxLength={14}
          onChange={(e) => updateSettings({ ownerPhone: e.target.value })}
        />
        {db.settings.ownerPhone && normPhone(db.settings.ownerPhone).length !== 10 && (
          <p className="err">El celular debe tener 10 números.</p>
        )}
        <label className="lbl" htmlFor="pin">
          Clave de 4 números para entrar al panel
        </label>
        <input
          id="pin"
          className="field"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            const v = digits(e.target.value).slice(0, 4);
            setPin(v);
            if (/^\d{4}$/.test(v)) updateSettings({ pin: v });
          }}
        />
        <p className={cx('hint', !pinOk && 'err')}>{pinOk ? 'Clave guardada ✓' : 'Escriba 4 números.'}</p>
        <p className="hint">Esta clave es un candado básico. Cuando conecte el servidor, la seguridad real se hace allí.</p>
      </Glass>

      <Glass className="sum">
        <h3>Respuestas automáticas</h3>
        <p className="muted">
          Son las preguntas frecuentes que ve el cliente en el chat. Cambie lo que quiera; deje una vacía para ocultarla. En
          las respuestas puede usar {'{dias}'}, {'{horario}'} y {'{telefono}'}: se llenan solos.
        </p>
        {db.faqs.map((f, i) => (
          <div className="faq-edit" key={f.id}>
            <label className="lbl" htmlFor={'fq' + f.id}>
              Pregunta {i + 1}
            </label>
            <input id={'fq' + f.id} className="field" value={f.q} maxLength={70} onChange={(e) => updateFaq(f.id, { q: e.target.value })} />
            <textarea
              className="field area"
              aria-label={`Respuesta ${i + 1}`}
              value={f.a}
              maxLength={300}
              onChange={(e) => updateFaq(f.id, { a: e.target.value })}
            />
          </div>
        ))}
      </Glass>

      <Glass className="sum">
        <h3>Instalar la aplicación</h3>
        <p className="muted">Se instala como una app más, sin pasar por tiendas.</p>
        <InstallButton className="primary" />
      </Glass>

      <Glass className="sum">
        <h3>Datos de prueba</h3>
        <div className="actions two">
          <Btn
            kind="ghost"
            onClick={() =>
              ask({
                title: '¿Cargar pedidos de ejemplo?',
                text: 'Se agregan 3 clientes y 3 pedidos falsos para que vea cómo se ve el panel.',
                yes: 'Cargar',
                no: 'No',
                onYes: () => {
                  seedExamples();
                  toast('Ejemplos cargados');
                  go('a-orders');
                },
              })
            }
          >
            Cargar ejemplos
          </Btn>
          <Btn
            kind="ghost"
            onClick={() =>
              ask({
                title: '¿Borrar pedidos y chats?',
                text: 'Se borran todos los pedidos, clientes y mensajes de este dispositivo. Productos y días se conservan.',
                yes: 'Sí, borrar todo',
                no: 'No',
                danger: true,
                onYes: () => {
                  wipeOrders();
                  toast('Datos borrados');
                },
              })
            }
          >
            Borrar pedidos
          </Btn>
        </div>
      </Glass>

      <div className="cta">
        <Btn
          kind="ghost"
          block
          onClick={exitOwner}
        >
          Salir del panel
        </Btn>
      </div>
    </section>
  );
}
