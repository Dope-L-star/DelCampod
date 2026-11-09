// Compila la app a la carpeta dist/ (lista para subir a cualquier hosting).
// Uso: node build.mjs   (con esbuild instalado)  — o:  npm run build
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await build({
  entryPoints: { app: 'src/main.jsx' },
  bundle: true,
  minify: true,
  outdir: 'dist',
  format: 'iife',
  target: ['es2020', 'chrome90', 'safari15'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.js': 'jsx' },
  legalComments: 'none',
  logLevel: 'info',
});

cpSync('public', 'dist', { recursive: true });
const html = readFileSync('index.html', 'utf8')
  .replace('<!--BUILD:CSS-->', '<link rel="stylesheet" href="app.css">')
  .replace('<!--BUILD:JS-->', '<script src="app.js"></script>');
writeFileSync('dist/index.html', html);
console.log('Listo: dist/');
