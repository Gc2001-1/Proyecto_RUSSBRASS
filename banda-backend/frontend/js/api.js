// Sesión y acceso a la API. Toda llamada del panel pasa por RB.api(): agrega el token,
// cierra la sesión si la API responde 401 y entrega los errores con el mensaje tal cual lo da la API.
(function () {
    'use strict';

    var RB = window.RB;
    var CLAVES = RB.CLAVES;

    function leer(clave) { try { return window.localStorage.getItem(clave); } catch (e) { return null; } }
    function escribir(clave, valor) { try { window.localStorage.setItem(clave, valor); } catch (e) { /* almacenamiento bloqueado */ } }
    function quitar(clave) { try { window.localStorage.removeItem(clave); } catch (e) { /* nada */ } }

    // Lee el contenido (payload) de un JWT solo para conocer su vencimiento; la API es quien valida de verdad.
    function contenidoToken(token) {
        try {
            var base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            var bytes = Uint8Array.from(atob(base64), function (c) { return c.charCodeAt(0); });
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
            return null;
        }
    }

    RB.sesion = {
        token: function () { return leer(CLAVES.token); },
        profesor: function () {
            try { return JSON.parse(leer(CLAVES.profesor)); } catch (e) { return null; }
        },
        guardar: function (token, profesor) {
            escribir(CLAVES.token, token);
            escribir(CLAVES.profesor, JSON.stringify({
                id_profesor: profesor.id_profesor,
                nombre: profesor.nombre,
                correo: profesor.correo,
                rol: profesor.rol
            }));
        },
        borrar: function () { quitar(CLAVES.token); quitar(CLAVES.profesor); },
        vencido: function (token) {
            var datos = contenidoToken(token);
            return !datos || (Boolean(datos.exp) && datos.exp * 1000 <= Date.now());
        },
        activa: function () {
            var token = this.token();
            return Boolean(token) && !this.vencido(token) && Boolean(this.profesor());
        }
    };

    // Redirección (un solo lugar, para poder probarla)
    RB.irA = function (url) { window.location.assign(url); };

    RB.salir = function (motivo) {
        RB.sesion.borrar();
        RB.irA('login.html' + (motivo ? '?motivo=' + encodeURIComponent(motivo) : ''));
    };

    // Para las páginas del panel: sin sesión válida, vuelve al login. Devuelve true si se puede continuar.
    RB.protegerPagina = function () {
        if (RB.sesion.activa()) return true;
        var teniaToken = Boolean(RB.sesion.token());
        RB.sesion.borrar();
        RB.irA('login.html' + (teniaToken ? '?motivo=expirada' : ''));
        return false;
    };

    function ApiError(status, mensaje, datos) {
        this.name = 'ApiError';
        this.status = status;
        this.message = mensaje;
        this.datos = datos || null;
    }
    ApiError.prototype = Object.create(Error.prototype);
    ApiError.prototype.constructor = ApiError;
    RB.ApiError = ApiError;

    function queryString(query) {
        if (!query) return '';
        var partes = Object.keys(query)
            .filter(function (k) { return query[k] !== undefined && query[k] !== null && query[k] !== ''; })
            .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); });
        return partes.length ? '?' + partes.join('&') : '';
    }

    // RB.api('GET', '/bandas') | RB.api('POST', '/alumnos', { cuerpo: {...} }) | { query: {...}, sinSesion: true }
    RB.api = async function (metodo, ruta, opciones) {
        opciones = opciones || {};
        var headers = { Accept: 'application/json' };
        var tieneCuerpo = opciones.cuerpo !== undefined;
        if (tieneCuerpo) headers['Content-Type'] = 'application/json';

        var token = RB.sesion.token();
        if (token && !opciones.sinSesion) headers.Authorization = 'Bearer ' + token;

        var respuesta;
        try {
            respuesta = await fetch(RB.API_BASE + ruta + queryString(opciones.query), {
                method: metodo,
                headers: headers,
                body: tieneCuerpo ? JSON.stringify(opciones.cuerpo) : undefined
            });
        } catch (e) {
            throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
        }

        var datos = null;
        try { datos = await respuesta.json(); } catch (e) { /* respuesta sin JSON */ }

        // Token vencido o inválido en el panel: se borra y se vuelve al login.
        // (En el propio login, un 401 significa "credenciales incorrectas" y se muestra sin redirigir.)
        if (respuesta.status === 401 && !opciones.sinSesion) {
            RB.salir('expirada');
            throw new ApiError(401, (datos && datos.mensaje) || 'Tu sesión venció. Inicia sesión de nuevo.', datos);
        }

        if (!respuesta.ok) {
            throw new ApiError(respuesta.status, (datos && datos.mensaje) || 'Error ' + respuesta.status + ' del servidor.', datos);
        }

        return datos;
    };
})();
