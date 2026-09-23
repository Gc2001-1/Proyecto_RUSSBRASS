// Ayudantes de interfaz. Todo texto que viene de la API entra por textContent (nunca innerHTML).
(function () {
    'use strict';

    var RB = window.RB;

    // h('div', { class: 'x', onclick: fn, text: 'hola' }, hijo1, [hijo2, hijo3], 'texto')
    function h(etiqueta, atributos) {
        var el = document.createElement(etiqueta);

        if (atributos) {
            Object.keys(atributos).forEach(function (k) {
                var v = atributos[k];
                if (v === null || v === undefined || v === false) return;
                if (k === 'class') el.className = v;
                else if (k === 'text') el.textContent = v;
                else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
                else if (v === true) el.setAttribute(k, '');
                else el.setAttribute(k, v);
            });
        }

        function agregar(hijo) {
            if (hijo === null || hijo === undefined || hijo === false) return;
            if (Array.isArray(hijo)) { hijo.forEach(agregar); return; }
            if (typeof hijo === 'string' || typeof hijo === 'number') { el.appendChild(document.createTextNode(String(hijo))); return; }
            el.appendChild(hijo);
        }
        for (var i = 2; i < arguments.length; i++) agregar(arguments[i]);

        return el;
    }

    // Iconos: SVG estáticos (no contienen datos de la API)
    var ICONOS = {
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        cruz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
        flecha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
        mas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
        paz: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="32" cy="30" rx="18" ry="7"/><path d="M14 30v14c0 4 8 7 18 7s18-3 18-7V30"/><path d="M14 38l9 9M23 38l-9 9M50 38l-9 9M41 38l9 9" stroke-width="1.8"/><line x1="20" y1="8" x2="30" y2="24"/><line x1="44" y1="8" x2="34" y2="24"/></svg>',
        clasica: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 20 C18 24 18 32 24 36 C18 40 18 48 24 52 C30 56 38 56 44 52 C50 48 50 40 44 36 C50 32 50 24 44 20 C38 16 30 16 24 20 Z"/><line x1="34" y1="20" x2="34" y2="9"/><circle cx="34" cy="8" r="2.5"/><path d="M28 31 q2 4 0 8" stroke-width="1.5"/><path d="M40 31 q-2 4 0 8" stroke-width="1.5"/></svg>',
        orquesta: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="50" x2="46" y2="16"/><circle cx="46" cy="16" r="2" fill="currentColor"/><path d="M12 42 a10 10 0 0 1 14 -14" stroke-width="2"/><path d="M6 48 a18 18 0 0 1 24 -24" stroke-width="2" opacity="0.6"/></svg>'
    };

    function icono(nombre, clase) {
        var plantilla = document.createElement('template');
        plantilla.innerHTML = ICONOS[nombre] || ICONOS.mas;
        var svg = plantilla.content.firstElementChild;
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        if (clase) svg.setAttribute('class', clase);
        return svg;
    }

    // Banner de aviso. tipo: 'error' | 'ok' | 'info'
    function aviso(tipo, texto) {
        return h('div', { class: 'aviso aviso--' + tipo, role: tipo === 'error' ? 'alert' : 'status', text: texto });
    }

    function cargando(texto) {
        return h('p', { class: 'cargando', role: 'status', text: texto || 'Cargando…' });
    }

    // Fecha local de hoy en formato AAAA-MM-DD (la que espera la API)
    function hoy() {
        var d = new Date();
        var mes = String(d.getMonth() + 1).padStart(2, '0');
        var dia = String(d.getDate()).padStart(2, '0');
        return d.getFullYear() + '-' + mes + '-' + dia;
    }

    // 66.6666 -> "66,7"; 80 -> "80"
    function numero(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return (Math.round(Number(n) * 10) / 10).toLocaleString('es', { maximumFractionDigits: 1 });
    }

    var TIPOS = { paz: 'Banda de paz', clasica: 'Banda de música clásica', orquesta: 'Orquesta' };
    function nombreTipo(tipo) { return TIPOS[tipo] || tipo || ''; }

    RB.ui = { h: h, icono: icono, aviso: aviso, cargando: cargando, hoy: hoy, numero: numero, nombreTipo: nombreTipo, TIPOS: TIPOS };
})();
