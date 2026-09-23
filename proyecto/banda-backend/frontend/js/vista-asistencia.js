// Vista "Pasar asistencia" de un ensayo → POST /api/asistencia/ensayo
(function () {
    'use strict';

    var RB = window.RB;
    var h = RB.ui.h;
    RB.vistas = RB.vistas || {};

    // Borrador: si se recarga la página a mitad del ensayo, no se pierden las marcas ya hechas.
    function claveBorrador(idBanda) {
        return 'rb_borrador_asistencia_' + RB.sesion.profesor().id_profesor + '_' + idBanda;
    }
    function leerBorrador(idBanda) {
        try { return JSON.parse(window.sessionStorage.getItem(claveBorrador(idBanda))) || []; } catch (e) { return []; }
    }
    function guardarBorrador(idBanda, presentes) {
        try { window.sessionStorage.setItem(claveBorrador(idBanda), JSON.stringify(Array.from(presentes))); } catch (e) { /* nada */ }
    }
    function borrarBorrador(idBanda) {
        try { window.sessionStorage.removeItem(claveBorrador(idBanda)); } catch (e) { /* nada */ }
    }

    RB.vistas.asistencia = async function (ctx) {
        var idBanda = Number(ctx.params[0]);
        var volver = h('a', { class: 'migas', href: '#/banda/' + idBanda }, RB.ui.icono('flecha'), 'Banda');

        ctx.montar(volver, RB.ui.cargando());

        var banda, alumnos;
        try {
            var r = await Promise.all([RB.datos.banda(idBanda), RB.datos.alumnosDeBanda(idBanda)]);
            banda = r[0]; alumnos = r[1];
        } catch (e) { return ctx.error(e, '#/bandas'); }

        var idsValidos = new Set(alumnos.map(function (a) { return a.id_alumno; }));
        var presentes = new Set(leerBorrador(idBanda).filter(function (id) { return idsValidos.has(id); }));
        var enviando = false;

        // ---------- lista de alumnos: cada fila completa es un interruptor grande ----------
        var filas = new Map();

        function pintarFila(id) {
            var boton = filas.get(id);
            var activo = presentes.has(id);
            boton.setAttribute('aria-checked', String(activo));
            boton.lastChild.replaceChildren(
                RB.ui.icono(activo ? 'check' : 'cruz'),
                h('span', { text: activo ? 'Presente' : 'Ausente' })
            );
        }

        function alternar(id) {
            if (enviando) return;
            if (presentes.has(id)) presentes.delete(id); else presentes.add(id);
            pintarFila(id);
            guardarBorrador(idBanda, presentes);
            actualizarConteo();
        }

        var lista = h('ul', { class: 'asistencia-lista' }, alumnos.map(function (a) {
            var boton = h('button', { type: 'button', class: 'asistencia-fila', role: 'switch', 'aria-checked': 'false' },
                h('span', { class: 'asistencia-fila__nombre', text: a.nombre }),
                h('span', { class: 'asistencia-fila__estado' })
            );
            boton.addEventListener('click', function () { alternar(a.id_alumno); });
            filas.set(a.id_alumno, boton);
            pintarFila(a.id_alumno);
            return h('li', null, boton);
        }));

        // ---------- datos opcionales del ensayo ----------
        var campoFecha = h('input', { id: 'as-fecha', type: 'date', value: RB.ui.hoy(), required: true });
        var campoHora = h('input', { id: 'as-hora', type: 'time' });
        var campoLugar = h('input', { id: 'as-lugar', type: 'text', maxlength: '150', autocomplete: 'off' });
        var campoDescripcion = h('input', { id: 'as-descripcion', type: 'text', autocomplete: 'off', placeholder: 'Ej. Ensayo semanal' });

        var datosEnsayo = h('details', { class: 'desplegable', style: 'margin-top:0;margin-bottom:20px;' },
            h('summary', { text: 'Datos del ensayo' }),
            h('div', { class: 'desplegable__cuerpo' },
                h('div', { class: 'fila-campos' },
                    h('div', { class: 'campo' }, h('label', { for: 'as-fecha', text: 'Fecha' }), campoFecha),
                    h('div', { class: 'campo' }, h('label', { for: 'as-hora', text: 'Hora (opcional)' }), campoHora)
                ),
                h('div', { class: 'campo' }, h('label', { for: 'as-lugar', text: 'Lugar (opcional)' }), campoLugar),
                h('div', { class: 'campo' }, h('label', { for: 'as-descripcion', text: 'Descripción (opcional)' }), campoDescripcion)
            )
        );

        // ---------- barra fija de envío ----------
        var conteo = h('div', { class: 'barra-envio__conteo', 'aria-live': 'polite' });
        var botonEnviar = h('button', { type: 'button', class: 'btn btn--grande btn--completo' }, 'Enviar asistencia');
        var barra = h('div', { class: 'barra-envio sobre-oscuro' }, conteo, botonEnviar);
        var avisos = h('div', { 'aria-live': 'polite' });

        function actualizarConteo() {
            conteo.replaceChildren(h('strong', { text: String(presentes.size) }), ' de ' + alumnos.length + (alumnos.length === 1 ? ' presente' : ' presentes'));
        }
        actualizarConteo();

        function todos(marcar) {
            if (enviando) return;
            alumnos.forEach(function (a) { if (marcar) presentes.add(a.id_alumno); else presentes.delete(a.id_alumno); pintarFila(a.id_alumno); });
            guardarBorrador(idBanda, presentes);
            actualizarConteo();
        }

        // ---------- envío ----------
        function bloquear(bloqueado) {
            enviando = bloqueado;
            botonEnviar.disabled = bloqueado;
            botonEnviar.textContent = bloqueado ? 'Enviando…' : 'Enviar asistencia';
        }

        async function enviar() {
            if (enviando) return; // un segundo toque crearía un segundo ensayo

            if (!campoFecha.value) {
                datosEnsayo.open = true;
                avisos.replaceChildren(RB.ui.aviso('error', 'Indica la fecha del ensayo.'));
                campoFecha.focus();
                return;
            }
            if (presentes.size === 0 && !window.confirm('No marcaste a nadie como presente. ¿Enviar el ensayo con todos ausentes?')) return;

            var cuerpo = {
                id_banda: idBanda,
                fecha: campoFecha.value,
                asistencias: alumnos.map(function (a) { return { id_alumno: a.id_alumno, asistio: presentes.has(a.id_alumno) }; })
            };
            if (campoHora.value) cuerpo.hora = campoHora.value;
            if (campoLugar.value.trim()) cuerpo.lugar = campoLugar.value.trim();
            if (campoDescripcion.value.trim()) cuerpo.descripcion = campoDescripcion.value.trim();

            avisos.replaceChildren();
            bloquear(true);

            try {
                var respuesta = await RB.api('POST', '/asistencia/ensayo', { cuerpo: cuerpo });
                borrarBorrador(idBanda);
                mostrarConfirmacion(respuesta);
            } catch (e) {
                if (e.status === 401) return;
                bloquear(false);
                avisos.replaceChildren(RB.ui.aviso('error', e.message));
                avisos.scrollIntoView({ block: 'center' });
            }
        }
        botonEnviar.addEventListener('click', enviar);

        function mostrarConfirmacion(respuesta) {
            var omitidos = (respuesta.omitidos || []).map(function (id) {
                var a = alumnos.find(function (x) { return x.id_alumno === id; });
                return a ? a.nombre : '#' + id;
            });

            ctx.montar(
                h('h1', { tabindex: '-1', class: 'solo-lectores', text: 'Asistencia guardada' }),
                h('div', { class: 'confirmacion', role: 'status' },
                    h('h2', { text: 'Asistencia guardada' }),
                    h('p', { text: banda.nombre_banda + ' · ' + campoFecha.value }),
                    h('span', { class: 'numero', text: presentes.size + ' de ' + alumnos.length }),
                    h('p', { text: presentes.size === 1 ? 'alumno presente.' : 'alumnos presentes.' }),
                    omitidos.length
                        ? h('p', { style: 'margin-top:14px;', text: 'No se registraron (ya no pertenecen a la banda): ' + omitidos.join(', ') + '.' })
                        : null,
                    h('div', { class: 'confirmacion__botones' },
                        h('a', { class: 'btn btn--oscuro btn--grande', href: '#/banda/' + idBanda + '/porcentajes', text: 'Ver porcentajes' }),
                        h('a', { class: 'btn btn--grande', href: '#/bandas', text: 'Volver a las bandas' })
                    )
                )
            );
            var titulo = document.querySelector('#vista h1');
            if (titulo) titulo.focus();
        }

        // ---------- pantalla ----------
        ctx.montar(
            ctx.flash(),
            volver,
            h('div', { class: 'asistencia-encabezado' },
                h('h1', { tabindex: '-1', text: 'Pasar asistencia' }),
                h('p', { class: 'subtitulo', text: banda.nombre_banda + ' · toca a cada alumno para marcarlo como presente.' })
            ),
            alumnos.length === 0
                ? h('div', { class: 'vacio' },
                    'Esta banda no tiene alumnos todavía. ',
                    h('a', { href: '#/banda/' + idBanda, style: 'text-decoration:underline;', text: 'Agrégalos desde la banda' }),
                    ' para poder pasar asistencia.')
                : [
                    datosEnsayo,
                    h('div', { class: 'asistencia-herramientas' },
                        h('button', { type: 'button', class: 'btn', onclick: function () { todos(true); }, text: 'Todos presentes' }),
                        h('button', { type: 'button', class: 'btn', onclick: function () { todos(false); }, text: 'Limpiar' })
                    ),
                    lista,
                    avisos,
                    barra
                ]
        );
    };
})();
