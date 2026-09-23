# RussBrass — Sistema de asistencia — Estado del proyecto

**Fecha de este corte:** 20 de septiembre, 2026
**Fase actual:** Fase 1 (Backend) — completada y validada en vivo

---

## 1. Qué es este proyecto

Sistema web de control de asistencia para las bandas de la Fundación (marca visible: **RussBrass**), desarrollado como proyecto de horas sociales. Permite:

- Gestionar 3 tipos de banda: **paz**, **clásica** y **orquesta**.
- Administrar profesores con dos roles: **Admin** (acceso total, da clase a todas las bandas) y **Profesor** (asignado a una o más bandas específicas).
- Administrar alumnos, cada uno asignado a una o más bandas.
- Registrar asistencia de **ensayos** y **presentaciones**.
- Calcular el **% de asistencia** de cada alumno y compararlo contra un margen mínimo configurable.

Está pensado para alojarse en una PC de la fundación (base de datos local) y exponerse a internet más adelante mediante Cloudflare Tunnel, para que los profesores pasen lista desde el celular.

---

## 2. De dónde partimos

El proyecto ya tenía un backend funcional en Node.js + Express 5 + PostgreSQL, hecho antes de este proceso. Una auditoría inicial encontró varios problemas serios:

- **Login inseguro**: aceptaba contraseña en texto plano como atajo válido.
- **Sin control de roles**: cualquier profesor logueado podía crear, editar o borrar cualquier cosa, incluyendo otros profesores.
- **Transacciones rotas**: usaban `BEGIN`/`COMMIT` sueltos sobre un `Pool` de conexiones, lo que no garantiza atomicidad real.
- **Reportes con bugs**: consultaban una columna de fecha que no existía; el conteo de asistencias por banda estaba mal calculado; el resumen general usaba un `CROSS JOIN` costoso.
- **Tabla `profesor_banda` sin usar**: existía en la base pero ningún profesor podía asignarse realmente a una banda.
- **Sin distinción de tipo de banda**: no había forma de diferenciar paz / clásica / orquesta.
- **Vulnerabilidades de npm** y **secretos expuestos** en un archivo `test.http`.

---

## 3. Qué se corrigió y se construyó (Fase 1 — Backend)

### 3.1 Base de datos
Esquema en PostgreSQL, con nombres de tabla y columna que respetan el código ya existente (`profesor`, `banda`, `alumno`, `id_profesor`, `id_banda`, etc.):

| Tabla | Para qué sirve |
|---|---|
| `profesor` | Cuentas de acceso (rol `Admin` o `Profesor`, con soft delete vía `activo`) |
| `banda` | Las bandas, con `tipo` (paz/clasica/orquesta) y soft delete |
| `alumno` | Los estudiantes, con soft delete |
| `profesor_banda` | Qué profesor da clase en qué banda(s) — ahora sí en uso real |
| `alumno_banda` | A qué banda(s) pertenece cada alumno |
| `ensayo` | Ensayos programados por banda, con fecha real |
| `presentacion` | Presentaciones por banda |
| `asistencia_ensayo` / `asistencia_presentacion` | Registro de presente/ausente por alumno y evento |
| `config_asistencia` | Margen mínimo de asistencia (global o por banda) |
| **Vista** `vista_asistencia_alumno` | Calcula el % de asistencia real de cada alumno por banda |

El script de creación fue verificado contra la base real por introspección de solo lectura, así que es un espejo exacto de lo que existe hoy en PostgreSQL (tipos, tamaños de columna, `CHECK`, llaves foráneas, índices).

### 3.2 Seguridad y autenticación
- Login solo acepta contraseñas verificadas con **bcrypt** (se eliminó el atajo de texto plano).
- Correo inexistente y contraseña incorrecta responden **el mismo código y mensaje** (401), incluyendo una comparación bcrypt ficticia para que ambos casos tarden lo mismo — así no se puede saber qué correos existen por el código de respuesta ni por el tiempo de respuesta.
- Middleware `soloAdmin`: bloquea acciones administrativas a cualquiera que no sea `Admin`.
- Middleware `tieneAccesoABanda`: un Profesor solo puede operar sobre bandas donde esté asignado; un Admin tiene acceso a todo.
- Ningún registro se borra de verdad (**soft delete** con la columna `activo`) en profesor, banda y alumno — se puede reactivar con endpoints `PATCH .../reactivar`.
- Protecciones para no dejar el sistema sin administrador: un Admin no puede desactivarse a sí mismo, ni desactivar al único Admin activo (con manejo de condición de carrera vía `FOR UPDATE`).

