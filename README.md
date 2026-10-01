# Sistema de Gestión de Solicitudes de Soporte

Proyecto de mesa de ayuda del expediente GEX006. Permite registrar solicitudes
de soporte, asignarlas a un agente y darles seguimiento hasta que se cierran.
Cada usuario entra con un rol y solamente ve las funciones que le corresponden.

## Requisitos

- Node.js 18 o superior.
- Una base de datos en Supabase con las tablas `usuarios` y `solicitudes`.

## Cómo levantarlo

### Backend

En la raíz del proyecto hay que crear un archivo `.env`:

    PORT=4000
    SUPABASE_URL=https://tu-proyecto.supabase.co
    SUPABASE_KEY=clave_del_proyecto

Ese archivo no se sube al repositorio.

Después, en la raíz:

    npm install
    npm run dev

El servicio queda escuchando en http://localhost:4000

### Frontend

    cd frontend
    npm install
    npm run dev

La aplicación queda en http://localhost:5173. Vite ya deriva las llamadas a
`/api` hacia el puerto 4000, así que no hace falta configurar nada más.

## Roles

| Rol | Qué hace |
| --- | --- |
| Solicitante | Crea y consulta sus propias solicitudes |
| Agente | Atiende la cola y avanza los estados |
| Coordinador | Prioriza, asigna agentes y consulta los indicadores |
| Auditor | Solo lectura (pendiente) |

Hay una cuenta de prueba por rol. Las contraseñas las pasamos por el grupo,
no las dejamos escritas acá.

## Avance

Sprint 1 (HU01 a HU04): inicio de sesión por rol, alta de solicitudes,
consulta de las propias y priorización desde el panel del coordinador.

Sprint 2 (HU05 a HU08): asignación de agente, comentarios de trabajo entre el
equipo, cambio de estado según el rol y reapertura de una solicitud indicando
el motivo.

También desde el Sprint 2, subir una solicitud a prioridad Alta exige
justificación y fecha objetivo. Vale tanto al crearla como al cambiarla desde
el panel, y la fecha no puede ser anterior a hoy.

Pendiente: HU09 y HU10 (búsqueda con filtros y tablero de indicadores) y
HU11 y HU12 (acceso de solo lectura para el auditor y reporte).

## Estructura

    server.js     API en Express
    password.js   utilidad para generar y migrar contraseñas (scrypt)
    frontend/     aplicación en React con Vite
    docs/         documentación de planeación

## Desarrollo

Para revisar el código del frontend:

    cd frontend
    npm run lint
