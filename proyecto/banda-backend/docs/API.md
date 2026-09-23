# Documentación de API

## Base URL

```text
http://localhost:3000
```

Todas las peticiones y respuestas usan JSON (`Content-Type: application/json`). Los errores devuelven siempre un objeto con la clave `mensaje`:

```json
{ "mensaje": "El nombre de la banda es obligatorio" }
```

## Autenticación

Todas las rutas requieren un token JWT en el encabezado `Authorization`, excepto `POST /api/auth/login` y `GET /`.

```http
Authorization: Bearer <token>
```

El token se obtiene en el login, dura 8 horas y contiene `id_profesor`, `nombre`, `correo` y `rol`. El rol se lee del token: si cambia el rol de un profesor (o se desactiva su cuenta), el cambio no afecta a los tokens ya emitidos hasta que venzan.

| Situación | Código | Mensaje |
|---|---|---|
| Sin token | 401 | Acceso denegado. No se proporcionó un token. |
| Token inválido o vencido | 401 | Token inválido o expirado. |

## Niveles de acceso

| Etiqueta | Significado |
|---|---|
| **Público** | No requiere token. |
| **Token** | Cualquier profesor autenticado (Admin o Profesor). |
| **Admin** | Requiere token y rol `Admin` (`soloAdmin`). Un Profesor recibe `403` con "Acceso denegado. Se requiere rol de administrador." |
| **Token + banda** | Requiere token y acceso a la banda (`tieneAccesoABanda`). Un Admin pasa siempre. Un Profesor solo si está asignado a esa banda en `profesor_banda`; si no, `403` con "No tienes acceso a esta banda". El `id_banda` se toma de la URL, del body o del query string. Si un Profesor no lo envía, `400`. |

## Convenciones

**Soft delete.** Ningún `DELETE` sobre profesores, bandas o alumnos borra filas: marcan `activo = false` y conservan el historial (ensayos, asistencias, asignaciones y membresías). La única excepción es `DELETE /api/bandas/:id_banda/profesores/:id_profesor`, que sí elimina la asignación. Un registro eliminado se recupera con su ruta `PATCH .../reactivar`.

**Inactivos en las lecturas.** Los `GET` de profesores, bandas y alumnos devuelven solo registros con `activo = true`. Un **Admin** puede agregar `?incluir_inactivos=true` (texto exacto) para ver también los inactivos; cada registro trae su campo `activo`. Para un Profesor el parámetro se ignora. Con ese parámetro, las bandas dentro de cada alumno también incluyen las inactivas.

**IDs inválidos.** Un id que no sea un entero positivo (por ejemplo `/api/alumnos/abc`) responde `400`, no `500`.

**Largo máximo de los textos.** Cada campo de texto no puede superar el tamaño de su columna en la base de datos. Si se pasa, la respuesta es `400` con `"El campo <campo> no puede superar los <N> caracteres"`, y no se guarda nada. Los espacios al inicio y al final no cuentan (se recortan antes de guardar).

| Campo | Endpoints | Máximo |
|---|---|---|
| `nombre` (alumno) | `POST` y `PUT /api/alumnos` | 150 |
| `telefono` | `POST` y `PUT /api/alumnos` | 30 |
| `direccion` | `POST` y `PUT /api/alumnos` | 255 |
| `nombre_banda` | `POST` y `PUT /api/bandas` | 150 |
| `nombre` (profesor) | `POST` y `PUT /api/profesores` | 150 |
| `correo` | `POST` y `PUT /api/profesores` | 150 |
| `lugar` | `POST /api/asistencia/ensayo` | 150 |
| `lugar_presentacion` | `POST /api/asistencia/presentacion` | 150 |

**Fechas.** Las fechas (`fecha`, `fecha_inscripcion`) salen como texto simple `AAAA-MM-DD` (por ejemplo `2026-08-10`), sin hora ni zona horaria, así que no cambian según el país del cliente. Las horas (`hora`) salen como texto `HH:MM:SS`. La única marca de tiempo completa es `asignado_en` (al asignar un profesor a una banda), que sí es ISO 8601 con zona horaria.

