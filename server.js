require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
// Puerto 4000: el 5000 lo ocupa el receptor AirPlay de macOS.
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Conexión directa a Supabase con variables de entorno
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Sesión simulada del Sprint 1
// "user-123" -> id real de usuarios; borrar cuando entre la HU01.
// ============================================================================
const SESION_SIMULADA = {
  'user-123': '3a46c322-3093-4900-b5c9-46710fa245ba', // solicitante@test.com
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolverPropietario(xUserId) {
  if (!xUserId) return null;
  if (UUID_RE.test(xUserId)) return xUserId; // llega el id real de Supabase
  return SESION_SIMULADA[xUserId] || null; // llega un alias de sesión
}

function rechazarSinUsuario(res) {
  return res.status(401).json({
    error: 'Usuario no identificado: falta o no es válida la cabecera x-user-id.',
  });
}

// ============================================================================
// Normalización de fechas
// Supabase guarda UTC sin sufijo de zona; sin la Z, JS lo lee como hora local.
// ============================================================================
const FECHA_SIN_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

const conMarcaUTC = (valor) =>
  typeof valor === 'string' && FECHA_SIN_OFFSET.test(valor) ? `${valor}Z` : valor;

const normalizarFechas = (filas) =>
  Array.isArray(filas)
    ? filas.map((fila) => (fila && fila.fecha ? { ...fila, fecha: conMarcaUTC(fila.fecha) } : fila))
    : filas;

const normalizarFila = (fila) =>
  fila && fila.fecha ? { ...fila, fecha: conMarcaUTC(fila.fecha) } : fila;

// ============================================================================
// Tokens de sesión firmados con HMAC-SHA256
// Secreto en .env (TOKEN_SECRET), con la clave de Supabase como respaldo.
// ============================================================================
const TOKEN_SECRET =
  process.env.TOKEN_SECRET || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

const firmarToken = (payload) => {
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = crypto.createHmac('sha256', TOKEN_SECRET).update(cuerpo).digest('base64url');
  return `${cuerpo}.${firma}`;
};

// Devuelve el payload solo si la firma es válida; null en cualquier otro caso.
const verificarToken = (token) => {
  if (typeof token !== 'string') return null;
  const punto = token.lastIndexOf('.');
  if (punto <= 0) return null;

  const cuerpo = token.slice(0, punto);
  const firma = token.slice(punto + 1);
  const esperada = crypto.createHmac('sha256', TOKEN_SECRET).update(cuerpo).digest('base64url');

  // Comparación en tiempo constante para no filtrar la firma por tardanza.
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
};

// ============================================================================
// Middleware: Protección de rol Coordinador (HU01 / HU04)
// ============================================================================
const verificarCoordinador = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const decoded = verificarToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  if (decoded.rol !== 'Coordinador') {
    return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Coordinador' });
  }

  req.usuario = decoded;
  next();
};

