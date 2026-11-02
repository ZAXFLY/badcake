# BADCAKE — *good people, bad ideas*

Sitio web oficial y catálogo exclusivo de camisas para **BADCAKE**, diseñado en **blanco y negro puro** con dos páginas conectadas a una misma base de datos:

1. **`index.html` — Catálogo para clientes**
   - Pantalla de carga editorial con el logo globo de BADCAKE.
   - Hero interactivo dividido en diagonal blanco/negro con mezcla óptica (`mix-blend-mode: difference`), anillo giratorio y logo con perspectiva 3D.
   - Cintas cruzadas reactivas a la velocidad del scroll.
   - Carrusel arrastrable de camisas destacadas (*“Lo más malo”*).
   - Catálogo de camisas con efecto de segunda foto al pasar el mouse (frente/espalda), filtros por colección, filtro por talla, buscador y ordenamiento.
   - Ficha completa de cada camisa con galería, selector de tallas, botón de compartir enlace directo (`#camisa-...`), bolsa de compras persistente y envío automático del pedido formateado a **WhatsApp**.
   - Manifiesto interactivo que se ilumina palabra por palabra al hacer scroll.

2. **`admin.html` — Panel privado del dueño**
   - Inicio de sesión protegido por contraseña.
   - Alta, edición, duplicado y eliminación de camisas.
   - Subida múltiple de fotos (arrastrar, clic o pegar con `Ctrl+V`) con compresión automática, elección de portada y reordenamiento.
   - Botones rápidos en cada prenda para marcar como **Visible / Oculta**, **★ Destacada** o **Agotada** en un clic (se actualiza en vivo en la tienda).
   - Pestaña **Ajustes** para configurar número de WhatsApp de pedidos, Instagram, TikTok, correo, moneda (`RD$`, `USD$`, `$`, etc.), anuncio de la cinta y texto del manifiesto.
   - Pestaña **Datos** para descargar copias de respaldo (`.json`), restaurarlas, cargar ejemplos o vaciar el catálogo.

---

## Cómo abrir la página en tu computadora

Tienes **dos formas** (ambas funcionan de inmediato sin instalar Node ni Python):

- **Opción A (Recomendada):** Haz doble clic en **`iniciar-tienda.bat`**. Abrirá automáticamente un servidor local en `http://localhost:8080/index.html`.
- **Opción B (Directa):** Haz doble clic directamente sobre **`index.html`** (tienda) o **`admin.html`** (panel del dueño) para abrirlos en Chrome o Edge.

### Contraseña del panel del dueño (`admin.html`)
- **Contraseña por defecto:** `badcake2026`
- Puedes cambiarla editando `claveLocal` dentro de `js/config.js`.

---

## Base de datos: Interna (Local) + Nube (Opcional)

El sistema incluye un motor dual en `js/db.js`:

1. **Base de datos interna (`IndexedDB`) — Activa por defecto:**
   - No requiere internet ni servidores externos.
   - Guarda todas tus camisas, fotos optimizadas y ajustes directamente dentro del programa/navegador.
   - Incluye sincronización en tiempo real entre `admin.html` e `index.html` y exportación/importación de respaldos JSON.

2. **Base de datos en la nube (`Supabase`) — Lista para cuando subas la web a internet:**
   - Si publicas la página en Netlify, Vercel o GitHub Pages para que tus clientes entren desde sus celulares, crea un proyecto gratuito en [supabase.com](https://supabase.com):
     1. Ve a **SQL Editor** en Supabase, pega el contenido de `supabase.sql` y ejecútalo.
     2. En **Authentication → Users**, crea tu usuario (correo y contraseña de dueño).
     3. En **Project Settings → API**, copia tu `Project URL` y tu `anon public key` y pégalos en `js/config.js` (`supabaseUrl` y `supabaseAnonKey`).
   - ¡Listo! Automáticamente el panel cambiará a **Modo Nube** sin tocar una sola línea más de código.

---

## Tipografías oficiales de la marca

- **Logo globo (`Histea Ballon`)** y **título (`Intro Rust`)**: Extraídos en alta definición transparente en blanco y negro desde tu hoja de marca (`assets/img/`).
- **Eslogan (`Amita`)**: Cargada directamente desde Google Fonts (`Amita`) + versiones curvas originales extraídas en `assets/img/`.
- **Títulos dinámicos**: Usa `Intro Rust` si está instalada o si colocas `IntroRust.woff2` / `IntroRust.otf` dentro de `assets/fonts/`, con respaldo geométrico `Rubik Black` ajustado al mismo peso visual.
