# Banda Backend

## Descripción general

Este proyecto es el backend de una aplicación web para la gestión de bandas musicales y el control de asistencia de sus alumnos. Permite a los profesores registrar ensayos y presentaciones, llevar el seguimiento de asistencia por alumno y por banda, y consultar reportes, todo protegido con autenticación mediante JWT y permisos por rol.

Desarrollado como parte del proceso de horas sociales por Moisés David García Casco, carnet GC251462, en la Fundación SumbraSS.

## Objetivo del proyecto

Desarrollar una solución funcional que facilite a los profesores el registro y seguimiento de la asistencia de los alumnos, reduciendo el uso de métodos manuales y mejorando la organización de la información.

## Funcionalidades

- **Autenticación:** inicio de sesión con contraseña protegida con bcrypt y tokens JWT de 8 horas.
- **Roles y permisos:** los usuarios son `Admin` o `Profesor`. Los Admin administran profesores y bandas; los Profesores registran asistencia solo en las bandas a las que están asignados.
- **Profesores:** crear, consultar, editar, desactivar y reactivar (solo Admin para modificar).
- **Bandas:** crear, consultar, editar, desactivar y reactivar, con `tipo` (`paz`, `clasica` u `orquesta`) y descripción. Asignación de profesores a cada banda.
- **Alumnos:** crear, consultar, editar, desactivar y reactivar, con pertenencia a una o varias bandas.
- **Asistencia:** registro de ensayos y presentaciones en transacciones, con justificación de faltas, validación de que el alumno pertenece a la banda y consulta del porcentaje de asistencia con alerta `en_riesgo`.
- **Reportes:** historial de asistencia (ensayos y presentaciones), resumen por banda y resumen general.
- **Borrado lógico:** profesores, bandas y alumnos no se borran de la base de datos, se desactivan.

## Tecnologías utilizadas

- Node.js
- Express.js 5
- PostgreSQL (`pg`)
- JWT (`jsonwebtoken`)
- bcryptjs
- dotenv
- cors

## Requisitos previos

