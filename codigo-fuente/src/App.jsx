import { useCallback, useEffect, useState } from 'react';
import { AppCtx, useApp } from './ctx.js';
import { Icon } from './icons.jsx';
import { Btn, Gate, Mark, Sheet, Toast, cx } from './ui.jsx';
import { setSession, useDB, useSession, useSync, useToast, viewHint } from './store.js';
import { APP_NAME } from './util.js';
import { ClientChat, Confirm, Day, Order, Profile, Register, Track, Welcome } from './client.jsx';
import { AdminChat, Chats, Days, OrderDetail, Orders, Pin, Products, Settings } from './admin.jsx';

const SCREENS = {
  welcome: Welcome,
  register: Register,
  order: Order,
  day: Day,
  confirm: Confirm,
  track: Track,
  chat: ClientChat,
  profile: Profile,
  pin: Pin,
  'a-orders': Orders,
  'a-order': OrderDetail,
  'a-days': Days,
  'a-products': Products,
  'a-chats': Chats,
  'a-chat': AdminChat,
  'a-settings': Settings,
};
const CLIENT_NEEDS_ME = ['order', 'day', 'confirm', 'track', 'chat', 'profile'];
const FS = [1, 1.15, 1.3];

function ConfirmSheet({ o, close }) {
  return (
    <>
      <h3>{o.title}</h3>
      {o.text && <p className="muted">{o.text}</p>}
      <div className="cta">
        <Btn
          kind={o.danger ? 'danger' : 'primary'}
          block
          onClick={() => {
            close();
            o.onYes();
          }}
        >
          {o.yes || 'Sí'}
        </Btn>
        <Btn kind="ghost" block onClick={close}>
          {o.no || 'No'}
        </Btn>
      </div>
    </>
  );
}

