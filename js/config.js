/* =========================================================
   BADCAKE — CONFIGURACIÓN
   Este es el ÚNICO archivo que necesitas tocar para conectar
   la base de datos en la nube. Lee LEEME.md para los pasos.
   ========================================================= */
window.BADCAKE_CONFIG = {

  /* ---------- Base de datos en la nube (Supabase) ----------
     Déjalo vacío para usar el MODO LOCAL (los datos se guardan
     dentro del navegador de esta computadora; ideal para probar).
     Cuando subas la página a internet, pega aquí los datos de tu
     proyecto de Supabase para que los clientes vean tus camisas. */
  supabaseUrl: '',
  supabaseAnonKey: '',
  bucket: 'camisas',

  /* ---------- Contraseña del panel (solo MODO LOCAL) ----------
     En modo nube se entra con el correo y contraseña del usuario
     que crees en Supabase (mucho más seguro). */
  claveLocal: 'badcake2026',

  /* ---------- Tallas disponibles en el panel ---------- */
  tallas: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],

  /* ---------- Ajustes por defecto ----------
     Se pueden cambiar luego desde el panel → Ajustes. */
  ajustesPorDefecto: {
    whatsapp: '',
    instagram: '',
    tiktok: '',
    email: '',
    moneda: 'RD$',
    anuncio: 'Envíos a todo el país',
    manifiesto: 'Somos buena gente con malas ideas. Hacemos camisas para los que piensan raro, se ríen fuerte y no piden permiso. Sin colores, sin excusas: solo blanco, negro y actitud.',
    fotosBN: true
  }
};
