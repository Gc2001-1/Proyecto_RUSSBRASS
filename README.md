# Proyecto de Horas sociales — RussBrass

Sistema web de control de asistencia para las bandas de la Fundación RussBrass (SumbraSS), desarrollado como proyecto de horas sociales.

- **[`banda-backend/`](banda-backend/)** — la aplicación completa: API en Node.js/Express (`src/`) y el sitio público más el panel de profesores (`frontend/`). Ver [`banda-backend/README.md`](banda-backend/README.md) para instalación, endpoints y roles.
- **[`database/`](database/)** — el script SQL vigente que crea el esquema en PostgreSQL, más sus migraciones.
- **[`docs/`](docs/)** — documentación del proyecto que no vive dentro de `banda-backend/docs`: [`WORLD.md`](docs/WORLD.md) (contexto original), [`ESTADO_DEL_PROYECTO.md`](docs/ESTADO_DEL_PROYECTO.md) (bitácora de avance por fases), la documentación formal para la entrega de horas sociales (`Documentacion_Proyecto_Sistema_Asistencia.docx` y el script `generate_docx.py` que la genera a partir de `WORLD.md`), capturas del frontend (`capturas-frontend/`) e imágenes del proyecto (`imagenes/`).

La referencia de la API está en [`banda-backend/docs/API.md`](banda-backend/docs/API.md).