// ============================================================================
// HU01: Endpoint de Login simple
// ============================================================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};

  // Misma respuesta si el correo no existe y si la contraseña es incorrecta,
  // para que no se puedan enumerar los usuarios registrados.
  const credencialesInvalidas = () =>
    res.status(401).json({ error: 'Credenciales inválidas' });

  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string') {
    return credencialesInvalidas();
  }

  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, email, rol, contrasena')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !usuario) {
      return credencialesInvalidas();
    }

    if (password !== usuario.contrasena) {
      return credencialesInvalidas();
    }

    // La contraseña jamas sale del servidor.
    const { contrasena, ...seguro } = usuario;

    return res.json({
      mensaje: 'Autenticación exitosa',
      token: firmarToken(seguro),
      usuario: seguro,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// ============================================================================
// HU02: Crear una solicitud de soporte
// Cabecera requerida: x-user-id
// ============================================================================
const CATEGORIAS_VALIDAS = ['Hardware', 'Software', 'Redes'];

app.post('/api/solicitudes', async (req, res) => {
  const propietarioId = resolverPropietario(req.headers['x-user-id']);
  if (!propietarioId) return rechazarSinUsuario(res);

  const { titulo, categoria, descripcion } = req.body || {};

  if (
    typeof titulo !== 'string' || !titulo.trim() ||
    typeof descripcion !== 'string' || !descripcion.trim() ||
    !categoria
  ) {
    return res.status(400).json({
      error: 'Los campos titulo, categoria y descripcion son obligatorios.',
    });
  }

  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({
      error: `Categoria no válida. Debe ser una de: ${CATEGORIAS_VALIDAS.join(', ')}`,
    });
  }

  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .insert({
        titulo: titulo.trim(),
        categoria,
        descripcion: descripcion.trim(),
        estado: 'Nuevo',
        prioridad: 'Media',
        historial: [],
        propietario_id: propietarioId,
        // fecha la genera la base de datos por defecto
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Error al crear la solicitud: ' + error.message });
    }

    return res.status(201).json(normalizarFila(data));
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// ============================================================================
// GET /api/solicitudes · HU03 con x-user-id, HU04 con Authorization
// ============================================================================
const listarTodas = async (req, res) => {
  const { sortBy = 'fecha', order = 'desc' } = req.query;

  const camposPermitidos = ['prioridad', 'estado', 'fecha'];
  const campoOrden = camposPermitidos.includes(sortBy) ? sortBy : 'fecha';
  const esAscendente = String(order).toLowerCase() === 'asc';

  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .order(campoOrden, { ascending: esAscendente });

    if (error) {
      return res.status(500).json({ error: 'Error al consultar solicitudes: ' + error.message });
    }

    return res.json(normalizarFechas(data || []));
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
};

const listarPropias = async (req, res) => {
  const propietarioId = resolverPropietario(req.headers['x-user-id']);
  if (!propietarioId) return rechazarSinUsuario(res);

  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .eq('propietario_id', propietarioId)
      .order('fecha', { ascending: false }); // más recientes primero

    if (error) {
      return res.status(500).json({ error: 'Error al consultar solicitudes: ' + error.message });
    }

    return res.json(normalizarFechas(data || []));
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
};

app.get('/api/solicitudes', (req, res, next) => {
  if (req.headers.authorization) {
    return verificarCoordinador(req, res, () => listarTodas(req, res)); // HU04
  }
  return listarPropias(req, res); // HU03
});

// ============================================================================
// HU04: Cambiar prioridad de solicitud (Coordinador)
// Guarda registro en texto simple en el historial
// ============================================================================
app.patch('/api/solicitudes/:id/prioridad', verificarCoordinador, async (req, res) => {
  const { id } = req.params;
  const { prioridad } = req.body;

  const prioridadesValidas = ['Baja', 'Media', 'Alta'];
  if (!prioridad || !prioridadesValidas.includes(prioridad)) {
    return res.status(400).json({
      error: `Prioridad no válida. Debe ser una de: ${prioridadesValidas.join(', ')}`,
    });
  }

  try {
    // 1. Obtener el historial previo de la solicitud
    const { data: solicitudPrevia, error: errConsulta } = await supabase
      .from('solicitudes')
      .select('historial, prioridad')
      .eq('id', id)
      .single();

    if (errConsulta || !solicitudPrevia) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // 2. Formatear la nueva entrada
    const marcaTiempo = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    const logRegistro = `[${marcaTiempo}] Prioridad actualizada de "${
      solicitudPrevia.prioridad || 'N/A'
    }" a "${prioridad}" por Coordinador (${req.usuario.email})`;

    let nuevoHistorial;
    if (Array.isArray(solicitudPrevia.historial)) {
      nuevoHistorial = [
        ...solicitudPrevia.historial,
        {
          fecha: new Date().toISOString().split('T')[0],
          accion: logRegistro,
        },
      ];
    } else if (typeof solicitudPrevia.historial === 'string' && solicitudPrevia.historial.trim()) {
      nuevoHistorial = `${solicitudPrevia.historial}\n${logRegistro}`;
    } else {
      nuevoHistorial = logRegistro;
    }

    // 3. Actualizar la prioridad y el historial en Supabase
    const { data: solicitudActualizada, error: errUpdate } = await supabase
      .from('solicitudes')
      .update({
        prioridad,
        historial: nuevoHistorial,
      })
      .eq('id', id)
      .select()
      .single();

    if (errUpdate) {
      return res.status(500).json({ error: 'Error al actualizar la solicitud: ' + errUpdate.message });
    }

    return res.json({
      mensaje: 'Prioridad actualizada con éxito',
      solicitud: normalizarFila(solicitudActualizada),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