function Tabs({ name }) {
  const { go } = useApp();
  const db = useDB();
  const ses = useSession();
  let T = null;
  if (ses.role === 'owner' && name.startsWith('a-')) {
    const nNew = db.orders.filter((o) => o.status === 'nuevo').length;
    const nMsg = db.messages.filter((m) => m.from === 'cliente' && !m.read).length;
    T = [
      ['a-orders', 'list', 'Pedidos', nNew, ['a-orders', 'a-order']],
      ['a-days', 'calendar', 'Días', 0, ['a-days']],
      ['a-products', 'tag', 'Productos', 0, ['a-products']],
      ['a-chats', 'chat', 'Chats', nMsg, ['a-chats', 'a-chat']],
      ['a-settings', 'sliders', 'Ajustes', 0, ['a-settings']],
    ];
  } else if (ses.role !== 'owner' && db.customers[ses.me] && CLIENT_NEEDS_ME.includes(name)) {
    const unread = db.messages.filter((m) => m.cid === ses.me && m.from === 'dueno' && !m.read).length;
    T = [
      ['order', 'bag', 'Pedir', 0, ['order', 'day', 'confirm']],
      ['track', 'package', 'Mi pedido', 0, ['track', 'profile']],
      ['chat', 'chat', 'Chat', unread, ['chat']],
    ];
  }
  if (!T) return null;
  return (
    <nav className="tabbar" aria-label="Menú principal">
      {T.map(([to, ic, label, badge, set]) => (
        <button key={to} type="button" className="tab" aria-current={set.includes(name) ? 'page' : undefined} onClick={() => go(to)}>
          <Icon n={ic} />
          <span>{label}</span>
          {badge > 0 && <i className="badge">{badge > 9 ? '9+' : badge}</i>}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const db = useDB();
  const ses = useSession();
  const toast = useToast();
  const sync = useSync();
  const [route, setRoute] = useState(() =>
    ses.role === 'owner' ? { name: 'a-orders' } : { name: db.customers[ses.me] ? 'order' : 'welcome' },
  );
  const [cart, setCart] = useState({});
  const [day, setDay] = useState('');
  const [draft, setDraft] = useState({ name: '', phone: '', address: '' });
  const [regStep, setRegStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [backTo, setBackTo] = useState('track');
  const [sheet, setSheet] = useState(null);

  const me = db.customers[ses.me];
  let name = route.name;
  if (ses.role === 'owner') {
    if (!name.startsWith('a-')) name = 'a-orders';
  } else if (name.startsWith('a-')) name = 'welcome';
  else if (CLIENT_NEEDS_ME.includes(name) && !me) name = 'welcome';
  const Screen = SCREENS[name] || Welcome;

  const go = useCallback((n, sel = '') => {
    setRoute({ name: n, sel });
    setSheet(null);
    scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const openSheet = useCallback((node) => setSheet(node), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const ask = useCallback((o) => setSheet(<ConfirmSheet o={o} close={() => setSheet(null)} />), []);
  const startEdit = () => {
    setBackTo(name === 'profile' ? 'track' : name);
    go('profile');
  };
  const exitOwner = () => {
    setSession({ role: null });
    go(me ? 'order' : 'welcome');
  };

  useEffect(() => {
    viewHint.route = name;
    viewHint.sel = route.sel || '';
  }, [name, route.sel]);
  useEffect(() => {
    document.title = APP_NAME;
    document.documentElement.style.setProperty('--fs', FS[ses.fs] || 1);
  }, [ses.fs]);
  useEffect(() => {
    const f = (e) => {
      const c = e.target.closest && e.target.closest('.glass');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', e.clientX - r.left + 'px');
      c.style.setProperty('--my', e.clientY - r.top + 'px');
    };
    addEventListener('pointermove', f, { passive: true });
    return () => removeEventListener('pointermove', f);
  }, []);
  useEffect(() => {
    const f = () => document.documentElement.classList.toggle('scrolled', scrollY > 24);
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, []);

  const ctx = { route: { ...route, name }, go, cart, setCart, day, setDay, draft, setDraft, regStep, setRegStep, editing, setEditing, backTo, openSheet, closeSheet, ask, startEdit, exitOwner };
  const owner = ses.role === 'owner';

  if (!sync.loaded) {
    return (
      <>
        <div className="aurora" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="grain" aria-hidden="true" />
        <Gate sync={sync} />
      </>
    );
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="aurora" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="grain" aria-hidden="true" />
      <header className="bar">
        <div className="in">
          <button
            type="button"
            className="logo"
            onClick={() => go(owner ? 'a-orders' : me ? 'order' : 'welcome')}
            aria-label={`${APP_NAME}, inicio`}
          >
            <Mark />
            <span>{APP_NAME}</span>
            {owner && <em>Dueño</em>}
          </button>
          <div className="hr">
            <button
              type="button"
              className="aa"
              onClick={() => setSession({ fs: (ses.fs + 1) % FS.length })}
              aria-label="Cambiar el tamaño de la letra"
              title="Cambiar el tamaño de la letra"
            >
              <span style={{ fontSize: ['0.9em', '1.05em', '1.25em'][ses.fs] }}>Aa</span>
            </button>
            {!owner && me && (
              <button type="button" className="aa" onClick={startEdit} aria-label="Mi perfil y dirección">
                <Icon n="user" />
                <span className="aa-t">Perfil</span>
              </button>
            )}
            {owner && (
              <button type="button" className="exit" onClick={exitOwner}>
                Salir
              </button>
            )}
          </div>
        </div>
      </header>
      <main className={cx(owner && 'admin')}>
        {sync.offline && (
          <div className="netbar" role="status">
            <span className="nb-dot" aria-hidden="true" />
            Sin internet. Lo que haga se guarda y se envía al volver la señal.
            {sync.pending > 0 && <b> ({sync.pending} por enviar)</b>}
          </div>
        )}
        <div className="screen" key={name}>
          <Screen />
        </div>
      </main>
      <Tabs name={name} />
      <Sheet node={sheet} onClose={closeSheet} />
      <Toast toast={toast} />
    </AppCtx.Provider>
  );
}
