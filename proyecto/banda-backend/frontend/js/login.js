// Pantalla de acceso: POST /api/auth/login → guarda token y rol → dashboard.html
(function () {
    'use strict';

    var RB = window.RB;

    var formulario = document.getElementById('form-login');
    var contenedorAviso = document.getElementById('aviso');
    var botonEntrar = document.getElementById('entrar');
    var campoCorreo = document.getElementById('correo');
    var campoClave = document.getElementById('contrasena');
    var botonVer = document.getElementById('ver-clave');

    function mostrar(tipo, texto) {
        contenedorAviso.replaceChildren(RB.ui.aviso(tipo, texto));
    }

    // Si ya hay una sesión vigente, no hace falta volver a entrar
    if (RB.sesion.activa()) {
        RB.irA('dashboard.html');
        return;
    }
    if (RB.sesion.token()) RB.sesion.borrar(); // token viejo o dañado

    var motivo = new URLSearchParams(window.location.search).get('motivo');
    if (motivo === 'expirada') mostrar('info', 'Tu sesión venció. Inicia sesión de nuevo.');

    botonVer.addEventListener('click', function () {
        var visible = campoClave.type === 'text';
        campoClave.type = visible ? 'password' : 'text';
        botonVer.textContent = visible ? 'Mostrar' : 'Ocultar';
        botonVer.setAttribute('aria-pressed', String(!visible));
    });

    formulario.addEventListener('submit', async function (evento) {
        evento.preventDefault();
        if (botonEntrar.disabled) return; // evita doble envío

        var correo = campoCorreo.value.trim();
        var contrasena = campoClave.value;

        if (!correo || !contrasena) {
            mostrar('error', 'Correo y contraseña son obligatorios');
            (correo ? campoClave : campoCorreo).focus();
            return;
        }

        botonEntrar.disabled = true;
        botonEntrar.textContent = 'Entrando…';
        contenedorAviso.replaceChildren();

        try {
            var datos = await RB.api('POST', '/auth/login', {
                cuerpo: { correo: correo, contrasena: contrasena },
                sinSesion: true
            });
            RB.sesion.guardar(datos.token, datos.profesor);
            RB.irA('dashboard.html');
        } catch (error) {
            // El mensaje se muestra tal cual lo devuelve la API
            mostrar('error', error.message);
            botonEntrar.disabled = false;
            botonEntrar.textContent = 'Entrar';
            campoClave.focus();
            campoClave.select();
        }
    });
})();
