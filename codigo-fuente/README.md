# Del Campo — app de pedidos (React, instalable en celular y PC)

Lo que hace el dueño (precios, productos, fotos, días) lo ven los clientes, y lo que piden los clientes le llega al dueño,
desde cualquier celular o computador. Los datos viven en Cloudflare (base de datos D1).

## Publicar en Cloudflare Pages
1. Entre a dash.cloudflare.com → **Workers y Pages** → **Crear** → **Pages** → **Carga directa (Upload assets)**.
2. Ponga un nombre al proyecto y suba el zip `delcampo-completo.zip` tal cual, sin descomprimir.
3. Cloudflare le da una dirección `https://su-nombre.pages.dev`. Compártala por WhatsApp.

### Conectar la base de datos (una sola vez, es lo que hace que todo se comparta)
1. **Workers y Pages → D1 SQL Database → Crear base de datos** (nombre: `delcampo`).
2. Abra su proyecto de Pages → **Configuración → Enlaces (Bindings) → Agregar → D1 database**.
   - Nombre de la variable: `DB` (exactamente así, en mayúsculas).
   - Base de datos: la que creó en el paso 1.
3. **Implementaciones → Crear nueva implementación** y suba el zip otra vez para que tome el enlace.
Las tablas se crean solas la primera vez que alguien abre la app.

Si la app muestra «La tienda no pudo abrirse» con un código (por ejemplo 500), casi siempre es que falta este enlace `DB`.

## Fotos de los productos
En el panel del dueño → **Productos**, cada producto tiene **Subir foto**. Se achican solas (máx. 720 px) y se guardan en D1.
Si no hay foto, se muestra el emoji.

## Cambiar el nombre
- `src/util.js` → `APP_NAME`
- `index.html` → `<title>` y `apple-mobile-web-app-title`
- `public/manifest.webmanifest` → `name` y `short_name`

## Cambiar colores
Están al comienzo de `src/styles.css` (sección «1 · TOKENS»): `--g1 --g2 --g3 --accent` y los fondos del vidrio.
El gesto firma (los «surcos») está en la sección 23.

## Recompilar el sitio
```
npm install
npm run build      # genera dist/ (esto es lo que se sube a Cloudflare, junto con public/_worker.js que ya queda dentro)
npm run serve      # prueba local de la parte visual (sin base de datos)
```
Cada vez que publique una versión nueva, cambie `VERSION` en `public/sw.js` para que los celulares la tomen.

## Productos, días, clave y respuestas automáticas
Todo se cambia desde la misma app, en el panel del dueño (clave inicial **1234**; cámbiela en Ajustes).

## APK (Android) y programa para Windows
Se hacen DESPUÉS de publicar la app en una dirección https:
1. Entre a **pwabuilder.com**, pegue la dirección `https://su-nombre.pages.dev` y toque «Start».
2. Toque «Package for stores» y elija **Android** (APK/AAB) o **Windows** (MSIX).
Sin APK también se instala: botón «Instalar en mi equipo» de la app, o el icono de instalar de Chrome/Edge.

## Seguridad (léalo)
La clave del dueño se revisa en el celular, no en el servidor. Cualquiera que conozca la dirección `/api/state` puede leer los datos
(incluidos teléfonos y direcciones de clientes). Para datos reales conviene agregar inicio de sesión en el servidor.