- Node.js 18 o superior
- npm
- PostgreSQL instalado y en ejecución
- Una base de datos con el esquema descrito en [Base de datos](#base-de-datos)

## Instalación

1. Clona o entra en la carpeta del proyecto.
2. Instala las dependencias:

```bash
npm install
```

3. Crea un archivo `.env` a partir de `.env.example` y ajusta las variables a tu configuración local.
4. Crea el primer usuario Admin (ver [Crear el primer Admin](#crear-el-primer-admin)). La API no permite registrarse sola: crear profesores requiere ser Admin.
5. Inicia el servidor:

```bash
npm run dev
```

O de forma simple:

```bash
npm start
```

El servidor queda en `http://localhost:3000` (o en el `PORT` que definas).

### Crear el primer Admin

Como todas las rutas de gestión requieren un Admin, el primero debe insertarse directamente en la base de datos. Genera el hash de la contraseña:

```bash
node -e "console.log(require('bcryptjs').hashSync('TuContraseñaSegura', 10))"
```

Y guárdalo en `profesor` (reemplaza el hash y los datos):

```sql
INSERT INTO public.profesor (nombre, correo, contrasena, rol, activo)
VALUES ('Administrador', 'admin@ejemplo.com', '<hash-generado>', 'Admin', true);
```

Desde ahí, ese Admin crea a los demás profesores con `POST /api/profesores`. Las contraseñas guardadas en texto plano **no** funcionan: el login solo compara contra hashes bcrypt.

## Variables de entorno

- `PORT`: puerto del servidor.
- `DB_USER`: usuario de PostgreSQL.
- `DB_PASSWORD`: contraseña de PostgreSQL.
- `DB_HOST`: host de PostgreSQL.
- `DB_PORT`: puerto de PostgreSQL.
- `DB_NAME`: nombre de la base de datos.
- `JWT_SECRET`: clave secreta para firmar los tokens JWT. Usa un valor largo y aleatorio.

## Estructura del proyecto

```text
banda-backend/
├── server.js
├── package.json
├── .env.example
├── docs/
│   └── API.md                  # Referencia completa de endpoints
├── frontend/                   # Sitio público y panel de profesores (HTML, CSS y JS plano, sin frameworks)
│   ├── index.html              # Página pública de la fundación
│   ├── login.html              # Acceso de profesores
│   ├── dashboard.html          # Panel (bandas, asistencia, porcentajes y, para Admin, administración)
│   ├── css/panel.css           # Estilos del panel (mismo sistema visual que la página pública)
│   ├── js/                     # config, api (sesión y llamadas), ui, datos y una vista por archivo
│   └── assets/                 # Logo y fotos
├── src/
│   ├── config/
│   │   └── db.js               # Pool de PostgreSQL: query, getClient (transacciones) y pool
│   ├── controllers/
│   │   ├── alumnoController.js
│   │   ├── asistenciaController.js
│   │   ├── authController.js
│   │   ├── bandaController.js
│   │   ├── profesorController.js
│   │   └── reporteController.js
│   ├── middlewares/
│   │   └── authMiddleware.js   # verificarToken, soloAdmin, tieneAccesoABanda
│   ├── routes/
│   │   ├── alumnoRoutes.js
│   │   ├── asistenciaRoutes.js
│   │   ├── authRoutes.js
│   │   ├── bandaRoutes.js
│   │   ├── profesorRoutes.js
│   │   └── reporteRoutes.js
│   └── utils/
│       └── validaciones.js     # esIdValido, puedeVerInactivos
└── test.http                   # Ejemplos de peticiones para probar la API
```

## Base de datos

Tablas que espera el backend (el esquema debe estar aplicado en PostgreSQL):

| Tabla | Columnas principales |
|---|---|
| `profesor` | `id_profesor`, `nombre`, `correo`, `contrasena`, `rol` (`Admin` o `Profesor`), `activo` |
| `banda` | `id_banda`, `nombre_banda`, `tipo` (`paz`, `clasica`, `orquesta`), `descripcion`, `activo` |
| `alumno` | `id_alumno`, `nombre`, `telefono`, `direccion`, `fecha_inscripcion`, `activo` |
| `profesor_banda` | `id_profesor`, `id_banda`, `asignado_en`. Qué profesor da clase en qué banda. |
| `alumno_banda` | `id_alumno`, `id_banda`, `fecha_ingreso`. A qué bandas pertenece un alumno. |
| `ensayo` | `id_ensayo`, `id_banda`, `id_profesor`, `descripcion`, `fecha`, `hora`, `lugar` |
| `presentacion` | `id_presentacion`, `id_banda`, `fecha`, `lugar_presentacion`, `descripcion` |
| `asistencia_ensayo` | `id_ensayo`, `id_alumno`, `asistio`, `justificacion`, `registrado_por` |
| `asistencia_presentacion` | `id_presentacion`, `id_alumno`, `asistio`, `justificacion`, `registrado_por` |
| `config_asistencia` | `id_banda` (opcional), `porcentaje_minimo` |

Y la vista `vista_asistencia_alumno` (`id_alumno`, `alumno_nombre`, `id_banda`, `nombre_banda`, `total_eventos`, `total_asistencias`, `porcentaje_asistencia`, `porcentaje_minimo_requerido`), que usa el endpoint de porcentaje de asistencia. Solo incluye a los alumnos que tienen al menos un registro de asistencia y no filtra por `activo`; el endpoint sí excluye a los alumnos y bandas desactivados.

El archivo `base de datos/Script de creacion de base de datos.txt` crea este esquema completo (las 10 tablas y la vista) sobre una base vacía. Ya **no borra nada**: no incluye `DROP TABLE`, y si una tabla ya existe simplemente falla sin tocar los datos.

El script se generó leyendo el catálogo de la base de datos real (tipos, valores por defecto, restricciones, llaves foráneas, índices y el cuerpo de la vista), así que reproduce ese esquema exactamente; no hay nada inferido. Incluye además el porcentaje mínimo general de asistencia (80 %, el valor de la base real) como una fila en `config_asistencia` con `id_banda` en `NULL`. Sin esa fila, `porcentaje_minimo_requerido` queda vacío y ningún alumno aparecería `en_riesgo`. Solo puede haber una: un índice único parcial (`idx_config_asistencia_global`) lo garantiza.

Si tu base de datos ya está creada y no quieres recrearla, aplica solo ese índice con la migración `base de datos/Migracion 01 - indice unico de configuracion general.sql` (es repetible sin error, y falla sin cambiar nada si ya hubiera dos filas generales).

## Roles y permisos

| Acción | Admin | Profesor |
|---|:---:|:---:|
| Iniciar sesión, consultar profesores, bandas y alumnos | Sí | Sí |
| Ver registros inactivos (`?incluir_inactivos=true`) | Sí | No |
| Crear, editar, desactivar y reactivar **profesores** | Sí | No |
| Crear, editar y desactivar **bandas** (y reactivarlas) | Sí | No |
| Asignar y quitar profesores de una banda | Sí | No |
| Reactivar alumnos | Sí | No |
| Crear **alumnos** | Sí, en cualquier banda | Sí; si indica bandas, debe estar asignado a al menos una (sin bandas, sin restricción) |
| Editar y desactivar **alumnos** | Sí | Solo si está asignado a al menos una de las bandas actuales del alumno; al editar solo puede agregar o quitar bandas propias |
| Registrar asistencia y consultar porcentaje de una banda | Sí, en cualquier banda | Solo en las bandas a las que está asignado |
| Historial de asistencia y resumen por banda | Sí, de todas las bandas | Solo de sus bandas asignadas |
| Resumen general (totales de la fundación) | Sí | No |

- **Admin:** rol con acceso total. Se valida con el middleware `soloAdmin`.
- **Profesor:** consulta la información general de profesores, bandas y alumnos, y trabaja únicamente con las bandas donde tiene una fila en `profesor_banda`: registra asistencia (middleware `tieneAccesoABanda`), gestiona los alumnos de esas bandas y ve solo sus reportes. Si no está asignado a ninguna banda recibe `403` al intentar registrar asistencia; un Admin lo asigna con `POST /api/bandas/:id_banda/profesores`.
- **Alumnos sin banda:** cualquier profesor puede crear un alumno sin bandas, pero después solo un Admin puede editarlo, eliminarlo o asignarle bandas, porque ningún profesor tiene acceso a un alumno que no pertenece a ninguna banda.
- **Bandas de un alumno:** al editar un alumno, un Profesor solo puede agregar o quitar las bandas que tiene asignadas. Las bandas ajenas del alumno se conservan intactas, y agregar una ajena se rechaza con `403`.

## Frontend

- **Página pública:** `frontend/index.html`. Sus enlaces de "Iniciar sesión" y "Acceso para profesores" llevan a `login.html`.
- **Panel:** `login.html` → `dashboard.html`.
  - **Todos:** ven sus bandas (un Profesor solo las suyas; un Admin todas), pasan asistencia de un ensayo y consultan el porcentaje de asistencia de cada alumno, con los alumnos `en_riesgo` resaltados. También pueden agregar alumnos a una banda suya.
  - **Admin:** además crea y edita bandas y profesores, y asigna o quita profesores de una banda.
  - La sesión se guarda en `localStorage` (`rb_token`, `rb_profesor`). Si la API responde `401` (token vencido), se borra y se vuelve al login.
  - Está pensado para usarse desde el celular durante un ensayo: cada alumno es una fila grande que se toca para marcarlo presente, y las marcas se guardan como borrador si se recarga la página.

**Cómo abrirlo.** `server.js` solo sirve la API, no los archivos de `frontend/`. Sírvelos con cualquier servidor estático (por ejemplo la extensión Live Server de VS Code, o `npx serve frontend`) o abre `frontend/index.html` directamente en el navegador. Debe estar corriendo el backend (`npm start`).

**Dirección de la API.** Se define en `frontend/js/config.js`: si la página se abre como archivo o desde `localhost`, usa `http://localhost:3000/api`; si se sirve desde otra dirección (por ejemplo la IP de tu computadora), busca la API en esa misma dirección, puerto 3000. Para usar otra, define `window.RB_API_BASE` antes de cargar `config.js`.

**Desde el celular.** `localhost` en un celular es el propio celular. Abre el panel con la IP de tu computadora en la red (por ejemplo `http://192.168.1.20:5500/login.html`), con el celular en la misma red Wi-Fi y el puerto 3000 permitido en el firewall de la computadora.

## Endpoints

La referencia completa (métodos, permisos, cuerpos y ejemplos de respuesta) está en [docs/API.md](docs/API.md). Resumen:

| Área | Endpoints |
|---|---|
| Autenticación | `POST /api/auth/login` |
| Profesores | `GET /api/profesores`, `GET /api/profesores/:id`, `POST`, `PUT /:id`, `PATCH /:id/reactivar`, `DELETE /:id` |
| Bandas | `GET /api/bandas`, `GET /api/bandas/:id`, `POST`, `PUT /:id`, `PATCH /:id/reactivar`, `DELETE /:id`, `POST /:id_banda/profesores`, `DELETE /:id_banda/profesores/:id_profesor` |
| Alumnos | `GET /api/alumnos`, `GET /api/alumnos/:id`, `POST`, `PUT /:id`, `PATCH /:id/reactivar`, `DELETE /:id` |
| Asistencia | `POST /api/asistencia/ensayo`, `POST /api/asistencia/presentacion`, `GET /api/asistencia/porcentaje` |
| Reportes | `GET /api/reportes/historial`, `GET /api/reportes/resumen-bandas`, `GET /api/reportes/resumen-general` |

Todas requieren el encabezado `Authorization: Bearer <token>`, salvo el login.

## Ejemplos de uso con curl

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@ejemplo.com","contrasena":"TuContraseñaSegura"}'
```

### Crear una banda (Admin)

```bash
curl -X POST http://localhost:3000/api/bandas \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre_banda":"Banda de Paz","tipo":"paz","descripcion":"Banda de la comunidad"}'
```

### Registrar asistencia de un ensayo

```bash
curl -X POST http://localhost:3000/api/asistencia/ensayo \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id_banda":1,"descripcion":"Ensayo semanal","asistencias":[{"id_alumno":1,"asistio":true},{"id_alumno":2,"asistio":false,"justificacion":"Enfermo"}]}'
```

### Ver el porcentaje de asistencia de una banda

```bash
curl "http://localhost:3000/api/asistencia/porcentaje?id_banda=1" \
  -H "Authorization: Bearer TU_TOKEN"
```

## Notas de seguridad

- **Contraseñas:** se guardan y verifican únicamente con bcrypt. El login no acepta contraseñas en texto plano, y responde igual ante un correo inexistente que ante una contraseña incorrecta, para no revelar qué correos están registrados. Las cuentas inactivas no pueden iniciar sesión.
- **Tokens:** los JWT duran 8 horas y llevan el rol. Si cambias el rol o desactivas a alguien, su token anterior sigue siendo válido hasta que venza.
- **Permisos:** el rol se valida en el servidor (`soloAdmin`, `tieneAccesoABanda`) y no se puede elegir por cuenta propia: solo un Admin puede asignar el rol `Admin`.
- **Borrado lógico (soft delete):** profesores, bandas y alumnos se desactivan (`activo = false`) en lugar de borrarse, así no se pierde el historial de asistencia ni fallan las llaves foráneas. Se recuperan con las rutas `reactivar`. Las lecturas ocultan los inactivos, salvo para un Admin que use `?incluir_inactivos=true`.
- **Acceso por banda:** un Profesor solo puede registrar asistencia, gestionar alumnos y ver reportes de las bandas a las que está asignado. Los totales de toda la fundación (`resumen-general`) son solo para Admin.
- **Protección de cuentas:** un profesor no puede desactivar su propia cuenta, ni se puede desactivar al único Admin activo del sistema, para que nunca quede el sistema sin administrador.
- **Integridad de datos:** las operaciones de varios pasos (crear o editar alumnos, registrar asistencia, desactivar profesores) corren en transacciones reales de PostgreSQL. Los IDs recibidos se validan y las consultas son parametrizadas. Los textos de alumnos, bandas y profesores, y el lugar de ensayos y presentaciones, se validan contra el largo máximo de su columna (`400` con un mensaje claro en lugar de un error `500`).
- **Archivos sensibles:** `.env` contiene credenciales reales y no debe compartirse ni subirse a un repositorio. `test.http` incluye datos de prueba (token y contraseña de ejemplo): reemplázalos por los tuyos y no lo compartas con credenciales reales.

## Estado actual del proyecto

El backend cubre autenticación con roles, gestión de profesores, bandas y alumnos (con borrado lógico y reactivación), registro de asistencia de ensayos y presentaciones, porcentaje de asistencia y reportes. La referencia de la API está en [docs/API.md](docs/API.md).

Lo que **sigue pendiente**:

- **Frontend, lo que falta:** asistencia de presentaciones; editar, desactivar y reactivar alumnos, profesores y bandas desde la interfaz; historial y reportes; y corregir un ensayo ya enviado (la API no tiene rutas para editar ni borrar asistencia).
- **Página pública en celular:** `frontend/index.html` no es responsive (a 390px de ancho se pasa de la pantalla y el bloque de las tres bandas y "Misión / Visión" quedan aplastados). El panel (`login.html` y `dashboard.html`) sí lo es.
- **Asignaciones de profesores:** la API no tiene una ruta para listar los profesores de una banda ni "mis bandas" para un Profesor. El panel obtiene las bandas de un Profesor a partir de `GET /api/reportes/resumen-bandas` (que ya viene filtrado por profesor), y no puede mostrar quién está asignado a una banda.
- **Pruebas automáticas:** no hay suite de pruebas (`npm test` es un marcador).
- **Endurecimiento:** CORS está abierto a cualquier origen y no hay límite de intentos de login ni cabeceras de seguridad (por ejemplo `helmet`).
- **Lectura de alumnos:** `GET /api/alumnos` y `GET /api/alumnos/:id` devuelven todos los alumnos a cualquier profesor autenticado; solo crear, editar y eliminar se limitan por banda.

## Notas

- El archivo `.env` contiene datos sensibles y no debe compartirse públicamente.
- El archivo `test.http` sirve como referencia rápida para probar los endpoints.
