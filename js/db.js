/* =========================================================
   BADCAKE — capa de datos
   Una sola API (window.BCDB) con dos motores:
     · LOCAL : IndexedDB dentro del navegador (sin configurar nada)
     · NUBE  : Supabase (Postgres + Storage + Auth)
   El resto de la página no sabe cuál se está usando.
   ========================================================= */
(function () {
  'use strict';

  const CFG = window.BADCAKE_CONFIG || {};
  const USAR_NUBE = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey);
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  /* ---------- Utilidades ---------- */
  const nuevoId = () =>
    (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'bc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const esUUID = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

  /** Normaliza una camisa para que siempre tenga todos los campos. */
  function normalizar(c) {
    return {
      id: c.id || null,
      nombre: String(c.nombre || '').trim(),
      descripcion: String(c.descripcion || '').trim(),
      precio: Number(c.precio) || 0,
      precio_anterior: c.precio_anterior ? Number(c.precio_anterior) : null,
      coleccion: String(c.coleccion || '').trim(),
      color: String(c.color || '').trim(),
      tallas: Array.isArray(c.tallas) ? c.tallas : [],
      imagenes: Array.isArray(c.imagenes) ? c.imagenes : [],
      destacado: Boolean(c.destacado),
      agotado: Boolean(c.agotado),
      visible: c.visible === undefined ? true : Boolean(c.visible),
      creado: c.creado || new Date().toISOString()
    };
  }

  const ordenar = (lista) =>
    lista.sort((a, b) => new Date(b.creado) - new Date(a.creado));

  /** Reduce y comprime una imagen antes de guardarla (ahorra espacio). */
  function comprimirImagen(archivo, max = 1400, calidad = 0.86) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Formato de imagen no válido'));
        img.onload = () => {
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * escala);
          const h = Math.round(img.height * escala);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => {
            if (blob && blob.type === 'image/webp') return resolve(blob);
            // Safari no exporta WebP: usamos JPEG
            canvas.toBlob((jpg) => jpg ? resolve(jpg) : reject(new Error('No se pudo comprimir')), 'image/jpeg', calidad);
          }, 'image/webp', calidad);
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  const blobADataURL = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  /* =======================================================
     MOTOR LOCAL — IndexedDB
     ======================================================= */
  const Local = {
    modo: 'local',
    _db: null,

    async init() {
      if (this._db) return;
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('badcake', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('camisas')) db.createObjectStore('camisas', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('ajustes')) db.createObjectStore('ajustes', { keyPath: 'clave' });
        };
        req.onsuccess = () => { this._db = req.result; resolve(); };
        req.onerror = () => reject(req.error);
      });
      // Si es la primera vez que se abre la tienda en este navegador, sembrar catálogo inicial
      if (Array.isArray(window.BADCAKE_EJEMPLOS) && window.BADCAKE_EJEMPLOS.length) {
        const marca = await this._tx('ajustes', 'readonly', (os) => this._req(os.get('semilla_inicial')));
        if (!marca) {
          const actuales = await this._tx('camisas', 'readonly', (os) => this._req(os.count()));
          if (!actuales) {
            await this._tx('camisas', 'readwrite', (os) => {
              window.BADCAKE_EJEMPLOS.forEach((c) => os.put(normalizar(c)));
            });
          }
          await this._tx('ajustes', 'readwrite', (os) => os.put({ clave: 'semilla_inicial', valor: true }));
        }
      }
    },

    _tx(store, modo, accion) {
      return new Promise((resolve, reject) => {
        const tx = this._db.transaction(store, modo);
        const os = tx.objectStore(store);
        let resultado;
        Promise.resolve(accion(os)).then((r) => { resultado = r; });
        tx.oncomplete = () => resolve(resultado);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transacción cancelada (¿espacio lleno?)'));
      });
    },

    _req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },

    async listar({ incluirOcultas = false } = {}) {
      const todas = await this._tx('camisas', 'readonly', (os) => this._req(os.getAll()));
      const lista = (todas || []).map(normalizar);
      return ordenar(incluirOcultas ? lista : lista.filter((c) => c.visible));
    },

    async obtener(id) {
      const c = await this._tx('camisas', 'readonly', (os) => this._req(os.get(id)));
      return c ? normalizar(c) : null;
    },

    async guardar(camisa) {
      const c = normalizar(camisa);
      if (!c.id) c.id = nuevoId();
      await this._tx('camisas', 'readwrite', (os) => this._req(os.put(c)));
      return c;
    },

    async eliminar(id) {
      await this._tx('camisas', 'readwrite', (os) => this._req(os.delete(id)));
    },

    async subirImagen(archivo) {
      const blob = await comprimirImagen(archivo, 1200, 0.82);
      return blobADataURL(blob);
    },

    async borrarImagen() { /* en local la imagen vive dentro de la camisa */ },

    async ajustes() {
      const filas = await this._tx('ajustes', 'readonly', (os) => this._req(os.getAll()));
      const obj = { ...(CFG.ajustesPorDefecto || {}) };
      (filas || []).forEach((f) => { obj[f.clave] = f.valor; });
      return obj;
    },

    async guardarAjustes(obj) {
      await this._tx('ajustes', 'readwrite', (os) => {
        Object.entries(obj).forEach(([clave, valor]) => os.put({ clave, valor }));
      });
    },

    _sesionMem: false,
    async login(_email, clave) {
      if (String(clave) !== String(CFG.claveLocal || 'badcake2026')) throw new Error('Contraseña incorrecta');
      this._sesionMem = true;
      try { sessionStorage.setItem('bc_admin', '1'); } catch (_) {}
    },
    async logout() {
      this._sesionMem = false;
      try { sessionStorage.removeItem('bc_admin'); } catch (_) {}
    },
    async sesion() {
      try { return this._sesionMem || sessionStorage.getItem('bc_admin') === '1'; }
      catch (_) { return this._sesionMem; }
    }
  };

  /* =======================================================
     MOTOR NUBE — Supabase
     ======================================================= */
  const Nube = {
    modo: 'nube',
    sb: null,

    async init() {
      if (this.sb) return;
      if (!window.supabase) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = SUPABASE_CDN;
          s.onload = resolve;
          s.onerror = () => reject(new Error('No se pudo cargar Supabase (¿sin internet?)'));
          document.head.appendChild(s);
        });
      }
      this.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    },

    _ok({ data, error }) {
      if (error) throw new Error(error.message || 'Error de base de datos');
      return data;
    },

    async listar({ incluirOcultas = false } = {}) {
      let q = this.sb.from('camisas').select('*');
      if (!incluirOcultas) q = q.eq('visible', true);
      const data = this._ok(await q.order('creado', { ascending: false }));
      return (data || []).map(normalizar);
    },

    async obtener(id) {
      const data = this._ok(await this.sb.from('camisas').select('*').eq('id', id).maybeSingle());
      return data ? normalizar(data) : null;
    },

    async guardar(camisa) {
      const c = normalizar(camisa);
      if (c.id && !esUUID(c.id)) c.id = null;
      let res;
      if (c.id) {
        res = await this.sb.from('camisas').upsert(c).select().single();
      } else {
        const { id, ...resto } = c;
        res = await this.sb.from('camisas').insert(resto).select().single();
      }
      return normalizar(this._ok(res));
    },

    async eliminar(id) {
      const c = await this.obtener(id);
      this._ok(await this.sb.from('camisas').delete().eq('id', id));
      if (c) for (const url of c.imagenes) await this.borrarImagen(url);
    },

    async subirImagen(archivo) {
      const blob = await comprimirImagen(archivo);
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      this._ok(await this.sb.storage.from(CFG.bucket).upload(ruta, blob, { contentType: blob.type, upsert: false }));
      return this.sb.storage.from(CFG.bucket).getPublicUrl(ruta).data.publicUrl;
    },

    async borrarImagen(url) {
      const marca = `/storage/v1/object/public/${CFG.bucket}/`;
      const i = String(url).indexOf(marca);
      if (i === -1) return;
      const ruta = decodeURIComponent(String(url).slice(i + marca.length));
      try { await this.sb.storage.from(CFG.bucket).remove([ruta]); } catch (e) { console.warn(e); }
    },

    async ajustes() {
      const obj = { ...(CFG.ajustesPorDefecto || {}) };
      try {
        const filas = this._ok(await this.sb.from('ajustes').select('*'));
        (filas || []).forEach((f) => { obj[f.clave] = f.valor; });
      } catch (e) { console.warn('Ajustes:', e.message); }
      return obj;
    },

    async guardarAjustes(obj) {
      const filas = Object.entries(obj).map(([clave, valor]) => ({ clave, valor }));
      this._ok(await this.sb.from('ajustes').upsert(filas));
    },

    async login(email, clave) {
      const { error } = await this.sb.auth.signInWithPassword({ email, password: clave });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
    },
    async logout() { await this.sb.auth.signOut(); },
    async sesion() {
      const { data } = await this.sb.auth.getSession();
      return Boolean(data && data.session);
    }
  };

  /* ---------- Sincronización en vivo entre pestañas (Panel <-> Tienda) ---------- */
  const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('badcake_sync') : null;
  const oyentes = new Set();

  function notificarCambio() {
    try { if (canal) canal.postMessage({ ts: Date.now() }); } catch (_) {}
    try { localStorage.setItem('bc_sync_ts', String(Date.now())); } catch (_) {}
  }

  if (canal) canal.addEventListener('message', () => oyentes.forEach((fn) => fn()));
  addEventListener('storage', (e) => {
    if (e.key === 'bc_sync_ts') oyentes.forEach((fn) => fn());
  });

  /* ---------- API pública ---------- */
  const motor = USAR_NUBE ? Nube : Local;

  window.BCDB = {
    modo: motor.modo,
    init: () => motor.init(),
    listar: (o) => motor.listar(o),
    obtener: (id) => motor.obtener(id),
    async guardar(c) { const r = await motor.guardar(c); notificarCambio(); return r; },
    async eliminar(id) { await motor.eliminar(id); notificarCambio(); },
    subirImagen: (f) => motor.subirImagen(f),
    borrarImagen: (u) => motor.borrarImagen(u),
    ajustes: () => motor.ajustes(),
    async guardarAjustes(o) { await motor.guardarAjustes(o); notificarCambio(); },
    login: (e, c) => motor.login(e, c),
    logout: () => motor.logout(),
    sesion: () => motor.sesion(),
    onCambio(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },

    async cargarEjemplos() {
      const lista = window.BADCAKE_EJEMPLOS || [];
      let n = 0;
      for (const c of lista) { await motor.guardar(c); n++; }
      notificarCambio();
      return n;
    },

    async borrarTodo() {
      const todas = await motor.listar({ incluirOcultas: true });
      for (const c of todas) await motor.eliminar(c.id);
      notificarCambio();
      return todas.length;
    },

    async exportar() {
      const [camisas, ajustes] = await Promise.all([motor.listar({ incluirOcultas: true }), motor.ajustes()]);
      delete ajustes.semilla_inicial;
      return { marca: 'BADCAKE', version: 1, fecha: new Date().toISOString(), camisas, ajustes };
    },

    async importar(datos) {
      if (!datos || !Array.isArray(datos.camisas)) throw new Error('Archivo de respaldo no válido');
      let n = 0;
      for (const c of datos.camisas) { await motor.guardar(c); n++; }
      if (datos.ajustes && typeof datos.ajustes === 'object') await motor.guardarAjustes(datos.ajustes);
      notificarCambio();
      return n;
    }
  };
})();
