-- =====================================================================
-- Migracion 02: tablas para el sitio publico (blog, inscripciones, testimonios)
--
-- Agrega 3 tablas nuevas, sin tocar ninguna existente:
--   - entrada_blog: entradas del blog que publica un Admin.
--   - solicitud_inscripcion: formulario publico de interes en inscribirse.
--     No crea un alumno; es solo un contacto por revisar (campo `estado`).
--   - testimonio: testimonios de padres, alumnos o profesores para el sitio publico.
--
-- Para bases que YA existen. Las bases nuevas creadas con
-- "Script de creacion de base de datos.txt" ya las incluyen (items 12-14).
-- Es seguro repetirla: IF NOT EXISTS evita el error si las tablas ya estan.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.entrada_blog (
	id_entrada serial4 NOT NULL,
	titulo varchar(150) NOT NULL,
	resumen text NOT NULL,
	foto varchar(255) NULL,
	enlace_facebook varchar(500) NULL,
	fecha date DEFAULT CURRENT_DATE NOT NULL,
	activo bool DEFAULT true NOT NULL,
	creado_por int4 NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT entrada_blog_pkey PRIMARY KEY (id_entrada),
	CONSTRAINT entrada_blog_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES public.profesor(id_profesor) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.solicitud_inscripcion (
	id_solicitud serial4 NOT NULL,
	nombre_alumno varchar(150) NOT NULL,
	edad int4 NULL,
	banda_interes varchar(20) NULL,
	nombre_contacto varchar(150) NOT NULL,
	telefono_contacto varchar(30) NOT NULL,
	correo_contacto varchar(150) NULL,
	mensaje text NULL,
	estado varchar(20) DEFAULT 'pendiente'::character varying NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT solicitud_inscripcion_pkey PRIMARY KEY (id_solicitud),
	CONSTRAINT solicitud_inscripcion_banda_interes_check CHECK (banda_interes::text = ANY (ARRAY['paz'::character varying, 'clasica'::character varying, 'orquesta'::character varying]::text[])),
	CONSTRAINT solicitud_inscripcion_estado_check CHECK (estado::text = ANY (ARRAY['pendiente'::character varying, 'contactado'::character varying, 'inscrito'::character varying, 'descartado'::character varying]::text[]))
);

CREATE TABLE IF NOT EXISTS public.testimonio (
	id_testimonio serial4 NOT NULL,
	autor varchar(150) NOT NULL,
	rol varchar(20) NULL,
	texto text NOT NULL,
	foto varchar(255) NULL,
	activo bool DEFAULT true NOT NULL,
	created_at timestamp DEFAULT now() NOT NULL,
	CONSTRAINT testimonio_pkey PRIMARY KEY (id_testimonio),
	CONSTRAINT testimonio_rol_check CHECK (rol::text = ANY (ARRAY['padre'::character varying, 'alumno'::character varying, 'profesor'::character varying]::text[]))
);
