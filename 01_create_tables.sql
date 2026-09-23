-- ============================================================
-- RussBrass - Sistema de asistencia
-- 01_create_tables.sql
-- Crea todas las tablas, índices y la vista de asistencia.
-- No incluye datos de prueba (ver 02_seed_data.sql).
-- PostgreSQL
-- ============================================================

-- ------------------------------------------------------------
-- Profesores
-- ------------------------------------------------------------
CREATE TABLE profesores (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    correo          VARCHAR(150) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,      -- SIEMPRE bcrypt, nunca texto plano
    rol             VARCHAR(20) NOT NULL DEFAULT 'profesor'
                        CHECK (rol IN ('admin', 'profesor')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Bandas (los 3 tipos: paz, clásica, orquesta)
-- ------------------------------------------------------------
CREATE TABLE bandas (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL UNIQUE,
    tipo        VARCHAR(20) NOT NULL
                    CHECK (tipo IN ('paz', 'clasica', 'orquesta')),
    descripcion TEXT,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Alumnos
-- ------------------------------------------------------------
CREATE TABLE alumnos (
    id                SERIAL PRIMARY KEY,
    nombre            VARCHAR(150) NOT NULL,
    fecha_nacimiento  DATE,
    telefono_contacto VARCHAR(30),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Qué profesor da clase en qué banda(s).
-- El admin NO necesita filas aquí: su acceso a todo se resuelve
-- por rol = 'admin' en el backend, no por esta tabla.
-- ------------------------------------------------------------
CREATE TABLE profesor_banda (
    profesor_id INTEGER NOT NULL REFERENCES profesores(id) ON DELETE CASCADE,
    banda_id    INTEGER NOT NULL REFERENCES bandas(id) ON DELETE CASCADE,
    asignado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (profesor_id, banda_id)
);

-- ------------------------------------------------------------
-- Qué alumno pertenece a qué banda(s)
-- ------------------------------------------------------------
CREATE TABLE alumno_banda (
    alumno_id     INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    banda_id      INTEGER NOT NULL REFERENCES bandas(id) ON DELETE CASCADE,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (alumno_id, banda_id)
);

-- ------------------------------------------------------------
-- Ensayos (siempre de UNA banda)
-- ------------------------------------------------------------
CREATE TABLE ensayo (
    id         SERIAL PRIMARY KEY,
    banda_id   INTEGER NOT NULL REFERENCES bandas(id) ON DELETE RESTRICT,
    fecha      DATE NOT NULL,
    hora       TIME,
    lugar      VARCHAR(150),
    notas      TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Presentaciones (pueden ser de una o varias bandas)
-- ------------------------------------------------------------
CREATE TABLE presentacion (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    fecha       DATE NOT NULL,
    lugar       VARCHAR(150),
    descripcion TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE presentacion_banda (
    presentacion_id INTEGER NOT NULL REFERENCES presentacion(id) ON DELETE CASCADE,
    banda_id        INTEGER NOT NULL REFERENCES bandas(id) ON DELETE RESTRICT,
    PRIMARY KEY (presentacion_id, banda_id)
);

-- ------------------------------------------------------------
-- Asistencia a ensayos
-- ------------------------------------------------------------
CREATE TABLE asistencia_ensayo (
    id             SERIAL PRIMARY KEY,
    ensayo_id      INTEGER NOT NULL REFERENCES ensayo(id) ON DELETE CASCADE,
    alumno_id      INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    presente       BOOLEAN NOT NULL DEFAULT FALSE,
    justificacion  TEXT,
    registrado_por INTEGER REFERENCES profesores(id) ON DELETE SET NULL,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (ensayo_id, alumno_id)   -- un alumno no puede tener 2 registros en el mismo ensayo
);

-- ------------------------------------------------------------
-- Asistencia a presentaciones
-- ------------------------------------------------------------
CREATE TABLE asistencia_presentacion (
    id              SERIAL PRIMARY KEY,
    presentacion_id INTEGER NOT NULL REFERENCES presentacion(id) ON DELETE CASCADE,
    alumno_id       INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    presente        BOOLEAN NOT NULL DEFAULT FALSE,
    justificacion   TEXT,
    registrado_por  INTEGER REFERENCES profesores(id) ON DELETE SET NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (presentacion_id, alumno_id)
);

-- ------------------------------------------------------------
-- Margen de asistencia mínimo (global si banda_id es NULL,
-- o específico por banda)
-- ------------------------------------------------------------
CREATE TABLE config_asistencia (
    id                SERIAL PRIMARY KEY,
    banda_id          INTEGER UNIQUE REFERENCES bandas(id) ON DELETE CASCADE,
    porcentaje_minimo NUMERIC(5,2) NOT NULL DEFAULT 80.00
                          CHECK (porcentaje_minimo BETWEEN 0 AND 100)
);

-- Config global por defecto (banda_id NULL = aplica a todos)
INSERT INTO config_asistencia (banda_id, porcentaje_minimo) VALUES (NULL, 80.00);

-- ------------------------------------------------------------
-- Índices para las consultas más comunes (listar por banda/fecha)
-- ------------------------------------------------------------
CREATE INDEX idx_ensayo_banda_fecha ON ensayo(banda_id, fecha);
CREATE INDEX idx_asistencia_ensayo_alumno ON asistencia_ensayo(alumno_id);
CREATE INDEX idx_asistencia_presentacion_alumno ON asistencia_presentacion(alumno_id);

-- ------------------------------------------------------------
-- Vista: % de asistencia de cada alumno, por banda
-- Junta ensayos + presentaciones en un solo cálculo
-- ------------------------------------------------------------
CREATE VIEW vista_asistencia_alumno AS
WITH eventos AS (
    SELECT ab.alumno_id, ab.banda_id,
           ae.presente
    FROM alumno_banda ab
    JOIN ensayo e             ON e.banda_id = ab.banda_id
    JOIN asistencia_ensayo ae ON ae.ensayo_id = e.id AND ae.alumno_id = ab.alumno_id

    UNION ALL

    SELECT ab.alumno_id, ab.banda_id,
           ap.presente
    FROM alumno_banda ab
    JOIN presentacion_banda pb      ON pb.banda_id = ab.banda_id
    JOIN asistencia_presentacion ap ON ap.presentacion_id = pb.presentacion_id AND ap.alumno_id = ab.alumno_id
)
SELECT
    a.id                                   AS alumno_id,
    a.nombre                               AS alumno_nombre,
    b.id                                   AS banda_id,
    b.nombre                               AS banda_nombre,
    COUNT(ev.presente)                     AS total_eventos,
    COUNT(*) FILTER (WHERE ev.presente)    AS total_asistencias,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE ev.presente) / NULLIF(COUNT(ev.presente), 0),
        2
    )                                       AS porcentaje_asistencia,
    COALESCE(cb.porcentaje_minimo, cg.porcentaje_minimo) AS porcentaje_minimo_requerido
FROM eventos ev
JOIN alumnos a ON a.id = ev.alumno_id
JOIN bandas b  ON b.id = ev.banda_id
LEFT JOIN config_asistencia cb ON cb.banda_id = b.id
LEFT JOIN config_asistencia cg ON cg.banda_id IS NULL
GROUP BY a.id, a.nombre, b.id, b.nombre, cb.porcentaje_minimo, cg.porcentaje_minimo;
