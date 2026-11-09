/*
  ALMACÉN DE DATOS (conectado al servidor)
  ----------------------------------------
  Los datos viven en Cloudflare (D1, a través de /api). Cada celular o PC los pide y los
  envía al servidor, así el pedido de un cliente llega al panel del dueño y viceversa.
  Si no hay internet, se muestra lo último guardado y los cambios se envían al volver la conexión.
*/
import { useSyncExternalStore } from 'react';
import { uid, dkey, addDays, todayKey, ST, botText } from './util.js';

const KEY = 'tp_db_v1';
const SKEY = 'tp_session_v1';
const API = '/api';
const POLL_MS = 3000;

const ls = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* sin almacenamiento */
    }
  },
};

function defaults() {
  const days = {};
  const t = new Date();
  for (let i = 1; i < 28; i++) {
    const d = addDays(t, i);
    const w = d.getDay();
    if (w >= 1 && w <= 5) days[dkey(d)] = true; // lunes a viernes, desde mañana
  }
  return {
    v: 1,
    seq: 0,
    settings: {
      ownerName: 'Atención',
      ownerPhone: '',
      pin: '1234',
      hours: 'Entregamos entre las 9:00 a. m. y las 5:00 p. m.',
    },
    products: [
      { id: 'p1', emoji: '🛍️', img: '', name: 'Producto 1', desc: 'Escriba aquí qué incluye', price: 10000, on: true },
      { id: 'p2', emoji: '🧺', img: '', name: 'Producto 2', desc: 'Escriba aquí qué incluye', price: 20000, on: true },
      { id: 'p3', emoji: '🎁', img: '', name: 'Producto 3', desc: 'Escriba aquí qué incluye', price: 35000, on: true },
    ],
    days,
    customers: {},
    orders: [],
    messages: [],
    faqs: [
      { id: 'f1', q: '¿Qué días entregan?', a: '{dias} Usted escoge el día al hacer su pedido.' },
      { id: 'f2', q: '¿A qué hora llega mi pedido?', a: '{horario} Cuando salga hacia su casa le avisamos aquí y en «Mi pedido» verá «Ya va para allá».' },
      { id: 'f3', q: '¿Cómo puedo pagar?', a: 'El pago se hace cuando recibe su pedido. El valor total lo ve en «Mi pedido».' },
      { id: 'f4', q: '¿Cómo sé por dónde va mi pedido?', a: 'Toque «Mi pedido» abajo. Allí ve en qué paso está: recibido, preparando, ya va para allá o ya llegó.' },
      { id: 'f5', q: '¿Puedo cambiar o cancelar mi pedido?', a: 'Puede cancelarlo usted mismo en «Mi pedido» mientras diga «Recibido». Si ya lo estamos preparando, escríbanos aquí y lo revisamos.' },
      { id: 'f6', q: '¿Cómo los contacto?', a: 'Escríbanos aquí en el chat y le respondemos lo antes posible. {telefono}' },
    ],
  };
}

const withFaqs = (x) => {
  if (x && x.v === 1) {
    if (!x.faqs) x.faqs = defaults().faqs;
    if (x.products) x.products.forEach((p) => p.img === undefined && (p.img = ''));
    return x;
  }
  return null;
};
const cached = () => {
  try {
    return withFaqs(JSON.parse(ls.get(KEY)));
  } catch {
    return null;
  }
};

const FIRST = cached();
let SERVER = FIRST || defaults(); // última copia confirmada por el servidor
let LOADED = !!FIRST; // ya hay datos reales (del servidor o de la última visita)
let OFFLINE = false; // la última lectura al servidor falló
let LASTERR = 0; // código de error de esa lectura (0 = sin conexión)
let SERVER_VER = -1; // -1 = todavía no se ha leído el servidor
let READY = false;
let DB = SERVER; // lo que ve la pantalla (servidor + cambios pendientes)
let SESSION = { role: null, me: '', fs: 0 };
try {
  SESSION = { ...SESSION, ...JSON.parse(ls.get(SKEY)) };
} catch {
  /* primera vez */
}

