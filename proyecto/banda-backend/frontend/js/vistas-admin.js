// Vistas solo para Admin: bandas (crear/editar), profesores (listar/crear/editar) y asignación de profesores a bandas.
(function () {
    'use strict';

    var RB = window.RB;
    var h = RB.ui.h;
    RB.vistas = RB.vistas || {};

    function migas(destino, texto) {
        return h('a', { class: 'migas', href: destino }, RB.ui.icono('flecha'), texto);
    }

    // Envía un formulario: bloquea el botón, muestra el error de la API tal cual, y llama a `alExito` si sale bien.
    function enviarFormulario(opciones) {
        var form = opciones.form, boton = opciones.boton, avisos = opciones.avisos, textoBoton = opciones.textoBoton;

        form.addEventListener('submit', async function (evento) {
            evento.preventDefault();
            if (boton.disabled) return;

            var error = opciones.validar && opciones.validar();
            if (error) { avisos.replaceChildren(RB.ui.aviso('error', error)); return; }

            boton.disabled = true;
            boton.textContent = 'Guardando…';
            avisos.replaceChildren();

            try {
                var respuesta = await opciones.enviar();
                opciones.alExito(respuesta);
            } catch (e) {
                if (e.status === 401) return;
                avisos.replaceChildren(RB.ui.aviso('error', e.message));
                avisos.scrollIntoView({ block: 'nearest' });
                boton.disabled = false;
                boton.textContent = textoBoton;
            }
        });
    }

    // ------------------------------------------------------------------ Banda: crear / editar
    RB.vistas.bandaForm = async function (ctx) {
        var id = ctx.params[0] ? Number(ctx.params[0]) : null;
        var editando = id !== null;
        var destinoVolver = editando ? '#/banda/' + id : '#/bandas';

        ctx.montar(migas(destinoVolver, 'Volver'), RB.ui.cargando());

        var banda = null;
        if (editando) {
            try { banda = await RB.datos.banda(id); } catch (e) { return ctx.error(e, '#/bandas'); }
        }

        var avisos = h('div', { 'aria-live': 'polite' });
        var nombre = h('input', { id: 'b-nombre', type: 'text', maxlength: '150', autocomplete: 'off', required: true, value: banda ? banda.nombre_banda : '' });
        var tipo = h('select', { id: 'b-tipo', required: true },
            Object.keys(RB.ui.TIPOS).map(function (valor) {
                return h('option', { value: valor, selected: banda && banda.tipo === valor, text: RB.ui.TIPOS[valor] });
            })
        );
        var descripcion = h('textarea', { id: 'b-descripcion', rows: '3' });
        descripcion.value = banda && banda.descripcion ? banda.descripcion : '';
        var boton = h('button', { type: 'submit', class: 'btn btn--primario', text: editando ? 'Guardar cambios' : 'Crear banda' });

        var form = h('form', { class: 'formulario', novalidate: true },
            avisos,
            h('div', { class: 'campo' }, h('label', { for: 'b-nombre', text: 'Nombre de la banda' }), nombre),
            h('div', { class: 'campo' }, h('label', { for: 'b-tipo', text: 'Tipo' }), tipo),
            h('div', { class: 'campo' }, h('label', { for: 'b-descripcion', text: 'Descripción (opcional)' }), descripcion),
            h('div', { class: 'formulario__botones' }, boton, h('a', { class: 'btn', href: destinoVolver, text: 'Cancelar' }))
        );

        enviarFormulario({
            form: form, boton: boton, avisos: avisos, textoBoton: boton.textContent,
            validar: function () { return nombre.value.trim() ? null : 'El nombre de la banda es obligatorio'; },
            enviar: function () {
                var cuerpo = { nombre_banda: nombre.value.trim(), tipo: tipo.value, descripcion: descripcion.value.trim() };
                return editando ? RB.api('PUT', '/bandas/' + id, { cuerpo: cuerpo }) : RB.api('POST', '/bandas', { cuerpo: cuerpo });
            },
            alExito: function (respuesta) {
                ctx.irA('#/banda/' + respuesta.banda.id_banda, 'ok', editando ? 'Banda actualizada.' : 'Banda creada.');
            }
        });

        ctx.montar(
            migas(destinoVolver, 'Volver'),
            h('div', { class: 'cabecera-vista' }, h('h1', { tabindex: '-1', text: editando ? 'Editar banda' : 'Nueva banda' })),
            form
        );
    };

    // ------------------------------------------------------------------ Profesores: lista
    RB.vistas.profesores = async function (ctx) {
        var cabecera = h('div', { class: 'cabecera-vista' },
            h('div', null,
                h('h1', { tabindex: '-1', text: 'Profesores' }),
                h('p', { class: 'subtitulo', text: 'Cuentas con acceso al panel. Para que un profesor vea una banda, asígnalo desde la banda.' })
            ),
            h('div', { class: 'cabecera-vista__acciones' },
                h('a', { class: 'btn btn--primario', href: '#/admin/profesor/nuevo' }, RB.ui.icono('mas'), 'Nuevo profesor'))
        );

        ctx.montar(ctx.flash(), cabecera, RB.ui.cargando());

        var profesores;
        try { profesores = await RB.api('GET', '/profesores'); } catch (e) { return ctx.error(e); }

        ctx.montar(
            ctx.flash(),
            cabecera,
            profesores.length === 0
                ? h('div', { class: 'vacio', text: 'No hay profesores registrados.' })
                : h('ul', { class: 'lista' }, profesores.map(function (p) {
                    return h('li', { class: 'fila' },
                        h('div', { class: 'fila__texto' },
                            h('div', { class: 'fila__titulo' },
                                p.nombre,
                                h('span', { class: 'etiqueta-rol' + (p.rol === 'Admin' ? ' etiqueta-rol--admin' : ''), text: p.rol })),
                            h('div', { class: 'fila__detalle', text: p.correo })
                        ),
                        h('a', { class: 'btn', href: '#/admin/profesor/' + p.id_profesor + '/editar', text: 'Editar' })
                    );
                }))
        );
    };

    // ------------------------------------------------------------------ Profesor: crear / editar
    RB.vistas.profesorForm = async function (ctx) {
        var id = ctx.params[0] ? Number(ctx.params[0]) : null;
        var editando = id !== null;
        var soyYo = editando && id === RB.sesion.profesor().id_profesor;

        ctx.montar(migas('#/admin/profesores', 'Profesores'), RB.ui.cargando());

        var profesor = null;
        if (editando) {
            try { profesor = await RB.api('GET', '/profesores/' + id); } catch (e) { return ctx.error(e, '#/admin/profesores'); }
        }

        var avisos = h('div', { 'aria-live': 'polite' });
        var nombre = h('input', { id: 'p-nombre', type: 'text', maxlength: '150', autocomplete: 'off', required: true, value: profesor ? profesor.nombre : '' });
        var correo = h('input', { id: 'p-correo', type: 'email', maxlength: '150', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', required: true, value: profesor ? profesor.correo : '' });
        var contrasena = h('input', { id: 'p-clave', type: 'password', autocomplete: 'new-password' });
        var rol = h('select', { id: 'p-rol', disabled: soyYo },
            ['Profesor', 'Admin'].map(function (valor) {
                return h('option', { value: valor, selected: profesor ? profesor.rol === valor : valor === 'Profesor', text: valor });
            })
        );
        var boton = h('button', { type: 'submit', class: 'btn btn--primario', text: editando ? 'Guardar cambios' : 'Crear profesor' });

        var form = h('form', { class: 'formulario', novalidate: true },
            avisos,
            h('div', { class: 'campo' }, h('label', { for: 'p-nombre', text: 'Nombre' }), nombre),
            h('div', { class: 'campo' }, h('label', { for: 'p-correo', text: 'Correo' }), correo),
            h('div', { class: 'campo' },
                h('label', { for: 'p-clave', text: editando ? 'Nueva contraseña (opcional)' : 'Contraseña' }), contrasena,
                editando ? h('span', { class: 'ayuda', text: 'Déjala en blanco para conservar la actual.' }) : null),
            h('div', { class: 'campo' },
                h('label', { for: 'p-rol', text: 'Rol' }), rol,
                h('span', { class: 'ayuda', text: soyYo
                    ? 'No puedes cambiar tu propio rol.'
                    : 'Un Admin administra bandas y profesores; un Profesor pasa asistencia en sus bandas.' })),
            h('div', { class: 'formulario__botones' }, boton, h('a', { class: 'btn', href: '#/admin/profesores', text: 'Cancelar' }))
        );

        enviarFormulario({
            form: form, boton: boton, avisos: avisos, textoBoton: boton.textContent,
            validar: function () {
                if (!nombre.value.trim()) return 'El nombre del profesor es obligatorio';
                if (!correo.value.trim()) return 'El correo del profesor es obligatorio';
                if (!editando && !contrasena.value.trim()) return 'La contraseña es obligatoria';
                return null;
            },
            enviar: function () {
                var cuerpo = { nombre: nombre.value.trim(), correo: correo.value.trim() };
                if (contrasena.value.trim()) cuerpo.contrasena = contrasena.value;
                if (!soyYo) cuerpo.rol = rol.value;
                return editando ? RB.api('PUT', '/profesores/' + id, { cuerpo: cuerpo }) : RB.api('POST', '/profesores', { cuerpo: cuerpo });
            },
            alExito: function () {
                ctx.irA('#/admin/profesores', 'ok', editando ? 'Profesor actualizado.' : 'Profesor creado.');
            }
        });

        ctx.montar(
            migas('#/admin/profesores', 'Profesores'),
            h('div', { class: 'cabecera-vista' }, h('h1', { tabindex: '-1', text: editando ? 'Editar profesor' : 'Nuevo profesor' })),
            form
        );
    };

    // ------------------------------------------------------------------ Asignar profesores a una banda
    RB.vistas.bandaProfesores = async function (ctx) {
        var id = Number(ctx.params[0]);
        ctx.montar(migas('#/banda/' + id, 'Banda'), RB.ui.cargando());

        var banda, profesores;
        try {
            var r = await Promise.all([RB.datos.banda(id), RB.api('GET', '/profesores')]);
            banda = r[0]; profesores = r[1];
        } catch (e) { return ctx.error(e, '#/bandas'); }

        var avisos = h('div', { 'aria-live': 'polite' });
        var selector = h('select', { id: 'bp-profesor' },
            profesores.map(function (p) { return h('option', { value: String(p.id_profesor), text: p.nombre + ' (' + p.correo + ')' }); })
        );
        var botonAsignar = h('button', { type: 'submit', class: 'btn btn--primario', text: 'Asignar a la banda' });
        var botonQuitar = h('button', { type: 'button', class: 'btn', text: 'Quitar de la banda' });

        function ocupado(estado) { botonAsignar.disabled = estado; botonQuitar.disabled = estado; }

        async function ejecutar(metodo, ruta, cuerpo, mensajeOk) {
            ocupado(true);
            avisos.replaceChildren();
            try {
                await RB.api(metodo, ruta, cuerpo ? { cuerpo: cuerpo } : undefined);
                avisos.replaceChildren(RB.ui.aviso('ok', mensajeOk));
            } catch (e) {
                if (e.status === 401) return;
                avisos.replaceChildren(RB.ui.aviso('error', e.message));
            }
            ocupado(false);
        }

        var form = h('form', { class: 'formulario', novalidate: true },
            avisos,
            h('div', { class: 'campo' },
                h('label', { for: 'bp-profesor', text: 'Profesor' }), selector,
                h('span', { class: 'ayuda', text: 'Un profesor asignado ve esta banda y puede pasar asistencia en ella.' })),
            h('div', { class: 'formulario__botones' }, botonAsignar, botonQuitar)
        );

        form.addEventListener('submit', function (evento) {
            evento.preventDefault();
            if (!selector.value) return;
            ejecutar('POST', '/bandas/' + id + '/profesores', { id_profesor: Number(selector.value) }, 'Profesor asignado a la banda.');
        });
        botonQuitar.addEventListener('click', function () {
            if (!selector.value) return;
            ejecutar('DELETE', '/bandas/' + id + '/profesores/' + selector.value, null, 'Profesor quitado de la banda.');
        });

        ctx.montar(
            migas('#/banda/' + id, banda.nombre_banda),
            h('div', { class: 'cabecera-vista' },
                h('div', null,
                    h('h1', { tabindex: '-1', text: 'Profesores de la banda' }),
                    h('p', { class: 'subtitulo', text: banda.nombre_banda })
                )
            ),
            profesores.length === 0 ? h('div', { class: 'vacio', text: 'No hay profesores registrados todavía.' }) : form,
            h('p', { class: 'texto-secundario', style: 'margin-top:18px;max-width:640px;font-size:14.5px;',
                text: 'Por ahora el sistema no muestra la lista de profesores ya asignados. Si intentas asignar a alguien que ya lo estaba, o quitar a alguien que no lo estaba, se te avisará.' })
        );
    };
})();
