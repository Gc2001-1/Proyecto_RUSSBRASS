// Consultas compartidas por las vistas del panel.
(function () {
    'use strict';

    var RB = window.RB;

    // Bandas que ve el usuario, con su total de alumnos.
    //  - Admin: todas las bandas activas (GET /bandas).
    //  - Profesor: solo las suyas. La API no tiene un "mis bandas", pero GET /reportes/resumen-bandas
    //    ya viene filtrado por las bandas asignadas al profesor (profesor_banda); se cruza con GET /bandas
    //    para traer el tipo y la descripción.
    async function bandas() {
        var esAdmin = RB.sesion.profesor().rol === 'Admin';
        var resultados = await Promise.all([
            RB.api('GET', '/bandas'),
            RB.api('GET', '/reportes/resumen-bandas')
        ]);
        var todas = resultados[0];
        var totales = new Map(resultados[1].datos.map(function (r) { return [r.id_banda, r.total_alumnos]; }));

        return todas
            .filter(function (b) { return esAdmin || totales.has(b.id_banda); })
            .map(function (b) { return Object.assign({}, b, { total_alumnos: totales.get(b.id_banda) }); });
    }

    // La API no filtra alumnos por banda: se traen los activos y se filtran aquí.
    async function alumnosDeBanda(idBanda) {
        var alumnos = await RB.api('GET', '/alumnos');
        return alumnos.filter(function (a) {
            return (a.bandas || []).some(function (b) { return Number(b.id_banda) === Number(idBanda); });
        });
    }

    function banda(idBanda) {
        return RB.api('GET', '/bandas/' + idBanda);
    }

    RB.datos = { bandas: bandas, alumnosDeBanda: alumnosDeBanda, banda: banda };
})();
