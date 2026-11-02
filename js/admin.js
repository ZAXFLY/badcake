/* =========================================================
   BADCAKE — lógica del panel del dueño (admin.html)
   ========================================================= */
(function () {
  'use strict';

  const CFG = window.BADCAKE_CONFIG || {};
  const TALLAS = CFG.tallas || ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad3 = (n) => String(n || 0).padStart(3, '0');
  const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const estado = {
    camisas: [],
    ajustes: { ...(CFG.ajustesPorDefecto || {}) },
    filtro: 'todas',
    q: '',
    editor: {
      id: null,
      creado: null,
      imagenes: [],
      eliminadas: [],
      tallas: new Set(['S', 'M', 'L', 'XL'])
    }
  };

  const dinero = (n) => `${estado.ajustes.moneda || 'RD$'} ${Number(n || 0).toLocaleString('es-DO', { maximumFractionDigits: 2 })}`;
  const ordenarTallas = (lista) => [...lista].sort((a, b) => {
    const ia = TALLAS.indexOf(a), ib = TALLAS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.classList.add('sale'); setTimeout(() => t.remove(), 400); }, 2800);
  }

  /* =======================================================
     DIÁLOGO DE CONFIRMACIÓN
     ======================================================= */
  let resolverDialogo = null;
  function confirmar(titulo, texto, textoBoton = 'Sí, continuar') {
    $('#dlgTitulo').textContent = titulo;
    $('#dlgTexto').textContent = texto;
    $('#dlgSi').textContent = textoBoton;
    const dlg = $('#dialogo');
    dlg.classList.add('abierto');
    dlg.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#dlgNo').focus(), 40);
    return new Promise((resolve) => { resolverDialogo = resolve; });
  }

  function cerrarDialogo(respuesta) {
    const dlg = $('#dialogo');
    if (!dlg.classList.contains('abierto')) return;
    dlg.classList.remove('abierto');
    dlg.setAttribute('aria-hidden', 'true');
    if (resolverDialogo) {
      const fn = resolverDialogo;
      resolverDialogo = null;
      fn(Boolean(respuesta));
    }
  }

  /* =======================================================
     SESIÓN Y LOGIN
     ======================================================= */
  function configurarModoUI() {
    const esNube = BCDB.modo === 'nube';
    $('#campoEmail').hidden = !esNube;
    $('#loginEmail').required = esNube;

    if (esNube) {
      $('#loginModo').textContent = 'Conectado a la nube (Supabase). Ingresa con tu correo y contraseña de administrador.';
      $('#modoBadge').textContent = 'Modo nube · Supabase';
      $('#datoModoEtiqueta').textContent = 'Conectado a internet';
      $('#datoModoTitulo').textContent = 'Modo nube (Supabase)';
      $('#datoModoTexto').textContent = 'Tus camisas, fotos y ajustes viven en tu base de datos de Supabase. Todo lo que agregues o edites aquí aparece al instante para todos los clientes.';
    } else {
      $('#loginModo').innerHTML = 'Base de datos interna activa en este navegador. Contraseña actual configurada en <code>js/config.js</code>.';
      $('#modoBadge').textContent = 'Modo local · Base interna';
      $('#datoModoEtiqueta').textContent = 'Base de datos interna';
      $('#datoModoTitulo').textContent = 'Modo local (IndexedDB)';
      $('#datoModoTexto').textContent = 'Las camisas, fotos optimizadas y ajustes se guardan directamente en la base de datos interna del navegador sin instalar servidores. Para publicar en internet y que todos los clientes vean los cambios desde cualquier celular, conecta Supabase en js/config.js siguiendo LEEME.md.';
    }
  }

  function mostrarLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    $('#loginError').textContent = '';
    $('#loginClave').value = '';
    setTimeout(() => (BCDB.modo === 'nube' ? $('#loginEmail') : $('#loginClave')).focus(), 60);
  }

  async function mostrarApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    await recargarTodo();
  }

  function iniciarLogin() {
    $('#formLogin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btnEntrar');
      const err = $('#loginError');
      err.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Verificando…';
      try {
        await BCDB.login($('#loginEmail').value.trim(), $('#loginClave').value);
        toast('Bienvenido al panel de BADCAKE ✦');
        await mostrarApp();
      } catch (ex) {
        err.textContent = ex.message || 'No se pudo iniciar sesión';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar al panel →';
      }
    });

    $('#btnSalir').addEventListener('click', async () => {
      await BCDB.logout();
      toast('Sesión cerrada');
      mostrarLogin();
    });
  }

  /* =======================================================
     NAVEGACIÓN ENTRE VISTAS
     ======================================================= */
  function irAVista(nombre) {
    $$('.lateral__link').forEach((b) => b.classList.toggle('activo', b.dataset.vista === nombre));
    $$('.vista').forEach((v) => v.classList.toggle('activa', v.id === `vista-${nombre}`));
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function iniciarNavegacion() {
    $('.lateral__nav').addEventListener('click', (e) => {
      const b = e.target.closest('[data-vista]');
      if (b) irAVista(b.dataset.vista);
    });
  }

  /* =======================================================
     INVENTARIO DE CAMISAS
     ======================================================= */
  function numerar() {
    [...estado.camisas]
      .sort((a, b) => new Date(a.creado) - new Date(b.creado))
      .forEach((c, i) => { c.numero = i + 1; });
  }

  function actualizarStats() {
    const total = estado.camisas.length;
    const visibles = estado.camisas.filter((c) => c.visible).length;
    const destacadas = estado.camisas.filter((c) => c.destacado).length;
    const agotadas = estado.camisas.filter((c) => c.agotado).length;

    $('#navConteo').textContent = total;
    $('#stTotal').textContent = total;
    $('#stVisibles').textContent = visibles;
    $('#stDestacadas').textContent = destacadas;
    $('#stAgotadas').textContent = agotadas;

    const cols = [...new Set(estado.camisas.map((c) => c.coleccion).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    $('#listaColecciones').innerHTML = cols.map((c) => `<option value="${esc(c)}">`).join('');
  }

  function camisasFiltradas() {
    const nq = normal(estado.q);
    return estado.camisas.filter((c) => {
      if (estado.filtro === 'visibles' && !c.visible) return false;
      if (estado.filtro === 'ocultas' && c.visible) return false;
      if (estado.filtro === 'destacadas' && !c.destacado) return false;
      if (estado.filtro === 'agotadas' && !c.agotado) return false;
      if (nq && !normal(`${c.nombre} ${c.coleccion} ${c.color} ${c.descripcion}`).includes(nq)) return false;
      return true;
    });
  }

  function pintarLista() {
    actualizarStats();
    const listaEl = $('#lista');
    const vacioEl = $('#vacioAdmin');

    if (estado.camisas.length === 0) {
      listaEl.innerHTML = '';
      vacioEl.hidden = false;
      return;
    }
    vacioEl.hidden = true;

    const lista = camisasFiltradas();
    if (!lista.length) {
      listaEl.innerHTML = `
        <div class="vacio-admin">
          <h2>Sin coincidencias</h2>
          <p class="script">ninguna camisa coincide con ese filtro…</p>
        </div>`;
      return;
    }

    listaEl.innerHTML = lista.map((c) => {
      const img = c.imagenes[0];
      const tieneOferta = c.precio_anterior && c.precio_anterior > c.precio;
      return `
        <article class="item-camisa${c.visible ? '' : ' item-camisa--oculta'}" data-id="${esc(c.id)}">
          <div class="item-camisa__media" data-accion="editar" title="Editar camisa">
            ${img
              ? `<img src="${esc(img)}" alt="${esc(c.nombre)}" loading="lazy">`
              : `<img src="assets/img/logo-negro.png" alt="" class="sin-foto">`}
            ${c.imagenes.length ? `<span class="item-camisa__fotos-num">${c.imagenes.length} foto${c.imagenes.length > 1 ? 's' : ''}</span>` : ''}
          </div>
          <div class="item-camisa__cuerpo">
            <div class="item-camisa__linea1">
              <span class="item-camisa__num">N°${pad3(c.numero)}</span>
              <h3 class="item-camisa__nombre" data-accion="editar">${esc(c.nombre)}</h3>
              ${c.coleccion ? `<span class="item-camisa__col">· ${esc(c.coleccion)}</span>` : ''}
            </div>
            <div class="item-camisa__meta">
              <span class="item-camisa__precio">${dinero(c.precio)}${tieneOferta ? `<s>${dinero(c.precio_anterior)}</s>` : ''}</span>
              ${c.color ? `<span class="item-camisa__color">${esc(c.color)}</span>` : ''}
            </div>
            ${c.tallas.length
              ? `<div class="item-camisa__tallas">${ordenarTallas(c.tallas).map((t) => `<span>${esc(t)}</span>`).join('')}</div>`
              : `<span class="item-camisa__color">Sin tallas marcadas</span>`}
          </div>
          <div class="item-camisa__controles">
            <div class="pildoras-estado">
              <button type="button" class="pildora${c.visible ? ' on' : ''}" data-toggle="visible" title="Alternar visibilidad en la tienda">
                ${c.visible ? 'Visible' : 'Oculta'}
              </button>
              <button type="button" class="pildora${c.destacado ? ' on' : ''}" data-toggle="destacado" title="Mostrar en Destacadas">
                ★ Destacada
              </button>
              <button type="button" class="pildora pildora--alerta${c.agotado ? ' on' : ''}" data-toggle="agotado" title="Marcar como agotada">
                ${c.agotado ? 'Agotada' : 'En stock'}
              </button>
            </div>
            <div class="item-camisa__acciones">
              <button type="button" class="btn-mini" data-accion="editar">Editar</button>
              <button type="button" class="btn-mini" data-accion="duplicar" title="Crear copia">Duplicar</button>
              <button type="button" class="btn-mini btn-mini--borrar" data-accion="eliminar">Borrar</button>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function iniciarInventario() {
    $('#btnNueva').addEventListener('click', () => abrirEditor(null));

    $('#vacioAdmin').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      if (b.dataset.accion === 'nueva') abrirEditor(null);
      if (b.dataset.accion === 'ejemplos') await accionCargarEjemplos();
    });

    let espera;
    $('#adBuscar').addEventListener('input', (e) => {
      clearTimeout(espera);
      espera = setTimeout(() => { estado.q = e.target.value.trim(); pintarLista(); }, 160);
    });

    $('#adFiltro').addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      estado.filtro = b.dataset.f;
      $$('#adFiltro button').forEach((x) => x.classList.toggle('activo', x === b));
      pintarLista();
    });

    $('#lista').addEventListener('click', async (e) => {
      const fila = e.target.closest('.item-camisa');
      if (!fila) return;
      const c = estado.camisas.find((x) => x.id === fila.dataset.id);
      if (!c) return;

      const tog = e.target.closest('[data-toggle]');
      if (tog) {
        const campo = tog.dataset.toggle;
        c[campo] = !c[campo];
        try {
          await BCDB.guardar(c);
          pintarLista();
          toast('Estado actualizado ✦');
        } catch (ex) {
          c[campo] = !c[campo];
          toast(ex.message || 'No se pudo actualizar');
        }
        return;
      }

      const acc = e.target.closest('[data-accion]');
      if (!acc) return;
      if (acc.dataset.accion === 'editar') abrirEditor(c);
      if (acc.dataset.accion === 'duplicar') {
        try {
          const copia = {
            ...c,
            id: null,
            nombre: `${c.nombre} (Copia)`,
            creado: new Date().toISOString()
          };
          await BCDB.guardar(copia);
          await recargarCamisas();
          toast('Camisa duplicada ✦');
        } catch (ex) {
          toast(ex.message || 'No se pudo duplicar');
        }
      }
      if (acc.dataset.accion === 'eliminar') {
        const ok = await confirmar('¿Borrar esta camisa?', `Se eliminará "${c.nombre}" permanentemente del catálogo.`, 'Sí, borrar');
        if (!ok) return;
        try {
          await BCDB.eliminar(c.id);
          await recargarCamisas();
          toast('Camisa eliminada');
        } catch (ex) {
          toast(ex.message || 'No se pudo eliminar');
        }
      }
    });
  }

  /* =======================================================
     EDITOR DE CAMISA (CREAR / EDITAR + SUBIDA DE FOTOS)
     ======================================================= */
  function pintarTallasEditor() {
    const todasActivas = TALLAS.every((t) => estado.editor.tallas.has(t));
    $('#tallasSel').innerHTML =
      TALLAS.map((t) => {
        const on = estado.editor.tallas.has(t);
        return `<button type="button" class="talla-chk${on ? ' activa' : ''}" data-talla="${esc(t)}" aria-pressed="${on}">${esc(t)}</button>`;
      }).join('') +
      `<button type="button" class="talla-chk talla-chk--todas" data-todas="1">${todasActivas ? 'Ninguna' : 'Todas'}</button>`;
  }

  function pintarFotosEditor() {
    const imgs = estado.editor.imagenes;
    $('#fotos').innerHTML = imgs.map((src, i) => `
      <div class="foto-item" draggable="true" data-i="${i}">
        <img src="${esc(src)}" alt="Foto ${i + 1}">
        ${i === 0 ? '<span class="foto-item__portada">Portada</span>' : ''}
        <button type="button" class="foto-item__borrar" data-quitar="${i}" aria-label="Quitar foto">✕</button>
        <div class="foto-item__orden">
          <button type="button" data-mover="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Mover antes">←</button>
          <button type="button" data-mover="1" data-i="${i}" ${i === imgs.length - 1 ? 'disabled' : ''} title="Mover después">→</button>
        </div>
      </div>`).join('');
  }

  function abrirEditor(camisa = null) {
    const form = $('#formCamisa');
    form.reset();

    if (camisa) {
      $('#edEtiqueta').textContent = `Editando N°${pad3(camisa.numero)}`;
      $('#edTitulo').textContent = camisa.nombre;
      estado.editor = {
        id: camisa.id,
        creado: camisa.creado,
        imagenes: [...camisa.imagenes],
        eliminadas: [],
        tallas: new Set(camisa.tallas)
      };
      form.elements.nombre.value = camisa.nombre;
      form.elements.precio.value = camisa.precio;
      form.elements.precio_anterior.value = camisa.precio_anterior || '';
      form.elements.coleccion.value = camisa.coleccion || '';
      form.elements.color.value = camisa.color || '';
      form.elements.descripcion.value = camisa.descripcion || '';
      form.elements.visible.checked = camisa.visible;
      form.elements.destacado.checked = camisa.destacado;
      form.elements.agotado.checked = camisa.agotado;
    } else {
      $('#edEtiqueta').textContent = 'Nueva prenda';
      $('#edTitulo').textContent = 'Nueva camisa';
      estado.editor = {
        id: null,
        creado: null,
        imagenes: [],
        eliminadas: [],
        tallas: new Set(['S', 'M', 'L', 'XL'])
      };
      form.elements.visible.checked = true;
      form.elements.destacado.checked = false;
      form.elements.agotado.checked = false;
    }

    pintarFotosEditor();
    pintarTallasEditor();

    const ed = $('#editor');
    ed.classList.add('abierto');
    ed.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    $('.editor__cuerpo', ed).scrollTop = 0;
    setTimeout(() => form.elements.nombre.focus(), 80);
  }

  function cerrarEditor() {
    const ed = $('#editor');
    if (!ed.classList.contains('abierto')) return;
    ed.classList.remove('abierto');
    ed.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  async function procesarArchivosFotos(archivos) {
    const lista = Array.from(archivos || []).filter((f) => f.type && f.type.startsWith('image/'));
    if (!lista.length) return;
    const zona = $('#zonaSubida');
    const txt = $('.subida__texto', zona);
    const original = txt.innerHTML;
    txt.innerHTML = `<b>Optimizando ${lista.length} foto${lista.length > 1 ? 's' : ''}…</b>`;
    try {
      for (const archivo of lista) {
        const url = await BCDB.subirImagen(archivo);
        estado.editor.imagenes.push(url);
      }
      pintarFotosEditor();
      toast(`${lista.length} foto${lista.length > 1 ? 's' : ''} agregada${lista.length > 1 ? 's' : ''} ✦`);
    } catch (ex) {
      toast(ex.message || 'No se pudo procesar la imagen');
    } finally {
      txt.innerHTML = original;
      $('#inFotos').value = '';
    }
  }

  function iniciarEditor() {
    $('#editor').addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar-editor]')) cerrarEditor();
    });

    // Subida por clic o arrastrar
    $('#inFotos').addEventListener('change', (e) => procesarArchivosFotos(e.target.files));

    const zona = $('#zonaSubida');
    ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.add('arrastrando');
    }));
    ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, (e) => {
      e.preventDefault();
      zona.classList.remove('arrastrando');
    }));
    zona.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files) procesarArchivosFotos(e.dataTransfer.files);
    });

    // Pegar imagen desde el portapapeles (Ctrl+V) mientras el editor está abierto
    document.addEventListener('paste', (e) => {
      if (!$('#editor').classList.contains('abierto')) return;
      const archivos = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
      if (archivos.length) procesarArchivosFotos(archivos);
    });

    // Reordenar y borrar fotos
    const fotosEl = $('#fotos');
    fotosEl.addEventListener('click', (e) => {
      const quitar = e.target.closest('[data-quitar]');
      if (quitar) {
        const idx = Number(quitar.dataset.quitar);
        const [eliminada] = estado.editor.imagenes.splice(idx, 1);
        if (eliminada) estado.editor.eliminadas.push(eliminada);
        pintarFotosEditor();
        return;
      }
      const mover = e.target.closest('[data-mover]');
      if (mover) {
        const idx = Number(mover.dataset.i);
        const dest = idx + Number(mover.dataset.mover);
        const arr = estado.editor.imagenes;
        if (dest < 0 || dest >= arr.length) return;
        [arr[idx], arr[dest]] = [arr[dest], arr[idx]];
        pintarFotosEditor();
      }
    });

    // Drag & drop entre miniaturas
    let dragIdx = null;
    fotosEl.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.foto-item');
      if (!item) return;
      dragIdx = Number(item.dataset.i);
      item.classList.add('arrastrando');
    });
    fotosEl.addEventListener('dragend', (e) => {
      const item = e.target.closest('.foto-item');
      if (item) item.classList.remove('arrastrando');
      dragIdx = null;
    });
    fotosEl.addEventListener('dragover', (e) => e.preventDefault());
    fotosEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const destino = e.target.closest('.foto-item');
      if (!destino || dragIdx === null) return;
      const toIdx = Number(destino.dataset.i);
      if (toIdx === dragIdx) return;
      const [movida] = estado.editor.imagenes.splice(dragIdx, 1);
      estado.editor.imagenes.splice(toIdx, 0, movida);
      dragIdx = null;
      pintarFotosEditor();
    });

    // Selector de tallas
    $('#tallasSel').addEventListener('click', (e) => {
      if (e.target.closest('[data-todas]')) {
        const todas = TALLAS.every((t) => estado.editor.tallas.has(t));
        estado.editor.tallas = todas ? new Set() : new Set(TALLAS);
        pintarTallasEditor();
        return;
      }
      const b = e.target.closest('[data-talla]');
      if (!b) return;
      const t = b.dataset.talla;
      if (estado.editor.tallas.has(t)) estado.editor.tallas.delete(t);
      else estado.editor.tallas.add(t);
      pintarTallasEditor();
    });

    // Guardar camisa
    $('#formCamisa').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const nombre = f.nombre.value.trim();
      const precio = Number(f.precio.value);
      const precioAnt = f.precio_anterior.value ? Number(f.precio_anterior.value) : null;

      if (!nombre) { toast('Escribe el nombre de la camisa'); f.nombre.focus(); return; }
      if (!Number.isFinite(precio) || precio <= 0) { toast('Ingresa un precio válido mayor a 0'); f.precio.focus(); return; }
      if (precioAnt !== null && precioAnt <= precio) {
        toast('El precio anterior debe ser mayor al precio actual para mostrar oferta');
        f.precio_anterior.focus();
        return;
      }

      const btn = $('#btnGuardar');
      btn.disabled = true;
      btn.textContent = 'Guardando…';

      try {
        const camisa = {
          id: estado.editor.id,
          nombre,
          precio,
          precio_anterior: precioAnt,
          coleccion: f.coleccion.value.trim(),
          color: f.color.value.trim(),
          descripcion: f.descripcion.value.trim(),
          tallas: ordenarTallas([...estado.editor.tallas]),
          imagenes: [...estado.editor.imagenes],
          visible: f.visible.checked,
          destacado: f.destacado.checked,
          agotado: f.agotado.checked,
          creado: estado.editor.creado || new Date().toISOString()
        };
        await BCDB.guardar(camisa);
        for (const url of estado.editor.eliminadas) await BCDB.borrarImagen(url);
        await recargarCamisas();
        cerrarEditor();
        toast(estado.editor.id ? 'Camisa actualizada ✦' : 'Camisa publicada en el catálogo ✦');
      } catch (ex) {
        toast(ex.message || 'No se pudo guardar la camisa');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar camisa';
      }
    });
  }

  /* =======================================================
     AJUSTES DE LA TIENDA
     ======================================================= */
  function rellenarAjustes() {
    const f = $('#formAjustes').elements;
    const a = estado.ajustes;
    f.whatsapp.value = a.whatsapp || '';
    f.email.value = a.email || '';
    f.instagram.value = a.instagram || '';
    f.tiktok.value = a.tiktok || '';
    f.moneda.value = a.moneda || 'RD$';
    f.anuncio.value = a.anuncio || '';
    f.manifiesto.value = a.manifiesto || '';
    f.fotosBN.checked = a.fotosBN !== false;
  }

  function iniciarAjustes() {
    $('#formAjustes').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target.elements;
      const nuevos = {
        whatsapp: f.whatsapp.value.replace(/\D/g, ''),
        email: f.email.value.trim(),
        instagram: f.instagram.value.trim(),
        tiktok: f.tiktok.value.trim(),
        moneda: f.moneda.value.trim() || 'RD$',
        anuncio: f.anuncio.value.trim(),
        manifiesto: f.manifiesto.value.trim(),
        fotosBN: f.fotosBN.checked
      };
      try {
        await BCDB.guardarAjustes(nuevos);
        estado.ajustes = { ...estado.ajustes, ...nuevos };
        f.whatsapp.value = nuevos.whatsapp;
        pintarLista();
        toast('Ajustes guardados ✦');
      } catch (ex) {
        toast(ex.message || 'No se pudieron guardar los ajustes');
      }
    });
  }

  /* =======================================================
     DATOS (RESPALDO, RESTAURACIÓN, EJEMPLOS, BORRADO)
     ======================================================= */
  async function accionCargarEjemplos() {
    try {
      const n = await BCDB.cargarEjemplos();
      await recargarCamisas();
      irAVista('camisas');
      toast(`${n} camisas de ejemplo cargadas ✦`);
    } catch (ex) {
      toast(ex.message || 'No se pudieron cargar los ejemplos');
    }
  }

  function iniciarDatos() {
    $('#btnExportar').addEventListener('click', async () => {
      try {
        const datos = await BCDB.exportar();
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `badcake-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast('Respaldo descargado ✦');
      } catch (ex) {
        toast(ex.message || 'No se pudo exportar');
      }
    });

    $('#inImportar').addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      try {
        const texto = await archivo.text();
        const datos = JSON.parse(texto);
        const ok = await confirmar(
          '¿Restaurar este respaldo?',
          `Se importarán ${datos.camisas?.length || 0} camisas y los ajustes incluidos en el archivo.`,
          'Restaurar'
        );
        if (!ok) return;
        const n = await BCDB.importar(datos);
        await recargarTodo();
        irAVista('camisas');
        toast(`Respaldo restaurado (${n} camisas) ✦`);
      } catch (ex) {
        toast('Archivo JSON no válido o dañado');
      }
    });

    $('#btnEjemplos').addEventListener('click', accionCargarEjemplos);

    $('#btnBorrarTodo').addEventListener('click', async () => {
      if (!estado.camisas.length) { toast('El catálogo ya está vacío'); return; }
      const ok = await confirmar(
        '¿Borrar todas las camisas?',
        `Se eliminarán las ${estado.camisas.length} camisas actuales del catálogo. Descarga un respaldo antes si quieres conservarlas.`,
        'Sí, borrar todo'
      );
      if (!ok) return;
      try {
        await BCDB.borrarTodo();
        await recargarCamisas();
        irAVista('camisas');
        toast('Se vació todo el catálogo');
      } catch (ex) {
        toast(ex.message || 'No se pudo borrar el catálogo');
      }
    });
  }

  /* =======================================================
     CARGA Y ARRANQUE
     ======================================================= */
  async function recargarCamisas() {
    estado.camisas = await BCDB.listar({ incluirOcultas: true });
    numerar();
    pintarLista();
  }

  async function recargarTodo() {
    const [camisas, ajustes] = await Promise.all([
      BCDB.listar({ incluirOcultas: true }),
      BCDB.ajustes()
    ]);
    estado.camisas = camisas;
    estado.ajustes = { ...estado.ajustes, ...ajustes };
    numerar();
    pintarLista();
    rellenarAjustes();
  }

  async function iniciar() {
    $('#dlgNo').addEventListener('click', () => cerrarDialogo(false));
    $('#dlgSi').addEventListener('click', () => cerrarDialogo(true));
    $('#dialogo').addEventListener('click', (e) => { if (e.target === $('#dialogo')) cerrarDialogo(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if ($('#dialogo').classList.contains('abierto')) cerrarDialogo(false);
      else if ($('#editor').classList.contains('abierto')) cerrarEditor();
    });

    iniciarLogin();
    iniciarNavegacion();
    iniciarInventario();
    iniciarEditor();
    iniciarAjustes();
    iniciarDatos();

    try {
      await BCDB.init();
      configurarModoUI();
      if (await BCDB.sesion()) await mostrarApp();
      else mostrarLogin();
    } catch (ex) {
      console.error(ex);
      mostrarLogin();
      $('#loginError').textContent = ex.message || 'Error al inicializar la base de datos';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