## Resumen de endpoints

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/` | Público |
| POST | `/api/auth/login` | Público |
| GET | `/api/profesores` | Token |
| GET | `/api/profesores/:id` | Token |
| POST | `/api/profesores` | Admin |
| PUT | `/api/profesores/:id` | Admin |
| PATCH | `/api/profesores/:id/reactivar` | Admin |
| DELETE | `/api/profesores/:id` | Admin |
| GET | `/api/bandas` | Token |
| GET | `/api/bandas/:id` | Token |
| POST | `/api/bandas` | Admin |
| PUT | `/api/bandas/:id` | Admin |
| PATCH | `/api/bandas/:id/reactivar` | Admin |
| DELETE | `/api/bandas/:id` | Admin |
| POST | `/api/bandas/:id_banda/profesores` | Admin |
| DELETE | `/api/bandas/:id_banda/profesores/:id_profesor` | Admin |
| GET | `/api/alumnos` | Token |
| GET | `/api/alumnos/:id` | Token |
| POST | `/api/alumnos` | Token |
| PUT | `/api/alumnos/:id` | Token |
| PATCH | `/api/alumnos/:id/reactivar` | Admin |
| DELETE | `/api/alumnos/:id` | Token |
| POST | `/api/asistencia/ensayo` | Token + banda |
| POST | `/api/asistencia/presentacion` | Token + banda |
| GET | `/api/asistencia/porcentaje` | Token + banda |
| GET | `/api/reportes/historial` | Token |
| GET | `/api/reportes/resumen-bandas` | Token |
| GET | `/api/reportes/resumen-general` | Admin |

---

## Sistema

### GET /

Comprobación de que la API está en línea. **Público.**

```json
{ "mensaje": "API de Control de Bandas funcionando correctamente 🚀" }
```

Cualquier ruta que no exista responde `404` con `{ "mensaje": "Ruta no encontrada" }`.

---

## Autenticación

### POST /api/auth/login

**Público.** Autentica a un profesor y devuelve un token JWT. La contraseña se compara únicamente contra su hash bcrypt (no se acepta texto plano) y las cuentas con `activo = false` no pueden iniciar sesión.

**Body**

```json
{
  "correo": "profesor@ejemplo.com",
  "contrasena": "123456"
}
```

**Respuesta 200**

```json
{
  "mensaje": "Inicio de sesión exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "profesor": {
    "id_profesor": 1,
    "nombre": "Profesor A",
    "correo": "profesor@ejemplo.com",
    "rol": "Profesor"
  }
}
```

**Errores**

| Código | Cuándo |
|---|---|
| 400 | Falta el correo o la contraseña. |
| 401 | Correo inexistente, contraseña incorrecta o cuenta inactiva. Los tres casos responden exactamente lo mismo (código 401 y el mensaje "Correo o contraseña incorrectos") y con un tiempo de respuesta equivalente, para que no se pueda saber qué correos están registrados. |

---

## Profesores

Los campos que devuelve la API para un profesor son `id_profesor`, `nombre`, `correo`, `rol` y `activo`. La contraseña nunca se devuelve.

### GET /api/profesores

**Token.** Lista de profesores ordenada por nombre. Solo activos; un Admin puede usar `?incluir_inactivos=true`.

```json
[
  { "id_profesor": 1, "nombre": "Ana Admin", "correo": "ana@ejemplo.com", "rol": "Admin", "activo": true },
  { "id_profesor": 2, "nombre": "Luis Pérez", "correo": "luis@ejemplo.com", "rol": "Profesor", "activo": true }
]
```

### GET /api/profesores/:id

**Token.** Un profesor por id. Devuelve el objeto del profesor (mismos campos que arriba). `404` si no existe o está inactivo (salvo Admin con `?incluir_inactivos=true`).

### POST /api/profesores

**Admin.** Crea un profesor. La contraseña se guarda con bcrypt.

**Body**

```json
{
  "nombre": "Luis Pérez",
  "correo": "luis@ejemplo.com",
  "contrasena": "clave-segura",
  "rol": "Profesor"
}
```

`nombre`, `correo` y `contrasena` son obligatorios. `rol` es opcional: `Admin` o `Profesor` (por defecto `Profesor`). Como esta ruta ya es solo para Admin, el controlador además fuerza `Profesor` si quien pide no es Admin, por si algún día se abre la ruta.

**Respuesta 201**

```json
{
  "mensaje": "Profesor creado correctamente",
  "profesor": { "id_profesor": 2, "nombre": "Luis Pérez", "correo": "luis@ejemplo.com", "rol": "Profesor", "activo": true }
}
```

**Errores:** `400` faltan datos obligatorios o el rol no es `Admin`/`Profesor`; `409` el correo ya existe (o pertenece a un profesor eliminado).

### PUT /api/profesores/:id

**Admin.** Actualiza un profesor activo.

```json
{
  "nombre": "Luis Pérez",
  "correo": "luis@ejemplo.com",
  "contrasena": "nueva-clave",
  "rol": "Admin"
}
```

- `nombre` y `correo` son obligatorios.
- `contrasena` es opcional: si viene con contenido se guarda su hash bcrypt; si no viene (o está en blanco) la contraseña actual no se toca.
- `rol` es opcional: si no viene se conserva el rol actual.

**Respuesta 200:** `{ "mensaje": "Profesor actualizado correctamente", "profesor": { ... } }`

**Errores:** `400` datos inválidos; `404` no existe o está inactivo; `409` otro profesor ya usa ese correo.

### PATCH /api/profesores/:id/reactivar

**Admin.** Vuelve a activar un profesor eliminado. Recupera sus asignaciones a bandas.

**Respuesta 200**

```json
{
  "mensaje": "Profesor reactivado correctamente",
  "profesor": { "id_profesor": 2, "nombre": "Luis Pérez", "correo": "luis@ejemplo.com", "rol": "Profesor", "activo": true }
}
```

**Error 404:** el profesor no existe o ya estaba activo.

### DELETE /api/profesores/:id

**Admin.** Desactiva al profesor (`activo = false`); ya no puede iniciar sesión. Se rechaza con `400` en estos casos, antes de modificar nada:

| Mensaje | Cuándo |
|---|---|
| No puedes desactivar tu propia cuenta | El id coincide con el del profesor que hace la petición. |
| No puedes desactivar al único Admin del sistema | El profesor es Admin y es el único Admin activo. |

**Respuesta 200:** `{ "mensaje": "Profesor eliminado correctamente" }`. **Error 404:** no existe o ya estaba inactivo.

---

## Bandas

`tipo` solo admite `paz`, `clasica` u `orquesta`.

### GET /api/bandas

**Token.** Lista de bandas ordenada por nombre. Solo activas; un Admin puede usar `?incluir_inactivos=true`.

```json
[
  { "id_banda": 1, "nombre_banda": "Banda de Paz", "tipo": "paz", "descripcion": "Banda de la comunidad", "activo": true },
  { "id_banda": 2, "nombre_banda": "Orquesta Juvenil", "tipo": "orquesta", "descripcion": null, "activo": true }
]
```

### GET /api/bandas/:id

**Token.** Una banda por id (mismos campos). `404` si no existe o está inactiva (salvo Admin con `?incluir_inactivos=true`).

### POST /api/bandas

**Admin.** Crea una banda.

```json
{
  "nombre_banda": "Banda de Paz",
  "tipo": "paz",
  "descripcion": "Banda de la comunidad"
}
```

`nombre_banda` y `tipo` son obligatorios; `descripcion` es opcional. `tipo` no distingue mayúsculas y se guarda en minúsculas.

**Respuesta 201**

```json
{
  "mensaje": "Banda creada correctamente",
  "banda": { "id_banda": 1, "nombre_banda": "Banda de Paz", "tipo": "paz", "descripcion": "Banda de la comunidad" }
}
```

**Errores:** `400` falta el nombre o `tipo` no es uno de los tres valores permitidos; `409` el nombre ya existe (o pertenece a una banda eliminada).

### PUT /api/bandas/:id

**Admin.** Actualiza una banda activa. Mismo body que el POST (`nombre_banda` y `tipo` obligatorios). Si `descripcion` no viene, se conserva la actual.

**Respuesta 200:** `{ "mensaje": "Banda actualizada correctamente", "banda": { ... } }`

**Errores:** `400` datos inválidos; `404` no existe o está inactiva; `409` otra banda ya usa ese nombre.

### PATCH /api/bandas/:id/reactivar

**Admin.** Vuelve a activar una banda eliminada; conserva sus ensayos, presentaciones y membresías.

**Respuesta 200**

```json
{
  "mensaje": "Banda reactivada correctamente",
  "banda": { "id_banda": 1, "nombre_banda": "Banda de Paz", "tipo": "paz", "descripcion": "Banda de la comunidad", "activo": true }
}
```

**Error 404:** la banda no existe o ya estaba activa.

### DELETE /api/bandas/:id

**Admin.** Desactiva la banda (`activo = false`). Funciona aunque tenga ensayos o presentaciones, porque no se borra nada.

**Respuesta 200:** `{ "mensaje": "Banda eliminada correctamente" }`. **Error 404:** no existe o ya estaba inactiva.

### POST /api/bandas/:id_banda/profesores

**Admin.** Asigna un profesor a la banda (fila en `profesor_banda`). Es lo que permite a un Profesor registrar asistencia de esa banda.

```json
{ "id_profesor": 2 }
```

**Respuesta 201**

```json
{
  "mensaje": "Profesor asignado a la banda correctamente",
  "asignacion": { "id_profesor": 2, "id_banda": 1, "asignado_en": "2026-09-20T12:00:00.000Z" }
}
```

**Errores:** `400` ids inválidos; `404` la banda o el profesor no existen o están inactivos; `409` el profesor ya estaba asignado.

### DELETE /api/bandas/:id_banda/profesores/:id_profesor

**Admin.** Quita la asignación del profesor a la banda. Esta ruta sí elimina la fila de `profesor_banda`.

**Respuesta 200:** `{ "mensaje": "Profesor quitado de la banda correctamente" }`. **Error 404:** "El profesor no está asignado a esa banda".

---

## Alumnos

Cualquier profesor autenticado puede **consultar** alumnos. Para **crear, editar y eliminar** rige el acceso por banda:

| Operación | Admin | Profesor |
|---|---|---|
| Crear (`POST`) | Cualquier banda | Si envía `bandas`, debe estar asignado a **al menos una** de ellas. Si no envía `bandas` (o envía `[]`), puede crearlo sin restricción. |
| Editar (`PUT`) y eliminar (`DELETE`) | Cualquier alumno | Solo si está asignado a **al menos una de las bandas actuales del alumno** (según `alumno_banda`). Un alumno sin ninguna banda solo lo puede gestionar un Admin. Al editar solo puede agregar o quitar **bandas propias** (ver `PUT /api/alumnos/:id`). |
| Reactivar (`PATCH`) | Sí | No |

La asignación de un profesor a una banda está en `profesor_banda` (ver `POST /api/bandas/:id_banda/profesores`). Si no cumple, la respuesta es `403` con "No tienes acceso a este alumno" (editar y eliminar) o "No tienes acceso a ninguna de las bandas indicadas" (crear). Si el alumno no existe o está inactivo, la respuesta es `404`.

### GET /api/alumnos

**Token.** Alumnos activos con sus bandas (solo las activas), ordenados por nombre. Un Admin puede usar `?incluir_inactivos=true`.

```json
[
  {
    "id_alumno": 5,
    "nombre": "Juan Pérez",
    "telefono": "12345678",
    "direccion": "Ciudad",
    "fecha_inscripcion": "2026-08-10",
    "activo": true,
    "bandas": [
      { "id_banda": 1, "nombre_banda": "Banda de Paz", "activo": true }
    ]
  }
]
```

### GET /api/alumnos/:id

**Token.** Un alumno por id, con la misma forma que cada elemento de la lista. `404` si no existe o está inactivo (salvo Admin con `?incluir_inactivos=true`).

### POST /api/alumnos

**Token.** Crea un alumno y lo asigna a cero o más bandas, todo en una transacción.

```json
{
  "nombre": "Juan Pérez",
  "telefono": "12345678",
  "direccion": "Ciudad",
  "bandas": [1, 2]
}
```

- `nombre` es obligatorio. `telefono` es opcional, pero si se envía debe tener al menos 8 caracteres. `direccion` es opcional.
- `bandas` es opcional. Cada id debe ser un entero y corresponder a una banda que exista y esté activa.

**Respuesta 201**

```json
{
  "mensaje": "Alumno registrado con éxito",
  "alumno": {
    "id_alumno": 5,
    "nombre": "Juan Pérez",
    "telefono": "12345678",
    "direccion": "Ciudad",
    "fecha_inscripcion": "2026-09-20",
    "activo": true
  }
}
```

**Errores:** `400` falta el nombre, teléfono corto, `bandas` no es un arreglo, o alguna banda no existe o está inactiva; `403` un Profesor que indica bandas pero no está asignado a ninguna de ellas. En el caso de bandas inexistentes o inactivas se indica cuáles:

```json
{
  "mensaje": "No existe o está inactiva la banda con ID: 99",
  "bandas_invalidas": [99]
}
```

### PUT /api/alumnos/:id

**Token.** Actualiza un alumno activo.

```json
{
  "nombre": "Juan Pérez",
  "telefono": "12345678",
  "direccion": "Ciudad",
  "bandas": [1, 3]
}
```

- `nombre` es obligatorio.
- `telefono` y `direccion` son opcionales y **solo se modifican si se envían**: si no vienen en el body se conserva el valor actual. Enviarlos vacíos (`""`) o como `null` los borra. Si se envía `telefono` (con contenido) debe tener al menos 8 caracteres, igual que al crear.
- `bandas` es opcional. Si **no se envía**, las membresías actuales no se tocan. Si se envía, se agregan las nuevas y se quitan las que ya no estén en la lista; las que se mantienen conservan su fecha de ingreso.
  - **Admin:** puede agregar y quitar cualquier banda. Un arreglo vacío (`[]`) quita todas.
  - **Profesor:** solo puede agregar o quitar las bandas que tiene asignadas (`profesor_banda`). Las demás bandas del alumno **se conservan intactas, vengan o no en la lista**: omitir una banda ajena no la quita ni da error. Un arreglo vacío (`[]`) quita únicamente sus propias bandas. Si intenta **agregar** una banda que no es suya, toda la edición se rechaza con `403` (no se guarda nada, tampoco el nombre ni el teléfono). Dejar en la lista una banda ajena que el alumno ya tiene no cuenta como agregarla.

**Respuesta 200:** `{ "mensaje": "Alumno actualizado correctamente" }`

Cuando un Profesor envía `bandas` y el alumno tiene otras bandas que no son suyas y no venían en la lista, la respuesta las informa (es solo un aviso: esas bandas se dejaron como estaban):

```json
{
  "mensaje": "Alumno actualizado correctamente",
  "bandas_sin_modificar": [ { "id_banda": 2, "nombre_banda": "Banda Clásica" } ]
}
```

**Errores:** `400` datos inválidos, teléfono corto o bandas inexistentes/inactivas (con `bandas_invalidas`); `403` un Profesor sin acceso a este alumno, o que intenta agregar una banda que no tiene asignada; `404` el alumno no existe o está inactivo.

El `403` por bandas ajenas indica cuáles (si son varias, las lista todas) y devuelve sus ids:

```json
{
  "mensaje": "No puedes modificar la banda \"Orquesta\" porque no está asignada a ti",
  "bandas_no_permitidas": [3]
}
```

### PATCH /api/alumnos/:id/reactivar

**Admin.** Vuelve a activar un alumno eliminado; recupera sus membresías e historial de asistencia.

**Respuesta 200**

```json
{
  "mensaje": "Alumno reactivado correctamente",
  "alumno": {
    "id_alumno": 5,
    "nombre": "Juan Pérez",
    "telefono": "12345678",
    "direccion": "Ciudad",
    "fecha_inscripcion": "2026-08-10",
    "activo": true
  }
}
```

**Error 404:** el alumno no existe o ya estaba activo.

### DELETE /api/alumnos/:id

**Token** (un Profesor necesita acceso al alumno, ver arriba). Desactiva al alumno (`activo = false`); conserva sus membresías y su historial.

**Respuesta 200:** `{ "mensaje": "Alumno eliminado correctamente" }`. **Errores:** `403` un Profesor sin acceso a este alumno; `404` no existe o ya estaba inactivo.

---

## Asistencia

Las rutas de asistencia exigen **Token + banda**: un Admin pasa siempre; un Profesor debe estar asignado a la banda. El profesor que registra queda guardado como `id_profesor` del ensayo y como `registrado_por` de cada asistencia.

Ambos registros se hacen en una **transacción**: si algo falla no queda ningún ensayo o presentación a medias. Antes de guardar se valida que la banda exista y esté activa, y que cada alumno de `asistencias` sea un alumno activo de esa banda. Los que no lo sean **no se insertan** y se devuelven en `omitidos`.

Cada elemento de `asistencias` lleva:

| Campo | Tipo | Obligatorio | Nota |
|---|---|---|---|
| `id_alumno` | entero | Sí | |
| `asistio` | booleano | Sí | Debe ser `true` o `false` (no texto). |
| `justificacion` | texto | No | Motivo de la falta. |

No puede haber el mismo `id_alumno` dos veces en la lista.

### POST /api/asistencia/ensayo

**Token + banda** (`id_banda` en el body). Crea un ensayo y registra la asistencia.

```json
{
  "id_banda": 1,
  "descripcion": "Ensayo semanal",
  "fecha": "2026-09-20",
  "hora": "16:00",
  "lugar": "Salón principal",
  "asistencias": [
    { "id_alumno": 1, "asistio": true },
    { "id_alumno": 2, "asistio": false, "justificacion": "Enfermo" },
    { "id_alumno": 9, "asistio": true }
  ]
}
```

`id_banda` es obligatorio. `descripcion`, `fecha` (`AAAA-MM-DD`), `hora` y `lugar` son opcionales: los que no se envían usan el valor por defecto de la base de datos. `asistencias` es opcional (sin ella solo se crea el ensayo).

**Respuesta 201**

```json
{
  "mensaje": "Asistencia de ensayo registrada con éxito",
  "id_ensayo": 12,
  "registrados": 2,
  "omitidos": [9]
}
```

Aquí `9` no pertenece a la banda, así que se omitió.

**Errores:** `400` `id_banda` inválido, la banda no existe o está inactiva, `asistencias` mal formadas o con alumnos repetidos, `lugar` de más de 150 caracteres, o fecha/hora con formato inválido; `403` un Profesor sin acceso a esa banda.

### POST /api/asistencia/presentacion

**Token + banda** (`id_banda` en el body). Crea una presentación y registra la asistencia.

```json
{
  "id_banda": 1,
  "fecha": "2026-09-27",
  "lugar_presentacion": "Auditorio principal",
  "descripcion": "Concierto de fin de año",
  "asistencias": [
    { "id_alumno": 1, "asistio": true },
    { "id_alumno": 2, "asistio": false }
  ]
}
```

`id_banda`, `fecha` y `lugar_presentacion` son obligatorios. `descripcion` y `asistencias` son opcionales.

**Respuesta 201**

```json
{
  "mensaje": "Asistencia de presentación registrada con éxito",
  "id_presentacion": 4,
  "registrados": 2,
  "omitidos": []
}
```

**Errores:** los mismos que el ensayo (con el límite de 150 caracteres aplicado a `lugar_presentacion`), más `400` si falta la fecha o el lugar.

### GET /api/asistencia/porcentaje

**Token + banda** (`id_banda` en el query string). Consulta `vista_asistencia_alumno` y marca a los alumnos que están por debajo del porcentaje mínimo. El mínimo es el propio de la banda si tiene uno en `config_asistencia`, y si no el general (80 % en la base actual).

| Parámetro | Obligatorio | Nota |
|---|---|---|
| `id_banda` | Un Profesor **debe** enviarlo. Un Admin puede omitirlo. | Filtra por banda. |
| `id_alumno` | No | Filtra por alumno. |

Un Admin que no envía ningún filtro obtiene todas las filas de la vista (solo de alumnos y bandas activos).

Si se pide un `id_alumno` o un `id_banda` concretos, ese alumno o esa banda deben existir y estar **activos**; si no, la respuesta es `404` con `"Alumno o banda no encontrados o inactivos"`. Un alumno y una banda activos que simplemente no tienen registros de asistencia devuelven `200` con la lista vacía.

Ejemplo: `GET /api/asistencia/porcentaje?id_banda=1&id_alumno=2`

```json
{
  "total": 1,
  "filtros": { "id_alumno": "2", "id_banda": "1" },
  "datos": [
    {
      "id_alumno": 2,
      "alumno_nombre": "María López",
      "id_banda": 1,
      "nombre_banda": "Banda de Paz",
      "total_eventos": 10,
      "total_asistencias": 6,
      "porcentaje_asistencia": 60,
      "porcentaje_minimo_requerido": 75,
      "en_riesgo": true
    }
  ]
}
```

`en_riesgo` es `true` cuando `porcentaje_asistencia` es menor que `porcentaje_minimo_requerido` (con 80 %, un alumno con exactamente 80 % no está en riesgo). Detalle de la vista: solo aparecen los alumnos que tienen **al menos un registro de asistencia** en esa banda (un alumno sin registros no tiene fila). La vista en sí no filtra por `activo`, pero este endpoint sí: excluye a los alumnos y las bandas desactivados.

**Errores:** `400` `id_alumno` o `id_banda` inválidos, o un Profesor que no envía `id_banda`; `403` un Profesor sin acceso a esa banda; `404` el alumno o la banda pedidos no existen o están desactivados.

---

## Reportes

El historial y el resumen por banda se **limitan a las bandas del profesor**: un Admin ve todas; un Profesor solo las bandas en las que está asignado (`profesor_banda`), sin importar qué `id_banda` envíe. Si un Profesor pide una banda que no es suya, no recibe error sino una lista vacía. El resumen general es solo para Admin.

### GET /api/reportes/historial

**Token** (Profesor: solo sus bandas; Admin: todas). Historial de asistencia de **ensayos y presentaciones** unidos en una sola lista, del más reciente al más antiguo.

| Parámetro | Descripción |
|---|---|
| `id_alumno` | Solo ese alumno. |
| `id_banda` | Solo esa banda. Un Profesor que pide una banda ajena recibe una lista vacía. |
| `fecha` | Solo esa fecha, formato `AAAA-MM-DD`. |
| `tipo` | `ensayo` o `presentacion` (no distingue mayúsculas). |

Ejemplo: `GET /api/reportes/historial?id_banda=1&tipo=presentacion`

```json
{
  "total": 1,
  "filtros": { "id_alumno": null, "id_banda": "1", "fecha": null, "tipo": "presentacion" },
  "datos": [
    {
      "id_alumno": 1,
      "alumno": "Juan Pérez",
      "id_banda": 1,
      "nombre_banda": "Banda de Paz",
      "id_evento": 4,
      "descripcion": "Concierto de fin de año",
      "id_profesor": null,
      "asistio": true,
      "justificacion": null,
      "registrado_por": 1,
      "fecha": "2026-09-27",
      "hora": null,
      "lugar": "Auditorio principal",
      "tipo_evento": "presentacion"
    }
  ]
}
```

- `id_evento` es el id del ensayo o de la presentación, según `tipo_evento`.
- En las presentaciones `id_profesor` y `hora` son `null`; `lugar` toma el valor de `lugar_presentacion`.
- `descripcion` es "Sin descripción" cuando el evento no tiene.
- El historial incluye también registros de alumnos o bandas que luego fueron desactivados.

**Errores:** `400` `id_alumno`/`id_banda` inválidos, `fecha` con otro formato o `tipo` distinto de `ensayo`/`presentacion`.

### GET /api/reportes/resumen-bandas

**Token** (Profesor: solo sus bandas; Admin: todas). Por cada banda activa: alumnos activos y total de registros de asistencia de sus ensayos, ordenadas por nombre. Cuenta registros reales: un alumno con 10 asistencias suma 10.

```json
{
  "total_bandas": 2,
  "datos": [
    { "id_banda": 1, "nombre_banda": "Banda de Paz", "total_alumnos": 18, "asistencias": 140, "faltas": 22 },
    { "id_banda": 2, "nombre_banda": "Orquesta Juvenil", "total_alumnos": 12, "asistencias": 95, "faltas": 10 }
  ]
}
```

Solo considera la asistencia a ensayos (no a presentaciones).

### GET /api/reportes/resumen-general

**Admin.** Totales de toda la fundación (un Profesor recibe `403`). Alumnos, bandas y profesores cuentan solo los activos; ensayos cuenta todos los registrados.

```json
{
  "resumen": {
    "total_alumnos": 30,
    "total_bandas": 2,
    "total_profesores": 4,
    "total_ensayos": 58
  }
}
```

---

## Códigos de estado

| Código | Significado |
|---|---|
| 200 | Operación correcta. |
| 201 | Registro creado. |
| 400 | Datos inválidos o faltantes, texto demasiado largo, o regla de negocio incumplida. |
| 401 | Falta el token, es inválido, o las credenciales del login son incorrectas. |
| 403 | El rol o la asignación a la banda no permiten la operación. |
| 404 | El recurso no existe, está inactivo o (en reactivar) ya estaba activo. |
| 409 | Conflicto con un dato único (nombre de banda, correo de profesor) o asignación repetida. |
| 500 | Error interno del servidor. |
