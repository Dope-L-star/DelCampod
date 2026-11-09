import { useEffect, useReducer } from 'react';
import { Btn } from './ui.jsx';
import { useApp } from './ctx.js';
import { APP_NAME } from './util.js';

let deferred = null;
const L = new Set();
const ping = () => L.forEach((f) => f());
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  ping();
});
addEventListener('appinstalled', () => {
  deferred = null;
  ping();
});

export const isStandalone = () =>
  (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

function InstallHelp({ close }) {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  return (
    <>
      <h3>Instalar en su {ios || android ? 'celular' : 'computador'}</h3>
      {ios ? (
        <ol className="how-list">
          <li>Abra esta página en <b>Safari</b>.</li>
          <li>Toque el botón <b>Compartir</b> (el cuadro con una flecha hacia arriba).</li>
          <li>Busque y toque <b>«Añadir a pantalla de inicio»</b>.</li>
          <li>Toque <b>Añadir</b>. ¡Listo! Verá el icono junto a sus otras aplicaciones.</li>
        </ol>
      ) : android ? (
        <ol className="how-list">
          <li>Toque los <b>tres puntos ⋮</b> arriba a la derecha del navegador.</li>
          <li>Toque <b>«Instalar aplicación»</b> o «Añadir a pantalla de inicio».</li>
          <li>Confirme con <b>Instalar</b>. ¡Listo!</li>
        </ol>
      ) : (
        <ol className="how-list">
          <li>En Chrome o Edge busque el icono de <b>instalar</b> al final de la barra de direcciones.</li>
          <li>También sirve el menú ⋮ → <b>«Instalar {APP_NAME}»</b>.</li>
        </ol>
      )}
      <Btn kind="primary" block onClick={close}>
        Entendido
      </Btn>
    </>
  );
}

export function InstallButton({ className = 'ghost' }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const { openSheet, closeSheet } = useApp();
  useEffect(() => {
    L.add(force);
    return () => L.delete(force);
  }, []);
  if (isStandalone()) return null;
  const click = async () => {
    if (deferred) {
      deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        /* nada */
      }
      deferred = null;
      ping();
    } else {
      openSheet(<InstallHelp close={closeSheet} />);
    }
  };
  return (
    <Btn kind={className} block icon="download" onClick={click}>
      Instalar en mi {/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'celular' : 'equipo'}
    </Btn>
  );
}
