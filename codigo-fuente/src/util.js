/* ===== CONFIGURACIÓN (cambie aquí) ===== */
export const APP_NAME = 'Del Campo'; // nombre de la app (también está en index.html y public/manifest.webmanifest)
export const CC = '57'; // indicativo de país (Colombia)

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const money = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const pad = (n) => String(n).padStart(2, '0');
export const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const todayKey = () => dkey(new Date());
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function dayLabel(k) {
  const d = fromKey(k);
  const main = cap(d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }));
  let tag = '';
  if (k === todayKey()) tag = 'Hoy';
  else if (k === dkey(addDays(new Date(), 1))) tag = 'Mañana';
  return { main, tag };
}
export const hm = (ts) => new Date(ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
export const mondayOf = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

export const digits = (s) => String(s || '').replace(/\D/g, '');
export const normPhone = (s) => {
  let d = digits(s);
  if (d.length === 12 && d.startsWith(CC)) d = d.slice(2);
  return d;
};
const intl = (p) => {
  const d = normPhone(p);
  return d.length === 10 ? CC + d : d;
};
export const telHref = (p) => 'tel:+' + intl(p);
export const waHref = (p) => 'https://wa.me/' + intl(p);
export const mapsHref = (a) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a);

export const ST = {
  nuevo: { t: 'Recibido', cust: 'Recibimos su pedido', emoji: '📩' },
  preparando: { t: 'Preparando', cust: 'Estamos preparando su pedido', emoji: '🧑‍🍳' },
  camino: { t: 'Ya va para allá', cust: '¡Su pedido ya va para allá!', emoji: '🛵' },
  llego: { t: 'Ya llegó', cust: '¡Su pedido ya llegó! Por favor salga a recibirlo', emoji: '📍' },
  entregado: { t: 'Entregado', cust: 'Pedido entregado. ¡Muchas gracias!', emoji: '✅' },
  cancelado: { t: 'Cancelado', cust: 'Este pedido fue cancelado', emoji: '✖️' },
};
export const FLOW = ['nuevo', 'preparando', 'camino', 'llego', 'entregado'];
export const DONE = ['entregado', 'cancelado'];
export const itemsText = (o) => o.items.map((i) => `${i.qty}× ${i.name}`).join(', ');

/* Texto de las respuestas automáticas: {dias}, {horario} y {telefono} se llenan solos */
export function botText(db, a) {
  const names = [];
  const t = new Date();
  for (let i = 0; i < 28 && names.length < 3; i++) {
    const k = dkey(addDays(t, i));
    if (db.days[k]) names.push(cap(fromKey(k).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric' })));
  }
  const list = names.length > 1 ? names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1] : names[0];
  const dias = names.length
    ? 'Los próximos días disponibles son: ' + list + '.'
    : 'Por ahora no hay días disponibles; escríbanos y le avisamos apenas haya.';
  const ph = normPhone(db.settings.ownerPhone);
  return String(a || '')
    .replaceAll('{dias}', dias)
    .replaceAll('{horario}', db.settings.hours || '')
    .replaceAll('{telefono}', ph.length === 10 ? 'También puede llamarnos al ' + ph + '.' : '')
    .replace(/\s+/g, ' ')
    .trim();
}
