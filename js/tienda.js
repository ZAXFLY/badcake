/* =========================================================
   BADCAKE — lógica de la tienda (catálogo público)
   ========================================================= */
(function () {
  'use strict';

  const CFG = window.BADCAKE_CONFIG || {};
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad3 = (n) => String(n || 0).padStart(3, '0');
  const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const punteroFino = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const TALLAS = CFG.tallas || ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  const estado = {
    camisas: [],
    ajustes: { ...(CFG.ajustesPorDefecto || {}) },
    filtro: { coleccion: 'todas', talla: null, q: '', orden: 'nuevas' },
    bolsa: cargarBolsa(),
    modal: { camisa: null, foto: 0, talla: null }
  };

  /* ---------- Formatos ---------- */
  const dinero = (n) => `${estado.ajustes.moneda || 'RD$'} ${Number(n || 0).toLocaleString('es-DO', { maximumFractionDigits: 2 })}`;
  const esNueva = (c) => Date.now() - new Date(c.creado).getTime() < 14 * 864e5;
  const descuento = (c) => (c.precio_anterior && c.precio_anterior > c.precio) ? Math.round((1 - c.precio / c.precio_anterior) * 100) : 0;
  const ordenarTallas = (lista) => [...lista].sort((a, b) => {
    const ia = TALLAS.indexOf(a), ib = TALLAS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('sale'); setTimeout(() => t.remove(), 400); }, 2600);
  }

  /* =======================================================
     LOADER
     ======================================================= */
  function correrLoader(promesaDatos) {
    const yaVisto = sessionStorage.getItem('bc_visto');
    const minimo = reduceMotion ? 1 : (yaVisto ? 450 : 1800);
    const inicio = performance.now();
    const num = $('#loaderNum');
    const barra = $('#loaderBarra');
    let progreso = 0;
    let listo = false;
    promesaDatos.finally(() => { listo = true; });

    return new Promise((resolve) => {
      function paso(t) {
        const tiempo = (t - inicio) / minimo;
        const objetivo = listo ? Math.min(1, tiempo) : Math.min(0.9, tiempo);
        progreso += (objetivo - progreso) * 0.14;
        if (listo && tiempo >= 1 && progreso > 0.985) progreso = 1;
        num.textContent = pad3(Math.round(progreso * 100));
        barra.style.transform = `scaleX(${progreso})`;
        if (progreso >= 1) {
          sessionStorage.setItem('bc_visto', '1');
          resolve();
        } else {
          requestAnimationFrame(paso);
        }
      }
      requestAnimationFrame(paso);
    });
  }

  function terminarLoader() {
    const loader = $('#loader');
    loader.classList.add('sale');
    document.body.classList.remove('cargando');
    setTimeout(() => document.body.classList.add('listo'), 250);
    setTimeout(() => loader.remove(), 1300);
  }

  /* =======================================================
     CURSOR
     ======================================================= */
  function iniciarCursor() {
    if (!punteroFino) return;
    document.body.classList.add('con-cursor');
    const cur = $('#cursor');
    const punto = $('.cursor__punto', cur);
    const aro = $('.cursor__aro', cur);
    const texto = $('#cursorTexto');
    let mx = innerWidth / 2, my = innerHeight / 2, ax = mx, ay = my;

    addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      punto.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    }, { passive: true });

    (function bucle() {
      ax += (mx - ax) * 0.18;
      ay += (my - ay) * 0.18;
      aro.style.transform = `translate(${ax}px, ${ay}px) translate(-50%, -50%)`;
      requestAnimationFrame(bucle);
    })();

    document.addEventListener('mouseover', (e) => {
      const grande = e.target.closest('[data-cursor]');
      const enlace = e.target.closest('a, button, select, label, input');
      cur.classList.toggle('cursor--grande', Boolean(grande));
      cur.classList.toggle('cursor--enlace', !grande && Boolean(enlace));
      if (grande) texto.textContent = grande.dataset.cursor;
    });
    document.documentElement.addEventListener('mouseleave', () => cur.classList.add('cursor--oculto'));
    document.documentElement.addEventListener('mouseenter', () => cur.classList.remove('cursor--oculto'));
  }

  /* =======================================================
     HERO — pantalla dividida + logo con inclinación 3D
     ======================================================= */
  function iniciarHero() {
    const hero = $('#inicio');
    const logo = $('#heroLogo');
    let objetivo = 50, actual = -12;
    let rx = 0, ry = 0, trx = 0, tryy = 0;
    let activo = true;
    const t0 = performance.now();

    if (punteroFino) {
      hero.addEventListener('mousemove', (e) => {
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        objetivo = 14 + px * 72;
        tryy = (px - 0.5) * 24;
        trx = -(py - 0.5) * 24;
      });
      hero.addEventListener('mouseleave', () => { objetivo = 50; trx = 0; tryy = 0; });
    }

    new IntersectionObserver(([e]) => { activo = e.isIntersecting; }).observe(hero);

    function bucle(t) {
      if (activo && document.body.classList.contains('listo')) {
        const obj = punteroFino ? objetivo : 50 + Math.sin((t - t0) / 1500) * 18;
        actual += (obj - actual) * (reduceMotion ? 1 : 0.06);
        rx += (trx - rx) * 0.08;
        ry += (tryy - ry) * 0.08;
        hero.style.setProperty('--corte', actual.toFixed(2) + '%');
        logo.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        logo.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      }
      requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);
  }

  /* =======================================================
     CINTAS (reaccionan a la velocidad del scroll)
     ======================================================= */
  function iniciarCintas() {
    const anuncio = esc(estado.ajustes.anuncio || '');
    const estrella = '<span class="estrella">✦</span>';
    const negra = ['GOOD PEOPLE', '<span class="script">bad ideas</span>', anuncio, 'BADCAKE', '<span class="script">solo camisas</span>'].filter(Boolean);
    const blanca = ['BLANCO', '<span class="script">y</span>', 'NEGRO', '<span class="script">good people, bad ideas</span>', 'BADCAKE®'];

    const pistas = $$('.cinta__pista').map((el, i) => {
      const items = i === 0 ? negra : blanca;
      const bloque = `<span class="cinta__item">${items.join(estrella)}${estrella}</span>`;
      el.innerHTML = bloque.repeat(4);
      return { el, dir: Number(el.dataset.dir) || -1, x: 0, ancho: 0 };
    });

    const medir = () => pistas.forEach((p) => { p.ancho = p.el.scrollWidth / 4; });
    medir();
    addEventListener('resize', medir);
    if (document.fonts) document.fonts.ready.then(medir);

    let vel = 0, ultimoY = scrollY;
    addEventListener('scroll', () => {
      vel += Math.abs(scrollY - ultimoY) * 0.12;
      ultimoY = scrollY;
    }, { passive: true });

    function bucle() {
      vel *= 0.92;
      const v = reduceMotion ? 0 : 0.9 + Math.min(vel, 28);
      pistas.forEach((p) => {
        if (!p.ancho) return;
        p.x += v * p.dir;
        if (p.x <= -p.ancho) p.x += p.ancho;
        if (p.x > 0) p.x -= p.ancho;
        p.el.style.transform = `translate3d(${p.x.toFixed(2)}px, 0, 0)`;
      });
      requestAnimationFrame(bucle);
    }
    requestAnimationFrame(bucle);
  }

  /* =======================================================
     REVELADO AL HACER SCROLL
     ======================================================= */
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observador.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });

  function observarRevelar(contenedor = document) {
    $$('.revelar:not(.visible), .catalogo__titulo:not(.visible)', contenedor).forEach((el) => observador.observe(el));
  }

  /* =======================================================
     CATÁLOGO
     ======================================================= */
  function numerar() {
    [...estado.camisas]
      .sort((a, b) => new Date(a.creado) - new Date(b.creado))
      .forEach((c, i) => { c.numero = i + 1; });
  }

  function filtradas() {
    const { coleccion, talla, q, orden } = estado.filtro;
    const nq = normal(q);
    const lista = estado.camisas.filter((c) =>
      (coleccion === 'todas' || c.coleccion === coleccion) &&
      (!talla || c.tallas.includes(talla)) &&
      (!nq || normal(`${c.nombre} ${c.coleccion} ${c.descripcion} ${c.color}`).includes(nq))
    );
    const orden_ = {
      'nuevas': (a, b) => new Date(b.creado) - new Date(a.creado),
      'precio-asc': (a, b) => a.precio - b.precio,
      'precio-desc': (a, b) => b.precio - a.precio,
      'nombre': (a, b) => a.nombre.localeCompare(b.nombre, 'es')
    }[orden];
    return lista.sort((a, b) => (a.agotado - b.agotado) || orden_(a, b));
  }

  function tarjetaHTML(c, i = 0) {
    const [img1, img2] = c.imagenes;
    const d = descuento(c);
    const badges = [];
    if (c.destacado && !c.agotado) badges.push('<span class="badge">Hot</span>');
    if (esNueva(c) && !c.agotado) badges.push('<span class="badge">Nueva</span>');
    if (d && !c.agotado) badges.push(`<span class="badge badge--blanco">-${d}%</span>`);

    return `
      <article class="tarjeta revelar${c.agotado ? ' tarjeta--agotada' : ''}" data-id="${esc(c.id)}" data-cursor="${c.agotado ? 'MIRAR' : 'VER'}"
               tabindex="0" role="button" aria-label="Ver ${esc(c.nombre)}" style="--d:${((i % 3) * 0.09).toFixed(2)}s">
        <div class="tarjeta__media">
          ${img1
            ? `<img class="tarjeta__img" src="${esc(img1)}" alt="${esc(c.nombre)}" loading="lazy" decoding="async">`
            : `<div class="tarjeta__sinfoto"><img src="assets/img/logo-negro.png" alt=""></div>`}
          ${img2 ? `<img class="tarjeta__img tarjeta__img--2" src="${esc(img2)}" alt="" loading="lazy" decoding="async">` : ''}
          <span class="tarjeta__num">N°${pad3(c.numero)}</span>
          ${badges.length ? `<div class="tarjeta__badges">${badges.join('')}</div>` : ''}
          ${c.tallas.length ? `<div class="tarjeta__tallas">${ordenarTallas(c.tallas).map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="tarjeta__info">
          <h3 class="tarjeta__nombre">${esc(c.nombre)}</h3>
          <span class="tarjeta__precio">${dinero(c.precio)}${d ? `<s>${dinero(c.precio_anterior)}</s>` : ''}</span>
        </div>
        ${c.coleccion ? `<p class="tarjeta__coleccion">${esc(c.coleccion)}</p>` : ''}
      </article>`;
  }

  function pintarFiltros() {
    const cuenta = {};
    estado.camisas.forEach((c) => { if (c.coleccion) cuenta[c.coleccion] = (cuenta[c.coleccion] || 0) + 1; });
    const cols = Object.keys(cuenta).sort((a, b) => a.localeCompare(b, 'es'));
    if (estado.filtro.coleccion !== 'todas' && !cuenta[estado.filtro.coleccion]) estado.filtro.coleccion = 'todas';

    $('#chipsColeccion').innerHTML =
      `<button class="chip${estado.filtro.coleccion === 'todas' ? ' activo' : ''}" data-col="todas" role="tab">Todas<sup>${estado.camisas.length}</sup></button>` +
      cols.map((c) => `<button class="chip${estado.filtro.coleccion === c ? ' activo' : ''}" data-col="${esc(c)}" role="tab">${esc(c)}<sup>${cuenta[c]}</sup></button>`).join('');

    const tallas = ordenarTallas([...new Set(estado.camisas.flatMap((c) => c.tallas))]);
    $('#chipsTalla').innerHTML = tallas.map((t) =>
      `<button class="chip chip--talla${estado.filtro.talla === t ? ' activo' : ''}" data-talla="${esc(t)}" aria-pressed="${estado.filtro.talla === t}">${esc(t)}</button>`
    ).join('');

    $('#filtros').hidden = estado.camisas.length === 0;
  }

  function pintarRejilla(animar = false) {
    const rejilla = $('#rejilla');
    const render = () => {
      const lista = filtradas();
      $('#conteo').textContent = `(${lista.length})`;
      rejilla.innerHTML = lista.map(tarjetaHTML).join('');
      const vacio = $('#vacio');
      vacio.hidden = lista.length > 0;
      if (!lista.length && estado.camisas.length) {
        $('#vacioTitulo').textContent = 'Nada por aquí';
        $('#vacioTexto').textContent = 'Prueba con otro filtro o búsqueda.';
      }
      observarRevelar(rejilla);
      rejilla.classList.remove('cambiando');
    };
    if (animar && !reduceMotion) {
      rejilla.classList.add('cambiando');
      setTimeout(render, 280);
    } else {
      render();
    }
  }

  function pintarDestacadas() {
    const lista = estado.camisas.filter((c) => c.destacado && !c.agotado);
    const seccion = $('#destacadas');
    seccion.hidden = lista.length === 0;
    $('#carril').innerHTML = lista.map(tarjetaHTML).join('');
    observarRevelar(seccion);
  }

  function iniciarFiltros() {
    $('#chipsColeccion').addEventListener('click', (e) => {
      const b = e.target.closest('[data-col]');
      if (!b) return;
      estado.filtro.coleccion = b.dataset.col;
      $$('#chipsColeccion .chip').forEach((x) => x.classList.toggle('activo', x === b));
      pintarRejilla(true);
    });
    $('#chipsTalla').addEventListener('click', (e) => {
      const b = e.target.closest('[data-talla]');
      if (!b) return;
      estado.filtro.talla = estado.filtro.talla === b.dataset.talla ? null : b.dataset.talla;
      $$('#chipsTalla .chip').forEach((x) => {
        const on = x.dataset.talla === estado.filtro.talla;
        x.classList.toggle('activo', on);
        x.setAttribute('aria-pressed', on);
      });
      pintarRejilla(true);
    });
    let espera;
    $('#buscar').addEventListener('input', (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => { estado.filtro.q = e.target.value.trim(); pintarRejilla(true); }, 220);
    });
    $('#ordenar').addEventListener('change', (e) => { estado.filtro.orden = e.target.value; pintarRejilla(true); });

    // Abrir camisa (clic o Enter) en rejilla y carril
    const abrirDesde = (e) => {
      const t = e.target.closest('.tarjeta');
      if (!t || !t.dataset.id) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      if ($('#carril').dataset.arrastro === '1') return;
      abrirModal(t.dataset.id);
    };
    ['#rejilla', '#carril'].forEach((s) => {
      $(s).addEventListener('click', abrirDesde);
      $(s).addEventListener('keydown', abrirDesde);
    });

    // Arrastrar el carril con el mouse
    const carril = $('#carril');
    let abajo = false, x0 = 0, s0 = 0;
    carril.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      abajo = true; x0 = e.clientX; s0 = carril.scrollLeft; carril.dataset.arrastro = '0';
    });
    addEventListener('pointermove', (e) => {
      if (!abajo) return;
      const dx = e.clientX - x0;
      if (Math.abs(dx) > 6) { carril.dataset.arrastro = '1'; carril.classList.add('arrastrando'); }
      carril.scrollLeft = s0 - dx;
    });
    addEventListener('pointerup', () => {
      if (!abajo) return;
      abajo = false;
      carril.classList.remove('arrastrando');
      setTimeout(() => { carril.dataset.arrastro = '0'; }, 50);
    });
    carril.addEventListener('dragstart', (e) => e.preventDefault());
  }

  /* =======================================================
     MODAL DE CAMISA
     ======================================================= */
  function abrirModal(id, actualizarHash = true) {
    const c = estado.camisas.find((x) => x.id === id);
    if (!c) return;
    estado.modal = { camisa: c, foto: 0, talla: null };
    const d = descuento(c);

    $('#mNum').textContent = `N° ${pad3(c.numero)}`;
    $('#mColeccion').textContent = c.coleccion || 'BADCAKE';
    $('#mNombre').textContent = c.nombre;
    $('#mPrecio').innerHTML = c.agotado
      ? `${dinero(c.precio)} <span class="badge">Agotada</span>`
      : `${dinero(c.precio)}${d ? ` <s>${dinero(c.precio_anterior)}</s> <span class="badge badge--blanco">-${d}%</span>` : ''}`;
    $('#mDesc').textContent = c.descripcion || 'Una camisa para gente buena con ideas malas.';
    $('#mColor').textContent = c.color ? `Color: ${c.color}` : '';

    const fotos = c.imagenes.length ? c.imagenes : ['assets/img/logo-negro.png'];
    $('#mPrincipal').innerHTML = fotos.map((src, i) =>
      `<img src="${esc(src)}" alt="${esc(c.nombre)} — foto ${i + 1}" class="${i === 0 ? 'activa' : ''}">`).join('');
    $('#mMinis').innerHTML = fotos.length > 1
      ? fotos.map((src, i) => `<button class="${i === 0 ? 'activa' : ''}" data-foto="${i}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('')
      : '';
    $('#mPrev').hidden = $('#mSig').hidden = fotos.length < 2;

    const todas = ordenarTallas([...new Set([...TALLAS, ...c.tallas])]);
    $('#mTallas').innerHTML = todas.map((t) => {
      const ok = c.tallas.includes(t) && !c.agotado;
      return `<button class="talla" data-talla="${esc(t)}" ${ok ? '' : 'disabled'} aria-pressed="false">${esc(t)}</button>`;
    }).join('');
    const disponibles = c.tallas.filter(() => !c.agotado);
    if (disponibles.length === 1) elegirTalla(disponibles[0]);

    const aviso = $('#mAviso');
    aviso.classList.remove('alerta');
    aviso.textContent = c.agotado ? 'Sin existencia por ahora' : (c.tallas.length ? `${c.tallas.length} disponible${c.tallas.length > 1 ? 's' : ''}` : 'Consultar tallas');

    $('#mAgregar').disabled = c.agotado;
    $('#mAgregar').textContent = c.agotado ? 'Agotada' : 'Agregar a la bolsa';
    $('#mWhats').textContent = c.agotado ? 'Preguntar por WhatsApp' : 'Pedir por WhatsApp';

    const modal = $('#modal');
    modal.classList.add('abierto');
    modal.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    $('.modal__info', modal).scrollTop = 0;
    $('.modal__caja', modal).scrollTop = 0;
    if (actualizarHash) { try { history.replaceState(null, '', `#camisa-${c.id}`); } catch (_) {} }
    setTimeout(() => $('.modal__cerrar', modal).focus({ preventScroll: true }), 50);
  }

  function cerrarModal() {
    const modal = $('#modal');
    if (!modal.classList.contains('abierto')) return;
    modal.classList.remove('abierto');
    modal.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    if (location.hash.startsWith('#camisa-')) {
      try { history.replaceState(null, '', location.href.split('#')[0]); } catch (_) {}
    }
  }

  function irAFoto(i) {
    const imgs = $$('#mPrincipal img');
    if (imgs.length < 2) return;
    const n = (i + imgs.length) % imgs.length;
    estado.modal.foto = n;
    imgs.forEach((img, k) => img.classList.toggle('activa', k === n));
    $$('#mMinis button').forEach((b, k) => b.classList.toggle('activa', k === n));
  }

  function elegirTalla(t) {
    estado.modal.talla = t;
    $$('#mTallas .talla').forEach((b) => {
      const on = b.dataset.talla === t;
      b.classList.toggle('activa', on);
      b.setAttribute('aria-pressed', on);
    });
    const aviso = $('#mAviso');
    aviso.classList.remove('alerta');
    aviso.textContent = `Talla ${t} seleccionada`;
  }

  function exigirTalla() {
    const c = estado.modal.camisa;
    if (!c.tallas.length || c.agotado) return true;
    if (estado.modal.talla) return true;
    const aviso = $('#mAviso');
    aviso.textContent = '← Elige una talla primero';
    aviso.classList.remove('alerta');
    void aviso.offsetWidth;
    aviso.classList.add('alerta');
    return false;
  }

  function iniciarModal() {
    const modal = $('#modal');
    modal.addEventListener('click', (e) => { if (e.target.closest('[data-cerrar]')) cerrarModal(); });
    $('#mPrev').addEventListener('click', () => irAFoto(estado.modal.foto - 1));
    $('#mSig').addEventListener('click', () => irAFoto(estado.modal.foto + 1));
    $('#mMinis').addEventListener('click', (e) => { const b = e.target.closest('[data-foto]'); if (b) irAFoto(Number(b.dataset.foto)); });
    $('#mTallas').addEventListener('click', (e) => { const b = e.target.closest('.talla'); if (b && !b.disabled) elegirTalla(b.dataset.talla); });

    $('#mAgregar').addEventListener('click', () => {
      if (!exigirTalla()) return;
      agregarBolsa(estado.modal.camisa.id, estado.modal.talla || 'Única');
    });
    $('#mWhats').addEventListener('click', () => {
      const c = estado.modal.camisa;
      if (!c.agotado && !exigirTalla()) return;
      const lineas = [
        '¡Hola BADCAKE! 👋 Me interesa esta camisa:',
        '',
        `▪ N°${pad3(c.numero)} — ${c.nombre.toUpperCase()}`,
        estado.modal.talla ? `▪ Talla: ${estado.modal.talla}` : null,
        `▪ Precio: ${dinero(c.precio)}`,
        enlaceCamisa(c) || null,
        '',
        '¿Está disponible?'
      ].filter((l) => l !== null);
      abrirWhats(lineas.join('\n'));
    });
    $('#mCompartir').addEventListener('click', async () => {
      const url = enlaceCamisa(estado.modal.camisa) || location.href;
      try {
        if (navigator.share && !punteroFino) { await navigator.share({ title: `BADCAKE — ${estado.modal.camisa.nombre}`, url }); return; }
        await navigator.clipboard.writeText(url);
        toast('Enlace copiado ✦');
      } catch (_) { /* cancelado */ }
    });

    // Deslizar fotos en móvil
    let x0 = null;
    const gal = $('.modal__galeria');
    gal.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    gal.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) irAFoto(estado.modal.foto + (dx < 0 ? 1 : -1));
      x0 = null;
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { cerrarModal(); cerrarBolsa(); }
      if (modal.classList.contains('abierto')) {
        if (e.key === 'ArrowRight') irAFoto(estado.modal.foto + 1);
        if (e.key === 'ArrowLeft') irAFoto(estado.modal.foto - 1);
      }
    });
  }

  /* =======================================================
     WHATSAPP
     ======================================================= */
  const numeroWhats = () => String(estado.ajustes.whatsapp || '').replace(/\D/g, '');
  const enlaceCamisa = (c) => location.protocol.startsWith('http') ? `${location.origin}${location.pathname}#camisa-${c.id}` : '';

  function abrirWhats(mensaje) {
    const n = numeroWhats();
    if (!n) { toast('Configura el WhatsApp de la tienda en Panel dueño → Ajustes'); return; }
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  }

  /* =======================================================
     BOLSA
     ======================================================= */
  function cargarBolsa() {
    try { return JSON.parse(localStorage.getItem('bc_bolsa')) || []; } catch (_) { return []; }
  }
  const guardarBolsa = () => localStorage.setItem('bc_bolsa', JSON.stringify(estado.bolsa));

  function agregarBolsa(id, talla) {
    const it = estado.bolsa.find((x) => x.id === id && x.talla === talla);
    if (it) it.cant += 1; else estado.bolsa.push({ id, talla, cant: 1 });
    guardarBolsa();
    pintarBolsa();
    const conteo = $('#bolsaConteo');
    conteo.classList.remove('salta'); void conteo.offsetWidth; conteo.classList.add('salta');
    toast(`Agregada a tu bolsa ✦ Talla ${talla}`);
  }

  function itemsBolsa() {
    return estado.bolsa
      .map((it) => ({ ...it, c: estado.camisas.find((c) => c.id === it.id) }))
      .filter((it) => it.c);
  }

  function pintarBolsa() {
    const items = itemsBolsa();
    if (estado.camisas.length) {
      estado.bolsa = items.map(({ id, talla, cant }) => ({ id, talla, cant }));
      guardarBolsa();
    }
    const total = items.reduce((s, it) => s + it.c.precio * it.cant, 0);
    const n = items.reduce((s, it) => s + it.cant, 0);
    $('#bolsaConteo').textContent = n;
    $('#bolsaConteo2').textContent = n;
    $('#bolsaTotal').textContent = n ? dinero(total) : '—';
    $('#bolsaEnviar').disabled = n === 0;
    $('#bolsaItems').innerHTML = n
      ? items.map((it, i) => `
          <div class="bolsa__item">
            <img src="${esc(it.c.imagenes[0] || 'assets/img/logo-blanco.png')}" alt="">
            <div>
              <h4>${esc(it.c.nombre)}</h4>
              <p class="bolsa__meta">N°${pad3(it.c.numero)} · Talla ${esc(it.talla)}</p>
              <div class="bolsa__cant">
                <button data-accion="menos" data-i="${i}" aria-label="Quitar uno">−</button>
                <span>${it.cant}</span>
                <button data-accion="mas" data-i="${i}" aria-label="Agregar uno">+</button>
              </div>
            </div>
            <div class="bolsa__lado">
              <span>${dinero(it.c.precio * it.cant)}</span>
              <button class="bolsa__quitar" data-accion="quitar" data-i="${i}">Quitar</button>
            </div>
          </div>`).join('')
      : `<div class="bolsa__vacia"><p>Tu bolsa está vacía</p><p>las malas ideas no se compran solas…</p></div>`;
  }

  function abrirBolsa() {
    const b = $('#bolsa');
    b.classList.add('abierta');
    b.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }
  function cerrarBolsa() {
    const b = $('#bolsa');
    if (!b.classList.contains('abierta')) return;
    b.classList.remove('abierta');
    b.setAttribute('aria-hidden', 'true');
    if (!$('#modal').classList.contains('abierto')) document.documentElement.style.overflow = '';
  }

  function iniciarBolsa() {
    $('#btnBolsa').addEventListener('click', () => { cerrarModal(); abrirBolsa(); });
    $('#bolsa').addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar-bolsa]')) return cerrarBolsa();
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      const i = Number(b.dataset.i);
      const it = estado.bolsa[i];
      if (!it) return;
      if (b.dataset.accion === 'mas') it.cant += 1;
      if (b.dataset.accion === 'menos') it.cant -= 1;
      if (b.dataset.accion === 'quitar' || it.cant < 1) estado.bolsa.splice(i, 1);
      guardarBolsa();
      pintarBolsa();
    });
    $('#bolsaEnviar').addEventListener('click', () => {
      const items = itemsBolsa();
      if (!items.length) return;
      const total = items.reduce((s, it) => s + it.c.precio * it.cant, 0);
      const lineas = [
        '¡Hola BADCAKE! 👋 Quiero hacer este pedido:',
        '',
        ...items.map((it, k) => `${k + 1}. N°${pad3(it.c.numero)} ${it.c.nombre.toUpperCase()} — Talla ${it.talla} × ${it.cant} — ${dinero(it.c.precio * it.cant)}`),
        '',
        `Total estimado: ${dinero(total)}`,
        '',
        '¿Me confirman disponibilidad y envío?'
      ];
      abrirWhats(lineas.join('\n'));
    });
    addEventListener('storage', (e) => { if (e.key === 'bc_bolsa') { estado.bolsa = cargarBolsa(); pintarBolsa(); } });
  }

  /* =======================================================
     MANIFIESTO (palabras que se encienden con el scroll)
     ======================================================= */
  let palabras = [];
  function pintarManifiesto() {
    const texto = estado.ajustes.manifiesto || '';
    const clave = /^(buena|malas?|ideas?|actitud|raro|permiso)\b/i;
    $('#manifiestoFrase').innerHTML = texto.split(/\s+/).filter(Boolean)
      .map((w) => `<span class="palabra${clave.test(normal(w)) ? ' script' : ''}">${esc(w)}</span>`).join(' ');
    palabras = $$('#manifiestoFrase .palabra');
    actualizarManifiesto();
  }
  function actualizarManifiesto() {
    if (!palabras.length) return;
    const r = $('#manifiestoFrase').getBoundingClientRect();
    const vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)));
    const n = Math.round(p * palabras.length);
    palabras.forEach((w, i) => w.classList.toggle('on', i < n));
  }

  /* =======================================================
     SCROLL GENERAL
     ======================================================= */
  function iniciarScroll() {
    const filtros = $('#filtros');
    let pendiente = false;
    const tick = () => {
      pendiente = false;
      actualizarManifiesto();
      const topPegado = parseFloat(getComputedStyle(filtros).top) || 0;
      filtros.classList.toggle('pegado', filtros.getBoundingClientRect().top <= topPegado + 1);
    };
    addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(tick); } }, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  /* =======================================================
     AJUSTES DE LA TIENDA (contacto, redes, etc.)
     ======================================================= */
  function aplicarAjustes() {
    const a = estado.ajustes;
    document.body.classList.toggle('fotos-bn', a.fotosBN !== false);

    const poner = (sel, href, texto) => {
      const el = $(sel);
      if (href) { el.href = href; if (texto) el.textContent = texto; el.classList.remove('apagado'); }
      else { el.removeAttribute('href'); el.classList.add('apagado'); }
    };
    const usuario = (v) => String(v || '').trim().replace(/^@/, '');
    const red = (v, base) => !v ? '' : (/^https?:\/\//i.test(v) ? v : base + usuario(v));

    poner('#lnkWhats', numeroWhats() ? `https://wa.me/${numeroWhats()}` : '');
    poner('#lnkInsta', red(a.instagram, 'https://instagram.com/'));
    poner('#lnkTiktok', red(a.tiktok, 'https://www.tiktok.com/@'));
    poner('#lnkMail', a.email ? `mailto:${a.email}` : '', a.email || '—');

    const anio = new Date().getFullYear();
    ['#anio', '#anio2', '#anio3'].forEach((s) => { const el = $(s); if (el) el.textContent = anio; });
  }

  /* =======================================================
     ARRANQUE
     ======================================================= */
  async function cargarDatos() {
    await BCDB.init();
    const [camisas, ajustes] = await Promise.all([BCDB.listar(), BCDB.ajustes()]);
    estado.camisas = camisas;
    estado.ajustes = { ...estado.ajustes, ...ajustes };
  }

  async function iniciar() {
    iniciarCursor();
    iniciarHero();
    iniciarFiltros();
    iniciarModal();
    iniciarBolsa();

    const datos = cargarDatos().catch((err) => {
      console.error(err);
      toast('No se pudo cargar el catálogo. Intenta de nuevo.');
      $('#vacioTitulo').textContent = 'Algo salió mal';
      $('#vacioTexto').textContent = err.message || 'No se pudo conectar con la base de datos.';
    });

    await correrLoader(datos);
    await datos;

    numerar();
    aplicarAjustes();
    iniciarCintas();
    pintarFiltros();
    pintarRejilla();
    pintarDestacadas();
    pintarManifiesto();
    pintarBolsa();
    iniciarScroll();
    observarRevelar();
    terminarLoader();

    if (location.hash.startsWith('#camisa-')) {
      setTimeout(() => abrirModal(decodeURIComponent(location.hash.slice(8)), false), 900);
    }

    // Si el dueño edita algo en admin.html en otra pestaña, actualizar catálogo en vivo
    if (BCDB.onCambio) {
      BCDB.onCambio(async () => {
        try {
          await cargarDatos();
          numerar();
          aplicarAjustes();
          pintarFiltros();
          pintarRejilla();
          pintarDestacadas();
          pintarManifiesto();
          pintarBolsa();
        } catch (e) { console.warn(e); }
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