const dbL = new Set();
const seL = new Set();
const toL = new Set();
const pending = []; // cambios que todavía no llegan al servidor
let flushing = false;
let idSeed = null;
let idN = 0;
// ids estables: al re-aplicar un cambio sobre datos nuevos, genera los mismos ids
const nid = () => (idSeed ? `${idSeed}_${(idN++).toString(36)}` : uid());

const emit = () => dbL.forEach((f) => f());
const cacheSave = () => ls.set(KEY, JSON.stringify(SERVER));

function applyEntry(n, e) {
  idSeed = e.seed;
  idN = 0;
  try {
    e.fn(n);
  } finally {
    idSeed = null;
  }
}
function rebuild() {
  const n = structuredClone(SERVER);
  pending.forEach((e) => applyEntry(n, e));
  DB = n;
}

export const getDB = () => DB;
export const getSession = () => SESSION;

export function mutate(fn) {
  pending.push({ fn, seed: uid() });
  rebuild();
  emit();
  flush();
}
export function setSession(p) {
  SESSION = { ...SESSION, ...p };
  ls.set(SKEY, JSON.stringify(SESSION));
  seL.forEach((f) => f());
}

const sub = (set) => (f) => {
  set.add(f);
  return () => set.delete(f);
};
export const useDB = () => useSyncExternalStore(sub(dbL), () => DB);
/* estado de la conexión: loaded = ya hay datos · offline = no se pudo hablar con el servidor · err = código */
const syncKey = () => `${LOADED ? 1 : 0}|${OFFLINE ? 1 : 0}|${LASTERR}|${pending.length}`;
export function useSync() {
  const k = useSyncExternalStore(sub(dbL), syncKey);
  const [l, o, e, n] = k.split('|');
  return { loaded: l === '1', offline: o === '1', err: Number(e), pending: Number(n) };
}
export const useSession = () => useSyncExternalStore(sub(seL), () => SESSION);

/* ---------- envío y lectura del servidor ---------- */
async function flush() {
  if (flushing || !READY) return;
  flushing = true;
  try {
    while (pending.length) {
      const batch = pending.slice();
      const base = structuredClone(SERVER);
      batch.forEach((e) => applyEntry(base, e));
      const r = await fetch(`${API}/state`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ver: SERVER_VER, data: base }),
      });
      const j = await r.json().catch(() => null);
      if (r.status === 409 && j) {
        // alguien cambió los datos al mismo tiempo: tomamos la copia nueva y volvemos a aplicar lo nuestro
        SERVER = j.data || defaults();
        SERVER_VER = j.ver;
        cacheSave();
        rebuild();
        emit();
        continue;
      }
      if (!r.ok || !j) throw new Error('guardar');
      SERVER = base;
      SERVER_VER = j.ver;
      pending.splice(0, batch.length);
      cacheSave();
      rebuild();
      emit();
    }
  } catch {
    /* sin conexión: se reintenta en la próxima lectura */
  } finally {
    flushing = false;
  }
}

/* ---------- avisos (toast) ---------- */
let TOAST = { id: 0, text: '' };
export const toast = (text) => {
  TOAST = { id: TOAST.id + 1, text };
  toL.forEach((f) => f());
};
export const useToast = () => useSyncExternalStore(sub(toL), () => TOAST);
export const viewHint = { route: '', sel: '' }; // lo actualiza App para no avisar de lo que ya se está viendo

/* ---------- cambios que llegan de otro dispositivo ---------- */
const buzz = () => navigator.vibrate && navigator.vibrate([120, 60, 120]);
const first = (n) => (n || '').split(' ')[0];

