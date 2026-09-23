# Documentación Formal del Proyecto

> Este documento describe el mundo/contexto original del proyecto. Para el avance por fases, ver [`ESTADO_DEL_PROYECTO.md`](ESTADO_DEL_PROYECTO.md); para la referencia técnica vigente, ver [`../banda-backend/README.md`](../banda-backend/README.md) y [`../banda-backend/docs/API.md`](../banda-backend/docs/API.md).

## Título del proyecto
Sistema web de control de asistencia para profesores

## Datos del estudiante
Nombre del estudiante: Moisés David García Casco
Carné: GC251462
Fundación: SumbraSS

## 1. Introducción

El presente documento tiene como finalidad presentar de manera formal y organizada el desarrollo del proyecto de horas sociales titulado “Sistema web de control de asistencia para profesores”. Este proyecto busca digitalizar y optimizar el proceso de registro de asistencia de los alumnos, facilitando a los docentes la gestión de información de manera más rápida, segura y eficiente.

La propuesta se desarrolla con el objetivo de brindar una herramienta tecnológica que permita a los profesores llevar un control claro y estructurado de la asistencia, reduciendo el uso de métodos manuales y mejorando la organización del proceso educativo.

## 2. Justificación

El registro de asistencia en entornos educativos o de formación suele realizarse de manera manual, lo que puede generar errores humanos, pérdidas de información y falta de trazabilidad. Por ello, se considera necesario implementar una solución digital que permita registrar, consultar y administrar la asistencia de los alumnos de forma más efectiva.

Este sistema aporta valor al facilitar la labor docente, mejorando la organización y promoviendo un manejo más moderno de los datos relacionados con la asistencia.

## 3. Objetivo general

Desarrollar una plataforma web que permita a los profesores registrar y administrar la asistencia de los alumnos de manera digital, segura y organizada.

## 4. Objetivos específicos

- Implementar un sistema de autenticación para profesores.
- Permitir el registro de alumnos dentro del sistema.
- Gestionar la asistencia de los alumnos en actividades como ensayos y presentaciones.
- Crear una base tecnológica escalable para futuras mejoras.
- Facilitar la organización y consulta de información relevante para los docentes.

## 5. Alcance del proyecto

El proyecto contempla el desarrollo de una solución backend funcional que permita:

- iniciar sesión en el sistema,
- gestionar información de alumnos,
- asociar alumnos a bandas o grupos,
- registrar asistencia de los alumnos en eventos específicos,
- proteger las rutas mediante autenticación con tokens.

## 6. Descripción del sistema

El sistema está diseñado como una aplicación web orientada al uso de docentes y personal encargado de la supervisión de grupos. A través de una interfaz de acceso segura, los profesores podrán ingresar al sistema y registrar la asistencia de los alumnos de forma rápida y organizada.

La arquitectura del proyecto se basa en un backend desarrollado con tecnologías modernas que permiten la conexión con una base de datos relacional, así como la gestión de usuarios y registros de asistencia.

## 7. Tecnologías utilizadas

### Backend
- Node.js
- Express.js
- PostgreSQL
- JWT para autenticación
- bcryptjs para protección de contraseñas
- dotenv para manejo de variables de entorno
- cors para integración segura entre servicios

### Herramientas de apoyo
- Visual Studio Code
- Postman / REST Client para pruebas de API
- Git para control de versiones

## 8. Estructura del proyecto

El proyecto se organiza en módulos principales para facilitar su mantenimiento y escalabilidad:

- server.js: archivo principal que inicializa el servidor.
- src/config: configuración de la conexión a la base de datos.
- src/controllers: lógica del negocio del sistema.
- src/routes: definición de rutas de la API.
- src/middlewares: autenticación y protección de accesos.

## 9. Funcionalidades implementadas

Durante el desarrollo del proyecto se han implementado las siguientes funcionalidades:

### Autenticación
- Inicio de sesión para profesores.
- Generación de tokens de seguridad.
- Protección de rutas mediante middleware de autenticación.

### Gestión de alumnos
- Registro de nuevos alumnos.
- Consulta de alumnos registrados.
- Eliminación de alumnos.
- Consulta de alumnos por identificador.
- Asociación de alumnos a bandas.

### Registro de asistencia
- Registro de asistencia para ensayos.
- Registro de asistencia para presentaciones.

## 10. Estado actual del proyecto

Actualmente, el proyecto se encuentra en una etapa inicial pero funcional del desarrollo backend. Se ha establecido la base necesaria para continuar con la ampliación del sistema, incorporando nuevas funcionalidades que permitan una gestión más completa de la información.

## 11. Beneficios esperados

El desarrollo de este sistema permitirá:

- agilizar el proceso de registro de asistencia,
- reducir errores humanos,
- mejorar la organización de la información,
- ofrecer una herramienta moderna y accesible para los docentes,
- sentar las bases para futuras mejoras del sistema.

## 12. Proyecciones futuras

Como siguiente paso, se contempla ampliar el sistema con funcionalidades adicionales, tales como:

- edición de datos de alumnos,
- gestión completa de bandas,
- administración de profesores,
- historial detallado de asistencias,
- reportes estadísticos,
- implementación de una interfaz web para usuarios finales.

## 13. Conclusión

El proyecto “Sistema web de control de asistencia para profesores” representa una solución práctica y útil para mejorar la organización y el control de la asistencia de los alumnos. Su desarrollo contribuye tanto al fortalecimiento de habilidades tecnológicas como a la creación de una herramienta con potencial de aplicación real en contextos educativos.

Este trabajo constituye un avance significativo dentro del proceso de horas sociales, demostrando la capacidad de diseñar, desarrollar y documentar una solución tecnológica funcional y orientada a resolver una necesidad concreta.

## 14. Registro de avance para horas sociales

### Avances logrados
- Se creó la estructura base del backend.
- Se estableció la conexión con PostgreSQL.
- Se implementó el sistema de inicio de sesión con autenticación mediante JWT.
- Se desarrolló la gestión básica de alumnos.
- Se incorporó el registro de asistencia para ensayos y presentaciones.

### Estado de desarrollo
- El proyecto presenta una base funcional.
- Se cuenta con un sistema inicial de autenticación y gestión de datos.
- Se requiere continuar con la expansión de funcionalidades para alcanzar un sistema más completo.

### Próximos pasos recomendados
- implementar módulos de gestión de bandas,
- ampliar la administración de profesores,
- mejorar validaciones y seguridad,
- desarrollar la interfaz web del sistema,
- integrar el frontend con el backend.
