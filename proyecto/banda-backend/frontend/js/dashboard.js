// Panel: revisa la sesión, arma el encabezado según el rol y enruta las vistas por hash (#/bandas, #/banda/3/asistencia…).
(function () {
    'use strict';

    var RB = window.RB;
    var h = RB.ui.h;

    // Sin sesión válida se vuelve al login
    if (!RB.protegerPagina()) return;

    var perfil = RB.sesion.profesor();
    var esAdmin = perfil.rol === 'Admin';
    var contenedor = document.getElementById('vista');

    // ---------- encabezado ----------
    document.getElementById('usuario').replaceChildren(
        h('strong', { text: perfil.nombre }),
        document.createTextNode(perfil.rol)
    );
    document.getElementById('salir').addEventListener('click', function () { RB.salir(); });

    var enlacesMenu = [{ id: 'bandas', texto: 'Bandas', ruta: '#/bandas' }];
    if (esAdmin) enlacesMenu.push({ id: 'profesores', texto: 'Profesores', ruta: '#/admin/profesores' });

    var menu = document.getElementById('menu');
    menu.replaceChildren.apply(menu, enlacesMenu.map(function (e) {
        return h('li', null, h('a', { href: e.ruta, 'data-nav': e.id, text: e.texto }));
    }));

    function marcarMenu(id) {
        Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a) {
            if (a.getAttribute('data-nav') === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
    }

    // ---------- rutas ----------
    var V = RB.vistas;
    var RUTAS = [
        { re: /^\/bandas$/, nav: 'bandas', vista: V.bandas },
        { re: /^\/banda\/(\d+)$/, nav: 'bandas', vista: V.banda },
        { re: /^\/banda\/(\d+)\/asistencia$/, nav: 'bandas', vista: V.asistencia },
        { re: /^\/banda\/(\d+)\/porcentajes$/, nav: 'bandas', vista: V.porcentajes },
        { re: /^\/admin\/banda\/nueva$/, nav: 'bandas', admin: true, vista: V.bandaForm },
        { re: /^\/admin\/banda\/(\d+)\/editar$/, nav: 'bandas', admin: true, vista: V.bandaForm },
        { re: /^\/admin\/banda\/(\d+)\/profesores$/, nav: 'bandas', admin: true, vista: V.bandaProfesores },
        { re: /^\/admin\/profesores$/, nav: 'profesores', admin: true, vista: V.profesores },
        { re: /^\/admin\/profesor\/nuevo$/, nav: 'profesores', admin: true, vista: V.profesorForm },
        { re: /^\/admin\/profesor\/(\d+)\/editar$/, nav: 'profesores', admin: true, vista: V.profesorForm }
    ];

    var version = 0;      // sirve para descartar respuestas de una vista a la que el usuario ya no está mirando
    var pendiente = null; // aviso que se muestra una sola vez en la siguiente vista

    function aplanar(lista, salida) {
        lista.forEach(function (n) {
            if (n === null || n === undefined || n === false) return;
            if (Array.isArray(n)) aplanar(n, salida); else salida.push(n);
        });
        return salida;
    }

    function irA(hash, tipo, texto) {
        if (tipo) pendiente = { tipo: tipo, texto: texto };
        if (window.location.hash === hash) navegar(); else window.location.hash = hash;
    }

    function navegar() {
        var ruta = window.location.hash.replace(/^#/, '') || '/bandas';
        var elegida = null, parametros = [];

        for (var i = 0; i < RUTAS.length; i++) {
            var coincide = RUTAS[i].re.exec(ruta);
            if (coincide) { elegida = RUTAS[i]; parametros = coincide.slice(1); break; }
        }

        if (!elegida || (elegida.admin && !esAdmin)) {
            window.location.replace('#/bandas');
            return;
        }

        var miVersion = ++version;
        marcarMenu(elegida.nav);

        // El aviso pendiente pertenece a esta vista: se toma una sola vez y la vista puede mostrarlo las veces que necesite
        var avisoDeEstaVista = pendiente;
        pendiente = null;

        var ctx = {
            params: parametros,
            vigente: function () { return miVersion === version; },
            montar: function () {
                if (miVersion !== version) return false;
                contenedor.replaceChildren.apply(contenedor, aplanar(Array.prototype.slice.call(arguments), []).map(function (n) {
                    return typeof n === 'string' ? document.createTextNode(n) : n;
                }));
                return true;
            },
            // Aviso de una sola vez (p. ej. "Banda creada."), o null. Devuelve un elemento nuevo en cada llamada.
            flash: function () {
                return avisoDeEstaVista ? RB.ui.aviso(avisoDeEstaVista.tipo, avisoDeEstaVista.texto) : null;
            },
            irA: irA,
            recargar: function (tipo, texto) { irA(window.location.hash, tipo, texto); },
            // Error de carga: si fue un 401 ya se está volviendo al login y no se muestra nada
            error: function (e, volverA) {
                if (!e || e.status === 401) return;
                ctx.montar(
                    volverA ? h('a', { class: 'migas', href: volverA }, RB.ui.icono('flecha'), 'Volver') : null,
                    h('h1', { tabindex: '-1', class: 'solo-lectores', text: 'No se pudo cargar' }),
                    RB.ui.aviso('error', e.message)
                );
            }
        };

        var resultado = Promise.resolve(elegida.vista(ctx));
        resultado.then(function () {
            if (miVersion !== version) return;
            var titulo = contenedor.querySelector('h1');
            if (titulo) titulo.focus({ preventScroll: true });
            window.scrollTo(0, 0);
        }, function (e) {
            if (window.console) console.error(e);
            ctx.error(new RB.ApiError(0, 'Ocurrió un error inesperado en la pantalla. Recarga la página.'));
        });
    }

    window.addEventListener('hashchange', navegar);
    navegar();
})();
