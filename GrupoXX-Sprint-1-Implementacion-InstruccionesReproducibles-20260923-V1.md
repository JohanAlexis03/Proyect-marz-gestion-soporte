# Instrucciones Reproducibles de Despliegue Local (Sprint 1)
**Documento:** `GrupoXX-Sprint-1-Implementacion-InstruccionesReproducibles-20260923-V1.md`  
**Fecha:** 2026-09-23  
**Versión:** 1.0  
**Proyecto:** Sistema de Gestión de Solicitudes de Soporte (HU01 y HU04)

---

## 1. Requisitos Previos

1. **Node.js**: Versión 18 o superior instalada.
2. **Cuenta y Base de Datos en Supabase**:
   - Tablas requeridas ya creadas:
     - `usuarios` (`id`, `email`, `rol`)
     - `solicitudes` (`id`, `titulo`, `descripcion`, `categoria`, `estado`, `prioridad`, `fecha`, `propietario_id`, `historial`)
   - Roles válidos: `Solicitante`, `Agente`, `Coordinador`, `Auditor`.

---

## 2. Configuración de Variables de Entorno (Backend)

En la raíz del proyecto (`Proyecto_Soporte/`), edita el archivo [.env](file:///c:/Users/USUARIO/Desktop/Proyecto_Soporte/.env) con tus credenciales de Supabase:

```env
PORT=4000
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_supabase_anon_o_service_role_key
```

---

## 3. Instalación y Ejecución del Backend

Abre una terminal en la carpeta principal del proyecto (`Proyecto_Soporte`):

```bash
# 1. Instalar dependencias del backend (Express, Supabase, CORS, Dotenv)
npm install

# 2. Iniciar el servidor backend
npm run dev
# o alternativamente:
node server.js
```

El servidor quedará escuchando en: `http://localhost:4000`

---

## 4. Instalación y Ejecución del Frontend (React + Vite)

Abre una **segunda terminal** en la carpeta principal y accede a la carpeta `frontend`:

```bash
# 1. Entrar al directorio del frontend
cd frontend

# 2. Instalar dependencias (React, Vite, React Router)
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

Abre tu navegador en la URL que indique Vite (generalmente `http://localhost:5173`).

---

## 5. Pruebas y Validación de Historias de Usuario

### 5.1. HU01: Autenticación / Login
1. En la pantalla de login (`http://localhost:5173/login`), ingresa un correo existente en tu tabla `usuarios` (por ejemplo: `coordinador@test.com`).
2. Si el correo no existe, el sistema mostrará el mensaje de error: `"Credenciales inválidas"`.
3. Al ingresar un correo con rol `Coordinador`, el sistema almacena el token y rol en `localStorage` y redirige automáticamente a `/coordinador`.
4. Si ingresas con un rol distinto (ej. `Solicitante`), redirige a una vista restringida impidiendo el acceso a `/coordinador`.

### 5.2. HU04: Gestión y Priorización en Vivo (Coordinador)
1. Estando en el panel (`/coordinador`), se visualiza la tabla HTML con todas las solicitudes registradas.
2. **Ordenamiento:** Usa los selectores superiores para ordenar por `Fecha`, `Prioridad` o `Estado` (Ascendente/Descendente).
3. **Cambio de Prioridad en Vivo:** En la columna "Prioridad (En Vivo)", selecciona una nueva opción (`Baja`, `Media`, `Alta`).
4. **Historial:** Observa cómo se actualiza automáticamente el estado en vivo y se concatena la trazabilidad en texto plano dentro del campo `historial` indicando la fecha, la prioridad anterior/nueva y el usuario coordinador que realizó el cambio.
