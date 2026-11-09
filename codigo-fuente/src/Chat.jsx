import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { markRead, sendMessage, useDB } from './store.js';
import { hm } from './util.js';
import { cx } from './ui.jsx';

/* Chat compartido: viewer = 'cliente' o 'dueno' */
export default function Chat({ cid, viewer, quick, top }) {
  const db = useDB();
  const msgs = db.messages.filter((m) => m.cid === cid).sort((a, b) => a.at - b.at);
  const other = viewer === 'cliente' ? 'dueno' : 'cliente';
  const [text, setText] = useState('');
  const first = useRef(true);

  useEffect(() => {
    markRead(cid, other);
  }, [cid, other, msgs.length]);

  useEffect(() => {
    scrollTo({ top: document.documentElement.scrollHeight, behavior: first.current ? 'instant' : 'smooth' });
    first.current = false;
  }, [msgs.length]);

  useEffect(() => () => document.body.classList.remove('typing'), []);

  const send = (t) => {
    sendMessage(cid, viewer, t ?? text);
    setText('');
  };

  return (
    <div className="chat">
      <div className="msgs" aria-live="polite">
        {msgs.length === 0 && <p className="empty-note">Aún no hay mensajes. Escriba el primero 👇</p>}
        {msgs.map((m) => (
          <div key={m.id} className={cx('b', m.from === 'bot' ? 'bot' : m.from === viewer ? 'me' : 'them')}>
            {m.from === 'bot' && <span className="who">🤖 Respuesta automática</span>}
            {m.text}
            <small>{hm(m.at)}</small>
          </div>
        ))}
      </div>
      <div className="composer-wrap">
        {top}
        <div className="quick" aria-label="Respuestas rápidas">
          {quick.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="composer glass"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            className="chat-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => document.body.classList.add('typing')}
            onBlur={() => document.body.classList.remove('typing')}
            placeholder="Escriba su mensaje"
            aria-label="Mensaje"
            maxLength={500}
            enterKeyHint="send"
            autoComplete="off"
          />
          <button type="submit" className="send" aria-label="Enviar mensaje">
            <Icon n="send" />
          </button>
        </form>
      </div>
    </div>
  );
}
