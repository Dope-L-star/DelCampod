/*
  SERVIDOR de Del Campo (Cloudflare Pages Functions, modo _worker.js)
  Guarda los datos en Cloudflare D1 (base de datos) con el nombre de enlace «DB».
  Rutas:
    GET  /api/state?ver=N   -> datos si cambiaron desde la versión N
    PUT  /api/state         -> guarda los datos (rechaza con 409 si alguien guardó antes)
    PUT  /api/img/:id       -> guarda una foto (data URL)
    GET  /api/img/:id       -> devuelve la foto
  Todo lo demás lo sirve la propia página (env.ASSETS).
*/
const CHUNK = 30000; // caracteres por fila (D1 limita el tamaño de cada valor)
const MAX_IMG = 900000;
let ready = null;

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const chunks = (s) => {
  const out = [];
  for (let i = 0; i < s.length; i += CHUNK) out.push(s.slice(i, i + CHUNK));
  return out;
};

function init(env) {
  if (!ready) {
    ready = env.DB.batch([
      env.DB.prepare('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id = 1), ver INTEGER NOT NULL, token TEXT)'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS app_chunks (token TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (token, idx))'),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS app_images (id TEXT NOT NULL, idx INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (id, idx))'),
      env.DB.prepare('INSERT OR IGNORE INTO app_state (id, ver, token) VALUES (1, 0, NULL)'),
    ]).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

async function getState(env, ver) {
  const st = await env.DB.prepare('SELECT ver, token FROM app_state WHERE id = 1').first();
  if (String(st.ver) === String(ver)) return json({ ver: st.ver, changed: false });
  if (!st.token) return json({ ver: st.ver, changed: true, data: null });
  const rs = await env.DB.prepare('SELECT data FROM app_chunks WHERE token = ? ORDER BY idx').bind(st.token).all();
  const text = rs.results.map((r) => r.data).join('');
  return json({ ver: st.ver, changed: true, data: JSON.parse(text) });
}

async function conflict(env) {
  const r = await getState(env, -1);
  return json(await r.json(), 409);
}

async function putState(env, req) {
  const body = await req.json();
  const expect = Number(body.ver);
  const cur = await env.DB.prepare('SELECT ver, token FROM app_state WHERE id = 1').first();
  if (cur.ver !== expect) return conflict(env);
  const token = crypto.randomUUID();
  const parts = chunks(JSON.stringify(body.data));
  await env.DB.batch(
    parts.map((d, idx) => env.DB.prepare('INSERT INTO app_chunks (token, idx, data) VALUES (?, ?, ?)').bind(token, idx, d)),
  );
  const r = await env.DB.prepare('UPDATE app_state SET ver = ver + 1, token = ? WHERE id = 1 AND ver = ?')
    .bind(token, expect)
    .run();
  if (!r.meta || r.meta.changes !== 1) {
    await env.DB.prepare('DELETE FROM app_chunks WHERE token = ?').bind(token).run();
    return conflict(env);
  }
  if (cur.token) await env.DB.prepare('DELETE FROM app_chunks WHERE token = ?').bind(cur.token).run();
  return json({ ver: expect + 1 });
}

async function putImage(env, id, req) {
  const text = await req.text();
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(text) || text.length > MAX_IMG) return json({ error: 'imagen' }, 400);
  await env.DB.prepare('DELETE FROM app_images WHERE id = ?').bind(id).run();
  await env.DB.batch(
    chunks(text).map((d, idx) => env.DB.prepare('INSERT INTO app_images (id, idx, data) VALUES (?, ?, ?)').bind(id, idx, d)),
  );
  return json({ ok: true });
}

async function getImage(env, id) {
  const rs = await env.DB.prepare('SELECT data FROM app_images WHERE id = ? ORDER BY idx').bind(id).all();
  if (!rs.results.length) return new Response('No encontrado', { status: 404 });
  const m = rs.results.map((r) => r.data).join('').match(/^data:(image\/[a-z]+);base64,(.*)$/);
  if (!m) return new Response('No encontrado', { status: 404 });
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable' } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // el código fuente y las notas viajan en el zip, pero no se muestran en internet
    if (/^\/(codigo-fuente|LEEME)/i.test(url.pathname)) return new Response('No encontrado', { status: 404 });
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      await init(env);
      if (url.pathname === '/api/state') {
        if (request.method === 'GET') return await getState(env, url.searchParams.get('ver'));
        if (request.method === 'PUT') return await putState(env, request);
      }
      const m = url.pathname.match(/^\/api\/img\/([a-z0-9]{4,40})$/i);
      if (m) {
        if (request.method === 'GET') return await getImage(env, m[1]);
        if (request.method === 'PUT') return await putImage(env, m[1], request);
      }
      return json({ error: 'no encontrado' }, 404);
    } catch (e) {
      return json({ error: 'servidor' }, 500);
    }
  },
};
