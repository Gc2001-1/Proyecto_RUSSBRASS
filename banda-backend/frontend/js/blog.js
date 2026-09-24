// Página pública del blog: lista las entradas de GET /api/blog en tarjetas, con "Cargar más".
// Todo texto que llega de la API se inserta con textContent (nunca innerHTML) para evitar XSS.
(function () {
    'use strict';

    var API_BASE = window.RB.API_BASE;

    // GET /api/blog solo acepta ?limite=N (1 a 100) y no tiene offset ni página.
    // "Cargar más" vuelve a pedir con un límite mayor y agrega solo las entradas nuevas.
    var LOTE = 12;
    var LIMITE_MAXIMO = 100; // el mismo tope que valida blogController.js
    var LARGO_RESUMEN = 120;

    var estado = document.getElementById('blog-estado');
    var vacio = document.getElementById('blog-vacio');
    var rejilla = document.getElementById('blog-rejilla');
    var botonMas = document.getElementById('blog-mas');

    var idsMostrados = {};
    var cantidadMostrada = 0;

    // Recorta en el último espacio antes del límite para no partir palabras
    function recortar(texto, largo) {
        var limpio = String(texto || '').replace(/\s+/g, ' ').trim();
        if (limpio.length <= largo) return limpio;
        var corte = limpio.slice(0, largo);
        var ultimoEspacio = corte.lastIndexOf(' ');
        if (ultimoEspacio > largo * 0.6) corte = corte.slice(0, ultimoEspacio);
        return corte.replace(/[\s.,;:!?¿¡-]+$/, '') + '…';
    }

    // La API entrega AAAA-MM-DD; se arma la fecha local para que no se corra un día por la zona horaria
    function formatearFecha(fecha) {
        var partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''));
        if (!partes) return '';
        var d = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
        return d.toLocaleDateString('es-SV', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    // Solo se aceptan enlaces http(s): descarta javascript:, data:, etc.
    function urlSegura(valor) {
        if (!valor) return null;
        try {
            var url = new URL(String(valor), window.location.href);
            return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
        } catch (e) {
            return null;
        }
    }

    // La foto se guarda como ruta relativa (uploads/blog/...), que cuelga de la carpeta frontend
    function urlFoto(foto) {
        var valor = String(foto || '').trim();
        if (!valor) return null;
        if (/^uploads\/[\w\-./]+$/.test(valor) && valor.indexOf('..') === -1) return valor;
        return urlSegura(valor);
    }

    function iconoNota() {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 64 64');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2.5');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        svg.setAttribute('aria-hidden', 'true');
        [
            ['path', { d: 'M26 46 V14 L50 9 V41' }],
            ['ellipse', { cx: '20', cy: '46', rx: '6', ry: '5', fill: 'currentColor' }],
            ['ellipse', { cx: '44', cy: '41', rx: '6', ry: '5', fill: 'currentColor' }],
            ['path', { d: 'M26 22 L50 17' }]
        ].forEach(function (def) {
            var el = document.createElementNS(ns, def[0]);
            Object.keys(def[1]).forEach(function (k) { el.setAttribute(k, def[1][k]); });
            svg.appendChild(el);
        });
        return svg;
    }

    function marcarSinFoto(media) {
        media.textContent = '';
        media.classList.add('sin-foto');
        media.appendChild(iconoNota());
    }

    function crearTarjeta(entrada) {
        var li = document.createElement('li');
        li.className = 'tarjeta';

        var media = document.createElement('div');
        media.className = 'tarjeta-media';
        var src = urlFoto(entrada.foto);
        if (src) {
            var img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.alt = entrada.titulo ? String(entrada.titulo) : '';
            img.addEventListener('error', function () { marcarSinFoto(media); });
            img.src = src;
            media.appendChild(img);
        } else {
            marcarSinFoto(media);
        }
        li.appendChild(media);

        var cuerpo = document.createElement('div');
        cuerpo.className = 'tarjeta-cuerpo';

        var textoFecha = formatearFecha(entrada.fecha);
        if (textoFecha) {
            var fecha = document.createElement('time');
            fecha.className = 'tarjeta-fecha';
            fecha.dateTime = entrada.fecha;
            fecha.textContent = textoFecha;
            cuerpo.appendChild(fecha);
        }

        var titulo = document.createElement('h2');
        titulo.textContent = entrada.titulo || '';
        cuerpo.appendChild(titulo);

        var resumen = document.createElement('p');
        resumen.textContent = recortar(entrada.resumen, LARGO_RESUMEN);
        cuerpo.appendChild(resumen);

        var enlace = urlSegura(entrada.enlace_facebook);
        if (enlace) {
            var a = document.createElement('a');
            a.className = 'tarjeta-enlace';
            a.href = enlace;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            var etiqueta = document.createElement('span');
            etiqueta.textContent = 'Ver publicación original';
            a.appendChild(etiqueta);
            a.setAttribute('aria-label', 'Ver publicación original de "' + (entrada.titulo || '') + '" en Facebook (abre en una pestaña nueva)');
            cuerpo.appendChild(a);
        }

        li.appendChild(cuerpo);
        return li;
    }

    function pedirEntradas(limite) {
        return fetch(API_BASE + '/blog?limite=' + limite, { headers: { Accept: 'application/json' } })
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                return res.json();
            })
            .then(function (datos) {
                if (!Array.isArray(datos)) throw new Error('Respuesta inesperada');
                return datos;
            });
    }

    function cargar() {
        var limite = Math.min(cantidadMostrada + LOTE, LIMITE_MAXIMO);
        var esPrimeraCarga = cantidadMostrada === 0;

        botonMas.disabled = true;
        botonMas.textContent = 'Cargando…';
        if (esPrimeraCarga) estado.textContent = 'Cargando entradas…';

        pedirEntradas(limite)
            .then(function (entradas) {
                // Se descartan las ya mostradas por id: si se publicó algo entre dos pedidos, no se duplica
                var fragmento = document.createDocumentFragment();
                entradas.forEach(function (entrada) {
                    if (!entrada || idsMostrados[entrada.id_entrada]) return;
                    idsMostrados[entrada.id_entrada] = true;
                    fragmento.appendChild(crearTarjeta(entrada));
                    cantidadMostrada++;
                });
                rejilla.appendChild(fragmento);

                if (cantidadMostrada === 0) {
                    estado.hidden = true;
                    rejilla.hidden = true;
                    vacio.hidden = false;
                    botonMas.hidden = true;
                    return;
                }

                rejilla.hidden = false;
                estado.hidden = true;

                // Hay más si la API llenó el límite pedido y todavía no se llegó al tope del endpoint
                var hayMas = entradas.length === limite && limite < LIMITE_MAXIMO;
                botonMas.hidden = !hayMas;
            })
            .catch(function () {
                estado.hidden = false;
                estado.textContent = esPrimeraCarga
                    ? 'No se pudieron cargar las entradas del blog. Intenta de nuevo más tarde.'
                    : 'No se pudieron cargar más entradas. Intenta de nuevo.';
            })
            .then(function () {
                botonMas.disabled = false;
                botonMas.textContent = 'Cargar más';
            });
    }

    botonMas.addEventListener('click', cargar);
    cargar();
})();
