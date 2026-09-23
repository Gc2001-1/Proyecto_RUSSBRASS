// Configuración del panel. Se carga primero; el resto de los scripts cuelga de window.RB.
(function () {
    'use strict';

    var RB = (window.RB = window.RB || {});

    // Dirección de la API. Por defecto:
    //  - página abierta como archivo (file://): http://localhost:3000/api
    //  - página servida por HTTP: la API en el mismo equipo, puerto 3000
    //    (así, si abres el panel desde el celular con la IP de la computadora, la API se busca ahí y no en el celular).
    // Para usar otra dirección, define window.RB_API_BASE antes de cargar este archivo.
    var protocolo = window.location.protocol;
    var host = window.location.hostname;
    var servidoPorHttp = (protocolo === 'http:' || protocolo === 'https:') && host;

    RB.API_BASE = window.RB_API_BASE ||
        (servidoPorHttp ? protocolo + '//' + host + ':3000/api' : 'http://localhost:3000/api');

    // Claves de localStorage
    RB.CLAVES = { token: 'rb_token', profesor: 'rb_profesor' };
})();
