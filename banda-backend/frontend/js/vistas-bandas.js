// Vistas: lista de bandas, detalle de una banda (con alta de alumnos) y porcentajes de asistencia.
(function () {
    'use strict';

    var RB = window.RB;
    var h = RB.ui.h;
    RB.vistas = RB.vistas || {};

    function migas(destino, texto) {
        return h('a', { class: 'migas', href: destino }, RB.ui.icono('flecha'), texto);
    }

    function esAdmin() { return RB.sesion.profesor().rol === 'Admin'; }

    // ------------------------------------------------------------------ Lista de bandas
    function bloqueBanda(b) {
        var tipo = b.tipo || 'paz';
        var alumnos = b.total_alumnos;

        return h('article', { class: 'bloque bloque--' + tipo },
            h('div', null,
                RB.ui.icono(tipo, 'bloque__icono'),
                h('h3', { style: 'margin-top:18px;' }, h('a', { href: '#/banda/' + b.id_banda, text: b.nombre_banda })),
                h('p', { class: 'bloque__tipo', text: RB.ui.nombreTipo(tipo) }),
                b.descripcion ? h('p', { class: 'bloque__desc', text: b.descripcion }) : null,
                alumnos !== undefined && alumnos !== null
                    ? h('p', { class: 'bloque__dato', text: alumnos + (alumnos === 1 ? ' alumno' : ' alumnos') })
                    : null
            ),
            h('div', { class: 'bloque__acciones' },
                h('a', { class: 'btn btn--principal btn--grande', href: '#/banda/' + b.id_banda + '/asistencia', text: 'Pasar asistencia' }),
                h('a', { class: 'btn btn--secundario', href: '#/banda/' + b.id_banda + '/porcentajes', text: 'Ver porcentajes' })
            )
        );
    }

    RB.vistas.bandas = async function (ctx) {
        var admin = esAdmin();
        var titulo = admin ? 'Bandas' : 'Mis bandas';

        var cabecera = h('div', { class: 'cabecera-vista' },
            h('div', null,
                h('h1', { tabindex: '-1', text: titulo }),
                h('p', { class: 'subtitulo', text: admin
                    ? 'Todas las bandas de la fundación.'
                    : 'Las bandas en las que das clase. Elige una para pasar asistencia.' })
            ),
            admin
                ? h('div', { class: 'cabecera-vista__acciones' },
                    h('a', { class: 'btn btn--primario', href: '#/admin/banda/nueva' }, RB.ui.icono('mas'), 'Nueva banda'))
                : null
        );

        ctx.montar(ctx.flash(), cabecera, RB.ui.cargando());

        var lista;
        try {
            lista = await RB.datos.bandas();
        } catch (e) { return ctx.error(e); }

        var contenido;
        if (lista.length === 0) {
            contenido = h('div', { class: 'vacio' }, admin
                ? 'Todavía no hay bandas. Crea la primera con "Nueva banda".'
                : 'Todavía no tienes bandas asignadas. Pídele a un administrador que te asigne a una.');
        } else {
            contenido = h('div', { class: 'rejilla-bandas' }, lista.map(bloqueBanda));
        }

        ctx.montar(ctx.flash(), cabecera, contenido);
    };

    // ------------------------------------------------------------------ Detalle de una banda
    RB.vistas.banda = async function (ctx) {
        var id = Number(ctx.params[0]);
        ctx.montar(ctx.flash(), migas('#/bandas', 'Bandas'), RB.ui.cargando());

        var banda, alumnos;
        try {
            var r = await Promise.all([RB.datos.banda(id), RB.datos.alumnosDeBanda(id)]);
            banda = r[0]; alumnos = r[1];
        } catch (e) { return ctx.error(e, '#/bandas'); }

        var admin = esAdmin();
        var tipo = banda.tipo || 'paz';

        var cabecera = h('div', { class: 'cabecera-vista' },
            h('div', null,
                h('h1', { tabindex: '-1', text: banda.nombre_banda }),
                h('p', { class: 'subtitulo', text: RB.ui.nombreTipo(tipo) + (banda.descripcion ? ' · ' + banda.descripcion : '') })
            )
        );

        var acciones = h('div', { class: 'cabecera-vista__acciones', style: 'margin-bottom:8px;' },
            h('a', { class: 'btn btn--primario btn--grande', href: '#/banda/' + id + '/asistencia', text: 'Pasar asistencia' }),
            h('a', { class: 'btn btn--grande', href: '#/banda/' + id + '/porcentajes', text: 'Ver porcentajes' }),
            admin ? h('a', { class: 'btn', href: '#/admin/banda/' + id + '/editar', text: 'Editar banda' }) : null,
            admin ? h('a', { class: 'btn', href: '#/admin/banda/' + id + '/profesores', text: 'Profesores de la banda' }) : null
        );

        var listaAlumnos = alumnos.length === 0
            ? h('div', { class: 'vacio', text: 'Esta banda todavía no tiene alumnos. Agrégalos abajo para poder pasar asistencia.' })
            : h('ul', { class: 'lista' }, alumnos.map(function (a) {
                return h('li', { class: 'fila' }, h('div', { class: 'fila__texto' }, h('div', { class: 'fila__titulo', text: a.nombre })));
            }));

        ctx.montar(
            ctx.flash(),
            migas('#/bandas', 'Bandas'),
            cabecera,
            acciones,
            h('section', { class: 'seccion' },
                h('h2', { text: 'Alumnos (' + alumnos.length + ')' }),
                listaAlumnos,
                formularioAlumno(ctx, id)
            )
        );
    };

    // Alta de un alumno directamente en esta banda (POST /alumnos con bandas: [id])
    function formularioAlumno(ctx, idBanda) {
        var avisos = h('div', { 'aria-live': 'polite' });
        var nombre = h('input', { id: 'al-nombre', type: 'text', maxlength: '150', autocomplete: 'off', required: true });
        var telefono = h('input', { id: 'al-telefono', type: 'tel', maxlength: '30', inputmode: 'tel', autocomplete: 'off' });
        var direccion = h('input', { id: 'al-direccion', type: 'text', maxlength: '255', autocomplete: 'off' });
        var enviar = h('button', { type: 'submit', class: 'btn btn--primario', text: 'Agregar alumno' });

        var form = h('form', { novalidate: true },
            avisos,
            h('div', { class: 'campo' }, h('label', { for: 'al-nombre', text: 'Nombre completo' }), nombre),
            h('div', { class: 'fila-campos' },
                h('div', { class: 'campo' },
                    h('label', { for: 'al-telefono', text: 'Teléfono (opcional)' }), telefono,
                    h('span', { class: 'ayuda', text: 'Mínimo 8 caracteres si lo escribes.' })),
                h('div', { class: 'campo' }, h('label', { for: 'al-direccion', text: 'Dirección (opcional)' }), direccion)
            ),
            enviar
        );

        form.addEventListener('submit', async function (evento) {
            evento.preventDefault();
            if (enviar.disabled) return;

            if (!nombre.value.trim()) {
                avisos.replaceChildren(RB.ui.aviso('error', 'El nombre del alumno es obligatorio'));
                nombre.focus();
                return;
            }

            var cuerpo = { nombre: nombre.value.trim(), bandas: [idBanda] };
            if (telefono.value.trim()) cuerpo.telefono = telefono.value.trim();
            if (direccion.value.trim()) cuerpo.direccion = direccion.value.trim();

            enviar.disabled = true;
            enviar.textContent = 'Guardando…';
            avisos.replaceChildren();

            try {
                await RB.api('POST', '/alumnos', { cuerpo: cuerpo });
                ctx.recargar('ok', 'Alumno agregado: ' + cuerpo.nombre);
            } catch (e) {
                if (e.status === 401) return;
                avisos.replaceChildren(RB.ui.aviso('error', e.message));
                enviar.disabled = false;
                enviar.textContent = 'Agregar alumno';
            }
        });

        return h('details', { class: 'desplegable' },
            h('summary', { text: 'Agregar alumno a esta banda' }),
            h('div', { class: 'desplegable__cuerpo' }, form)
        );
    }

    // ------------------------------------------------------------------ Porcentajes de asistencia
    function filaPorcentaje(a, dato) {
        var nombre = h('span', { class: 'alumno-pct__nombre' }, a.nombre);

        if (!dato) {
            return h('li', { class: 'alumno-pct alumno-pct--sin-datos' },
                nombre,
                h('span', { class: 'alumno-pct__valor', text: 'Sin registros' }),
                h('span', { class: 'alumno-pct__detalle', text: 'Todavía no tiene asistencias registradas en esta banda.' })
            );
        }

        var pct = Math.max(0, Math.min(100, Number(dato.porcentaje_asistencia) || 0));
        var minimo = dato.porcentaje_minimo_requerido;

        if (dato.en_riesgo) nombre.appendChild(h('span', { class: 'alumno-pct__alerta', text: 'En riesgo' }));

        var barra = h('div', { class: 'alumno-pct__barra', role: 'img', 'aria-label': RB.ui.numero(pct) + ' por ciento de asistencia' },
            h('span', { style: 'width:' + pct + '%;' }),
            minimo !== null && minimo !== undefined
                ? h('i', { class: 'alumno-pct__marca', style: 'left:' + Math.max(0, Math.min(100, Number(minimo))) + '%;', title: 'Mínimo ' + minimo + ' %' })
                : null
        );

        return h('li', { class: 'alumno-pct' + (dato.en_riesgo ? ' alumno-pct--riesgo' : '') },
            nombre,
            h('span', { class: 'alumno-pct__valor' }, RB.ui.numero(pct), h('small', { text: ' %' })),
            barra,
            h('span', { class: 'alumno-pct__detalle',
                text: dato.total_asistencias + ' de ' + dato.total_eventos + (dato.total_eventos === 1 ? ' registro' : ' registros') +
                    (minimo !== null && minimo !== undefined ? ' · mínimo requerido ' + RB.ui.numero(minimo) + ' %' : '') })
        );
    }

    RB.vistas.porcentajes = async function (ctx) {
        var id = Number(ctx.params[0]);
        ctx.montar(migas('#/banda/' + id, 'Banda'), RB.ui.cargando());

        var banda, alumnos, porcentajes;
        try {
            var r = await Promise.all([
                RB.datos.banda(id),
                RB.datos.alumnosDeBanda(id),
                RB.api('GET', '/asistencia/porcentaje', { query: { id_banda: id } })
            ]);
            banda = r[0]; alumnos = r[1]; porcentajes = r[2].datos;
        } catch (e) { return ctx.error(e, '#/banda/' + id); }

        var porAlumno = new Map(porcentajes.map(function (p) { return [p.id_alumno, p]; }));

        // Primero los que están en riesgo, luego los demás por nombre (la lista de la API ya viene por nombre)
        var filas = alumnos.map(function (a) { return { alumno: a, dato: porAlumno.get(a.id_alumno) || null }; });
        filas.sort(function (x, y) {
            var rx = x.dato && x.dato.en_riesgo ? 0 : 1, ry = y.dato && y.dato.en_riesgo ? 0 : 1;
            return rx - ry;
        });

        var enRiesgo = filas.filter(function (f) { return f.dato && f.dato.en_riesgo; }).length;
        var conDatos = filas.filter(function (f) { return f.dato; });
        var minimo = conDatos.length && conDatos[0].dato.porcentaje_minimo_requerido;

        ctx.montar(
            migas('#/banda/' + id, banda.nombre_banda),
            h('div', { class: 'cabecera-vista' },
                h('div', null,
                    h('h1', { tabindex: '-1', text: 'Porcentaje de asistencia' }),
                    h('p', { class: 'subtitulo', text: banda.nombre_banda })
                )
            ),
            filas.length === 0
                ? h('div', { class: 'vacio', text: 'Esta banda todavía no tiene alumnos.' })
                : [
                    h('div', { class: 'resumen-pct' },
                        h('span', null, h('strong', { text: String(filas.length) }), filas.length === 1 ? ' alumno' : ' alumnos'),
                        h('span', null, h('strong', { text: String(enRiesgo) }), ' en riesgo'),
                        minimo ? h('span', null, h('strong', { text: RB.ui.numero(minimo) + ' %' }), ' mínimo requerido') : null
                    ),
                    h('ul', { class: 'lista' }, filas.map(function (f) { return filaPorcentaje(f.alumno, f.dato); }))
                ]
        );
    };
})();