function notifyDiff(a, b) {
  const { role, me } = SESSION;
  const knownMsgs = new Set(a.messages.map((m) => m.id));
  if (role === 'owner') {
    const known = new Set(a.orders.map((o) => o.id));
    const fresh = b.orders.filter((o) => !known.has(o.id));
    if (fresh.length) {
      const c = b.customers[fresh[0].cid];
      toast(`🛍️ ¡Nuevo pedido${c ? ' de ' + first(c.name) : ''}!`);
      buzz();
      return;
    }
    const nm = b.messages.filter((m) => !knownMsgs.has(m.id) && m.from === 'cliente' && !m.auto);
    if (nm.length && !(viewHint.route === 'a-chat' && viewHint.sel === nm[0].cid)) {
      const c = b.customers[nm[0].cid];
      toast(`💬 ${c ? first(c.name) : 'Cliente'}: ${nm[0].text.slice(0, 60)}`);
      buzz();
    }
  } else if (me) {
    for (const o of b.orders.filter((x) => x.cid === me)) {
      const p = a.orders.find((x) => x.id === o.id);
      if (!p) continue;
      if (p.status !== o.status) {
        toast(`${ST[o.status].emoji} ${ST[o.status].cust}`);
        buzz();
        return;
      }
      if (!p.delay && o.delay) {
        toast('⏳ Su pedido se va a demorar un poco');
        buzz();
        return;
      }
    }
    const nm = b.messages.filter((m) => !knownMsgs.has(m.id) && m.cid === me && m.from === 'dueno');
    if (nm.length && viewHint.route !== 'chat') {
      toast('💬 Tiene un mensaje nuevo');
      buzz();
    }
  }
}

async function pull() {
  try {
    const r = await fetch(`${API}/state?ver=${SERVER_VER}`, { cache: 'no-store' });
    if (!r.ok) {
      LASTERR = r.status;
      throw new Error('leer');
    }
    const j = await r.json();
    READY = true;
    const changedState = OFFLINE || !LOADED;
    OFFLINE = false;
    LASTERR = 0;
    LOADED = true;
    if (j.changed) {
      const first = SERVER_VER < 0;
      const prev = DB;
      SERVER = j.data || defaults();
      SERVER_VER = j.ver;
      cacheSave();
      rebuild();
      if (!first) notifyDiff(prev, DB);
      emit();
    } else if (changedState) emit();
  } catch {
    /* sin conexión: se muestra lo último guardado */
    if (!OFFLINE) {
      OFFLINE = true;
      emit();
    }
  }
  flush();
}
export const retry = () => pull();

if (typeof window !== 'undefined') {
  pull();
  setInterval(pull, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) pull();
  });
  addEventListener('online', pull);
}

/* ---------- fotos de productos ---------- */
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 720 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * s);
      c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagen'));
    };
    im.src = url;
  });
}
export async function uploadImage(file) {
  const data = await shrink(file);
  const id = uid();
  const r = await fetch(`${API}/img/${id}`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: data });
  if (!r.ok) throw new Error('subir');
  return id;
}
export const imgSrc = (id) => (id ? `${API}/img/${id}` : '');

/* ---------- acciones: clientes ---------- */
export function saveCustomer(data) {
  const { me } = SESSION;
  const exists = !!getDB().customers[me];
  const id = exists ? me : uid();
  mutate((d) => {
    d.customers[id] = { ...(d.customers[id] || { id, at: Date.now() }), ...data, id };
    if (!exists) {
      d.messages.push({
        id: nid(),
        cid: id,
        from: 'dueno',
        text: `¡Hola ${first(data.name)}! Cualquier duda con su pedido me escribe por aquí.`,
        at: Date.now(),
        read: false,
      });
    }
  });
  setSession({ me: id, role: null });
  return id;
}

export function createOrder({ cid, items, total, day }) {
  const id = uid();
  mutate((d) => {
    d.seq += 1;
    d.orders.push({ id, n: d.seq, cid, items, total, day, status: 'nuevo', delay: null, at: Date.now() });
  });
  return id;
}

/* ---------- acciones: pedidos (dueño) ---------- */
export const setStatus = (id, status) =>
  mutate((d) => {
    const o = d.orders.find((x) => x.id === id);
    if (o) {
      o.status = status;
      o.delay = null;
    }
  });

