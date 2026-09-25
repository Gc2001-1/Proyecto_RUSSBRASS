// Vista solo para Admin: publicar, editar y desactivar entradas del blog público (blog.html).
// Todo se actualiza en el lugar: publicar o desactivar no vuelve a montar la vista ni mueve el scroll.
(function () {
    'use strict';

    var RB = window.RB;
    var h = RB.ui.h;
    RB.vistas = RB.vistas || {};

    // Los mismos límites que valida la API (src/utils/validaciones.js y src/config/upload.js)
    var LIMITES = { titulo: 150, resumen: 2000, enlace_facebook: 500 };
    var TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
    var TAMANO_MAXIMO = 5 * 1024 * 1024;

    function urlValida(texto) {
        try {
            var url = new URL(texto);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    // "2026-09-24" -> "24 de septiembre de 2026", sin que la zona horaria lo corra un día
    function fechaLegible(fecha) {
        var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''));
        if (!p) return '';
        return new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]))
            .toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    RB.vistas.blog = async function (ctx) {
        var cabecera = h('div', { class: 'cabecera-vista' },
            h('div', null,
                h('h1', { tabindex: '-1', text: 'Blog' }),
                h('p', { class: 'subtitulo', text: 'Entradas del blog público. Lo que publiques aquí aparece de inmediato en la página del blog.' })
            ),
            h('div', { class: 'cabecera-vista__acciones' },
                h('a', { class: 'btn', href: 'blog.html', target: '_blank', rel: 'noopener', text: 'Ver el blog público' }))
        );

        ctx.montar(cabecera, RB.ui.cargando());

        var entradas;
        try { entradas = await RB.api('GET', '/blog'); } catch (e) { return ctx.error(e); }

        var editandoId = null;

        // ---------- formulario ----------
        var avisosForm = h('div', { 'aria-live': 'polite' });
        var tituloForm = h('h2', { text: 'Publicar entrada' });
        var titulo = h('input', { id: 'bl-titulo', type: 'text', maxlength: String(LIMITES.titulo), autocomplete: 'off', required: true });
        var resumen = h('textarea', { id: 'bl-resumen', rows: '5', maxlength: String(LIMITES.resumen), required: true });
        var foto = h('input', { id: 'bl-foto', type: 'file', accept: TIPOS_FOTO.join(',') });
        var ayudaFoto = h('span', { class: 'ayuda' });
        var enlace = h('input', { id: 'bl-enlace', type: 'url', maxlength: String(LIMITES.enlace_facebook), inputmode: 'url', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'https://www.facebook.com/…' });
        var ayudaEnlace = h('span', { class: 'ayuda' });
        var fecha = h('input', { id: 'bl-fecha', type: 'date' });
        var botonEnviar = h('button', { type: 'submit', class: 'btn btn--primario' });
        var botonCancelar = h('button', { type: 'button', class: 'btn', text: 'Cancelar edición' });

        var form = h('form', { class: 'formulario', novalidate: true },
            avisosForm,
            h('div', { class: 'campo' }, h('label', { for: 'bl-titulo', text: 'Título' }), titulo),
            h('div', { class: 'campo' }, h('label', { for: 'bl-resumen', text: 'Resumen' }), resumen),
            h('div', { class: 'campo' }, h('label', { for: 'bl-foto', text: 'Foto (opcional)' }), foto, ayudaFoto),
            h('div', { class: 'fila-campos' },
                h('div', { class: 'campo' }, h('label', { for: 'bl-enlace', text: 'Enlace a Facebook (opcional)' }), enlace, ayudaEnlace),
                h('div', { class: 'campo' }, h('label', { for: 'bl-fecha', text: 'Fecha (opcional)' }), fecha,
                    h('span', { class: 'ayuda', text: 'Si la dejas vacía se usa la fecha de hoy.' }))
            ),
            h('div', { class: 'formulario__botones' }, botonEnviar, botonCancelar)
        );

        // Modo publicar (entrada = null) o editar (entrada = la que se va a editar)
        function prepararFormulario(entrada) {
            editandoId = entrada ? entrada.id_entrada : null;
            form.reset();
            titulo.value = entrada ? entrada.titulo : '';
            resumen.value = entrada ? entrada.resumen : '';
            enlace.value = entrada && entrada.enlace_facebook ? entrada.enlace_facebook : '';
            fecha.value = entrada ? entrada.fecha : RB.ui.hoy();
            tituloForm.textContent = entrada ? 'Editar entrada' : 'Publicar entrada';
            botonEnviar.textContent = entrada ? 'Guardar cambios' : 'Publicar entrada';
            botonCancelar.hidden = !entrada;
            ayudaFoto.textContent = entrada
                ? 'JPG, PNG o WEBP, máximo 5 MB. Déjala vacía para conservar la foto actual.'
                : 'JPG, PNG o WEBP, máximo 5 MB.';
            // PUT /blog/:id conserva el enlace actual si llega vacío: no hay forma de quitarlo desde aquí
            ayudaEnlace.textContent = entrada && entrada.enlace_facebook
                ? 'Si lo dejas vacío se conserva el enlace actual.'
                : 'Debe empezar con https://';
        }

        function validar() {
            if (!titulo.value.trim()) return { campo: titulo, mensaje: 'El título es obligatorio' };
            if (!resumen.value.trim()) return { campo: resumen, mensaje: 'El resumen es obligatorio' };
            if (titulo.value.trim().length > LIMITES.titulo) return { campo: titulo, mensaje: 'El título no puede pasar de ' + LIMITES.titulo + ' caracteres' };
            if (resumen.value.trim().length > LIMITES.resumen) return { campo: resumen, mensaje: 'El resumen no puede pasar de ' + LIMITES.resumen + ' caracteres' };

            var archivo = foto.files && foto.files[0];
            if (archivo) {
                if (TIPOS_FOTO.indexOf(archivo.type) === -1) return { campo: foto, mensaje: 'La foto debe ser JPG, PNG o WEBP' };
                if (archivo.size > TAMANO_MAXIMO) return { campo: foto, mensaje: 'La foto no puede superar los 5 MB' };
            }

            var textoEnlace = enlace.value.trim();
            if (textoEnlace && !urlValida(textoEnlace)) return { campo: enlace, mensaje: 'El enlace a Facebook debe ser una dirección web completa (https://…)' };
            if (textoEnlace.length > LIMITES.enlace_facebook) return { campo: enlace, mensaje: 'El enlace no puede pasar de ' + LIMITES.enlace_facebook + ' caracteres' };

            return null;
        }

        function datosFormulario() {
            var datos = new FormData();
            datos.append('titulo', titulo.value.trim());
            datos.append('resumen', resumen.value.trim());
            if (enlace.value.trim()) datos.append('enlace_facebook', enlace.value.trim());
            if (fecha.value) datos.append('fecha', fecha.value);
            if (foto.files && foto.files[0]) datos.append('foto', foto.files[0]);
            return datos;
        }

        function bloquearFormulario(bloqueado) {
            botonEnviar.disabled = bloqueado;
            botonCancelar.disabled = bloqueado;
            botonEnviar.textContent = bloqueado ? 'Guardando…' : (editandoId ? 'Guardar cambios' : 'Publicar entrada');
        }

        function avisarEnFormulario(tipo, texto) {
            avisosForm.replaceChildren(RB.ui.aviso(tipo, texto));
            avisosForm.scrollIntoView({ block: 'nearest' });
        }

        form.addEventListener('submit', async function (evento) {
            evento.preventDefault();
            if (botonEnviar.disabled) return; // evita el doble envío

            var error = validar();
            if (error) {
                avisarEnFormulario('error', error.mensaje);
                error.campo.focus({ preventScroll: true });
                return;
            }

            var id = editandoId;
            bloquearFormulario(true);
            avisosForm.replaceChildren();

            try {
                var respuesta = id
                    ? await RB.api('PUT', '/blog/' + id, { formulario: datosFormulario() })
                    : await RB.api('POST', '/blog', { formulario: datosFormulario() });

                var guardada = respuesta.entrada;
                var i = entradas.findIndex(function (x) { return x.id_entrada === guardada.id_entrada; });
                if (i >= 0) entradas[i] = guardada; else entradas.unshift(guardada);
                ordenar();
                pintarLista();

                prepararFormulario(null);
                bloquearFormulario(false);
                avisarEnFormulario('ok', (id ? 'Entrada actualizada: ' : 'Entrada publicada: ') + guardada.titulo);
            } catch (e) {
                if (e.status === 401) return;
                bloquearFormulario(false);
                avisarEnFormulario('error', e.message);
            }
        });

        botonCancelar.addEventListener('click', function () {
            prepararFormulario(null);
            avisosForm.replaceChildren();
        });

        // ---------- lista ----------
        var avisosLista = h('div', { 'aria-live': 'polite' });
        var tituloLista = h('h2');
        var contenedorLista = h('div');

        // Mismo orden que la API: fecha más reciente primero y, a igual fecha, la última creada
        function ordenar() {
            entradas.sort(function (a, b) {
                if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
                return b.id_entrada - a.id_entrada;
            });
        }

        async function desactivar(entrada, botones) {
            if (!window.confirm('¿Desactivar "' + entrada.titulo + '"? Dejará de verse en el blog público.')) return;

            botones.forEach(function (b) { b.disabled = true; });
            avisosLista.replaceChildren();

            try {
                await RB.api('DELETE', '/blog/' + entrada.id_entrada);
                entradas = entradas.filter(function (x) { return x.id_entrada !== entrada.id_entrada; });
                if (editandoId === entrada.id_entrada) prepararFormulario(null);
                pintarLista();
                avisosLista.replaceChildren(RB.ui.aviso('ok', 'Entrada desactivada: ' + entrada.titulo));
            } catch (e) {
                if (e.status === 401) return;
                botones.forEach(function (b) { b.disabled = false; });
                avisosLista.replaceChildren(RB.ui.aviso('error', e.message));
            }
        }

        function pintarLista() {
            tituloLista.textContent = 'Entradas publicadas (' + entradas.length + ')';

            if (entradas.length === 0) {
                contenedorLista.replaceChildren(h('div', { class: 'vacio', text: 'Todavía no hay entradas publicadas.' }));
                return;
            }

            contenedorLista.replaceChildren(h('ul', { class: 'lista' }, entradas.map(function (entrada) {
                var detalle = [fechaLegible(entrada.fecha), entrada.foto ? 'Con foto' : 'Sin foto'];
                if (entrada.enlace_facebook) detalle.push('Con enlace a Facebook');

                var botonEditar = h('button', { type: 'button', class: 'btn', text: 'Editar' });
                var botonDesactivar = h('button', { type: 'button', class: 'btn', text: 'Desactivar' });
                botonEditar.setAttribute('aria-label', 'Editar "' + entrada.titulo + '"');
                botonDesactivar.setAttribute('aria-label', 'Desactivar "' + entrada.titulo + '"');

                botonEditar.addEventListener('click', function () {
                    prepararFormulario(entrada);
                    avisosForm.replaceChildren();
                    form.scrollIntoView({ block: 'start', behavior: 'smooth' });
                    titulo.focus({ preventScroll: true });
                });
                botonDesactivar.addEventListener('click', function () {
                    desactivar(entrada, [botonEditar, botonDesactivar]);
                });

                return h('li', { class: 'fila' },
                    h('div', { class: 'fila__texto' },
                        h('div', { class: 'fila__titulo', text: entrada.titulo }),
                        h('div', { class: 'fila__detalle', text: detalle.join(' · ') })
                    ),
                    h('div', { class: 'cabecera-vista__acciones' }, botonEditar, botonDesactivar)
                );
            })));
        }

        prepararFormulario(null);
        ordenar();
        pintarLista();

        ctx.montar(
            cabecera,
            h('section', { class: 'seccion' }, tituloForm, form),
            h('section', { class: 'seccion' },
                tituloLista,
                h('p', { class: 'texto-secundario', style: 'margin:0 0 16px;font-size:14.5px;',
                    text: 'Las entradas desactivadas dejan de verse en el blog y no aparecen en esta lista.' }),
                avisosLista,
                contenedorLista
            )
        );
    };
})();
