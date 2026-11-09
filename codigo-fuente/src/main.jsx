import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

/* Instalable y con respaldo sin internet (solo funciona en https o localhost) */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