export const setDelay = (id, min, msg) =>
  mutate((d) => {
    const o = d.orders.find((x) => x.id === id);
    if (!o) return;
    o.delay = { min, msg, at: Date.now() };
    d.messages.push({
      id: nid(),
      cid: o.cid,
      from: 'dueno',
      text: `⏳ Su pedido se va a demorar unos ${min} minutos más.${msg ? ' ' + msg : ''}`,
      at: Date.now(),
      read: false,
    });
  });

export const clearDelay = (id) =>
  mutate((d) => {
    const o = d.orders.find((x) => x.id === id);
    if (o) o.delay = null;
  });

/* ---------- acciones: chat ---------- */
export function sendMessage(cid, from, text) {
  const t = String(text || '').trim().slice(0, 500);
  if (!t) return;
  mutate((d) => {
    d.messages.push({ id: nid(), cid, from, text: t, at: Date.now(), read: false });
  });
}
export function markRead(cid, from) {
  if (!getDB().messages.some((m) => m.cid === cid && m.from === from && !m.read)) return;
  mutate((d) => {
    d.messages.forEach((m) => {
      if (m.cid === cid && m.from === from) m.read = true;
    });
  });
}

/* El cliente toca una pregunta frecuente: se guardan su pregunta y la respuesta automática (sin avisar al dueño) */
export function askBot(cid, faq) {
  const answer = botText(getDB(), faq.a);
  mutate((d) => {
    const now = Date.now();
    d.messages.push({ id: nid(), cid, from: 'cliente', text: faq.q, at: now, read: true, auto: true });
    d.messages.push({ id: nid(), cid, from: 'bot', text: answer, at: now + 1, read: true, auto: true });
  });
}
export const updateFaq = (id, patch) =>
  mutate((d) => {
    const f = d.faqs.find((x) => x.id === id);
    if (f) Object.assign(f, patch);
  });

/* ---------- acciones: panel del dueño ---------- */
export const setDays = (keys, val) =>
  mutate((d) => {
    keys.forEach((k) => {
      d.days[k] = val;
    });
  });
export const updateProduct = (id, patch) =>
  mutate((d) => {
    const p = d.products.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
  });
export const updateSettings = (patch) =>
  mutate((d) => {
    Object.assign(d.settings, patch);
  });

export function wipeOrders() {
  mutate((d) => {
    d.orders = [];
    d.messages = [];
    d.customers = {};
    d.seq = 0;
  });
  setSession({ me: '' });
}

export function seedExamples() {
  mutate((d) => {
    const t = todayKey();
    const tm = dkey(addDays(new Date(), 1));
    const mk = (name, phone, address) => {
      const id = nid();
      d.customers[id] = { id, name, phone, address, at: Date.now() };
      return id;
    };
    const a = mk('María Gómez', '3001112233', 'Carrera 5 #10-20, barrio Granada');
    const b = mk('Carlos Ruiz', '3104445566', 'Calle 9 #3-45, barrio San Fernando');
    const c = mk('Luz Marina Pérez', '3157778899', 'Avenida 6N #20-15, Versalles');
    const P = d.products;
    const it = (p, q) => ({ pid: p.id, qty: q, name: p.name, emoji: p.emoji, price: p.price });
    const order = (cid, items, day, status, delay = null) => {
      d.seq += 1;
      d.orders.push({
        id: nid(),
        n: d.seq,
        cid,
        items,
        total: items.reduce((s, i) => s + i.price * i.qty, 0),
        day,
        status,
        delay,
        at: Date.now() - d.seq * 600000,
      });
    };
    order(a, [it(P[0], 2)], tm, 'nuevo');
    order(b, [it(P[1], 1), it(P[2], 1)], t, 'camino', { min: 15, msg: 'Hay mucho tráfico.', at: Date.now() });
    order(c, [it(P[0], 1)], t, 'preparando');
    const msg = (cid, from, text, ago) =>
      d.messages.push({ id: nid(), cid, from, text, at: Date.now() - ago * 60000, read: from === 'dueno' });
    msg(a, 'cliente', 'Buenas noches, ¿me puede traer el pedido temprano?', 12);
    msg(b, 'cliente', '¿Ya viene mi pedido?', 4);
  });
}
