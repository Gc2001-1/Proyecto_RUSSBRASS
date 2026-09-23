-- =====================================================================
-- Migracion 01: una sola fila de configuracion general de asistencia
--
-- Problema: config_asistencia.id_banda es UNIQUE, pero en PostgreSQL varios NULL no
-- se consideran iguales, asi que nada impedia insertar dos filas "generales"
-- (id_banda NULL). Con dos, vista_asistencia_alumno repetiria filas de alumnos.
--
-- Solucion: un indice unico parcial sobre la expresion (id_banda IS NULL), que
-- solo aplica a las filas generales y deja pasar libremente las filas por banda.
--
-- Para bases que YA existen. Las bases nuevas creadas con
-- "Script de creacion de base de datos.txt" ya lo incluyen.
-- Es seguro repetirla: IF NOT EXISTS evita el error si el indice ya esta.
-- Falla (sin cambiar nada) si la tabla ya tiene dos o mas filas generales; en ese caso
-- hay que borrar la sobrante antes:  SELECT * FROM public.config_asistencia WHERE id_banda IS NULL;
-- =====================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_config_asistencia_global
	ON public.config_asistencia ((id_banda IS NULL))
	WHERE id_banda IS NULL;