### 3.3 Reglas de negocio
- Un Profesor solo puede crear/editar/borrar alumnos de bandas donde esté asignado (un Admin puede con cualquiera).
- Al editar un alumno, un Profesor no puede agregar ni quitar bandas ajenas — las bandas que no son suyas quedan intactas aunque no vengan en la petición.
- Los reportes de historial y resumen por banda se filtran automáticamente a las bandas del Profesor que consulta; el resumen general (totales de toda la fundación) es exclusivo de Admin.
- Todas las validaciones de longitud de texto (nombre, correo, teléfono, dirección, lugar, etc.) respetan los tamaños reales de columna en PostgreSQL, para evitar errores 500 por datos demasiado largos.
- Las fechas se devuelven como texto simple (`"2026-09-20"`), no como marcas de tiempo con zona horaria, para evitar que un ensayo se muestre con el día equivocado según el huso horario del servidor.

### 3.4 Endpoints nuevos
- `POST /api/bandas/:id_banda/profesores` y `DELETE /api/bandas/:id_banda/profesores/:id_profesor` — asignar/quitar profesor de una banda.
- `GET /api/asistencia/porcentaje?id_banda=&id_alumno=` — porcentaje de asistencia y bandera `en_riesgo`.
- `PATCH /api/profesores/:id/reactivar`, `PATCH /api/bandas/:id/reactivar`, `PATCH /api/alumnos/:id/reactivar`.

El detalle completo de los 28 endpoints (método, body, respuestas, permisos) está en `docs/API.md`, verificado automáticamente para que coincida al 100% con las rutas reales del código.

### 3.5 Pruebas
- **266+ casos de prueba** en 4 suites, incluyendo pruebas de integración contra un PostgreSQL real en memoria (usando el script SQL de verdad, no un mock).
- `node --check` limpio en los 17 archivos `.js` del backend.

### 3.6 Validado en vivo (prueba de humo, 20 de septiembre 2026)
Se probó el flujo completo contra la base de datos real de la fundación:

1. Login como Admin → `200 OK`, token con `rol: Admin`.
2. Crear banda "Banda Sinfónica" (tipo `orquesta`) → `201 Created`.
3. Crear profesora "Ana Martínez" (rol `Profesor`) → `201 Created`.
4. Asignar a Ana a la Banda Sinfónica → `201 Created`.
5. Login como Ana → `200 OK`, token con `rol: Profesor`.
6. Ana intenta crear una banda (no le corresponde) → **`403 Forbidden`** ✅ (el control de roles funciona)
7. Admin crea alumno "Carlos Pérez" asignado a la Banda Sinfónica → `201 Created`.
8. Ana registra asistencia de un ensayo, marcando presente a Carlos → `201 Created`.
9. Consulta de `% de asistencia` de Carlos → **100%**, por encima del mínimo (80%), `en_riesgo: false`.

Todo funcionó como se esperaba, sin intervención manual en la base de datos salvo la creación inicial del primer Admin (necesaria porque nadie puede crear al primer administrador sin ya ser uno).

---

## 4. Cómo correr el proyecto hoy

1. PostgreSQL corriendo localmente, base de datos `russbrass` ya creada con el esquema vigente.
2. Archivo `.env` en `banda-backend/` con `DB_NAME=russbrass`, `JWT_SECRET`, etc.
3. `cd banda-backend && npm install && npm start`
4. El servidor queda en `http://localhost:3000`. Login: `POST /api/auth/login`.
5. Ya existe un usuario Admin real (`admin@russbrass.org`) y una profesora de prueba (`ana.martinez@russbrass.org`), además de una banda y un alumno de prueba.

---

## 5. Lo que falta (próximas fases)

| Fase | Qué incluye | Estado |
|---|---|---|
| 2. Panel de profesores | Interfaz real donde los profesores inician sesión y pasan lista desde el celular. El `frontend/` actual (`index.html`/`menu.js`) no está alineado con la API nueva (por ejemplo, crear banda sin `tipo` ahora falla). | No iniciada |
| 3. Página pública | Misión, visión y presentación de las 3 bandas, inspirada en páginas de referencia de otras fundaciones musicales. | No iniciada |
| 4. Hosting y despliegue | Exponer el sistema a internet con Cloudflare Tunnel + dominio, para acceso real desde teléfonos fuera de la red de la fundación. | Guía lista, falta ejecutarla |
| 5. Mejoras futuras | Notificaciones de bajo % de asistencia, exportar reportes, backups automáticos, etc. | Ideas, sin fecha |

## 6. Detalles pendientes menores (no bloquean nada)
- El frontend viejo necesita actualizarse para mandar el campo `tipo` al crear bandas.
- Documentación técnica (`docs/API.md`, `README.md`) ya actualizada y verificada contra el código real.
