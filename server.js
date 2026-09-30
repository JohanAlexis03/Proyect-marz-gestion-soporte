require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { verificarContrasena } = require('./password');

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
// Middleware de sesión (HU01 / HU02 / HU03 / HU04)
// La identidad sale SIEMPRE del token firmado. La cabecera x-user-id se
// elimino: la ponia quien llamaba y permitia consultar o crear a nombre
// de cualquier usuario solo con adivinar su id.
// ============================================================================
const verificarSesion = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const decoded = verificarToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  req.usuario = decoded;
  next();
};

// ============================================================================
// Middleware: Protección de rol Coordinador (HU01 / HU04)
// ============================================================================
const verificarCoordinador = (req, res, next) =>
  verificarSesion(req, res, () => {
    if (req.usuario.rol !== 'Coordinador') {
      return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Coordinador' });
    }
    next();
  });

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

    // Nunca se compara como texto plano: el valor guardado es un hash scrypt.
    const coincide = await verificarContrasena(password, usuario.contrasena);
    if (!coincide) {
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
// Requiere sesión: el propietario sale del token, nunca de la cabecera.
// ============================================================================
const CATEGORIAS_VALIDAS = ['Hardware', 'Software', 'Redes'];

app.post('/api/solicitudes', verificarSesion, async (req, res) => {
  const propietarioId = req.usuario.id;
  if (!propietarioId) return res.status(401).json({ error: 'Token sin identidad de usuario.' });

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
// HU03 / HU04 / HU09: Listar, Buscar y Filtrar Solicitudes
// ============================================================================
app.get('/api/solicitudes', verificarSesion, async (req, res) => {
  const { texto, estado, prioridad, categoria, sortBy = 'fecha', order = 'desc' } = req.query;

  const camposPermitidos = ['prioridad', 'estado', 'fecha'];
  const campoOrden = camposPermitidos.includes(sortBy) ? sortBy : 'fecha';
  const esAscendente = String(order).toLowerCase() === 'asc';

  try {
    let query = supabase.from('solicitudes').select('*');

    // Lógica de permisos (Crucial):
    // Si el usuario es "Solicitante", se filtra obligatoriamente por su id (propietario_id).
    // Si es Coordinador o Agente, puede ver todas.
    if (req.usuario.rol === 'Solicitante') {
      query = query.eq('propietario_id', req.usuario.id);
    }

    // Búsqueda por texto (coincidencia parcial en titulo o descripcion usando ilike)
    if (texto && typeof texto === 'string' && texto.trim()) {
      const limpio = texto.trim();
      query = query.or('titulo.ilike.%' + limpio + '%,descripcion.ilike.%' + limpio + '%');
    }

    // Filtros combinados consistentes
    if (estado) {
      query = query.eq('estado', estado);
    }
    if (prioridad) {
      query = query.eq('prioridad', prioridad);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    // Ordenamiento
    query = query.order(campoOrden, { ascending: esAscendente });

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Error al consultar solicitudes: ' + error.message });
    }

    return res.json(normalizarFechas(data || []));
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
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

// ============================================================================
// HU05: Asignar Agente a una Solicitud
// ============================================================================

// Endpoint para que el frontend liste los agentes disponibles
app.get('/api/agentes', verificarSesion, async (req, res) => {
  try {
    const { data: agentes, error } = await supabase
      .from('usuarios')
      .select('id, email, rol')
      .eq('rol', 'Agente');

    if (error) {
      return res.status(500).json({ error: 'Error al consultar agentes: ' + error.message });
    }

    return res.json(agentes || []);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// PUT /api/solicitudes/:id/asignar
app.put('/api/solicitudes/:id/asignar', verificarSesion, async (req, res) => {
  const { id } = req.params;
  const { agente_id } = req.body;

  if (!agente_id) {
    return res.status(400).json({ error: 'Debes seleccionar un agente válido.' });
  }

  try {
    const asignado_por = req.usuario.id;

    const { data, error } = await supabase
      .from('solicitudes')
      .update({
        agente_id: agente_id,
        asignado_por: asignado_por,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Error al asignar el agente: ' + error.message });
    }

    return res.json({
      mensaje: 'Agente asignado exitosamente',
      solicitud: normalizarFila(data),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// ============================================================================
// HU06: Comentarios de Trabajo
// ============================================================================

// POST /api/comentarios
app.post('/api/comentarios', verificarSesion, async (req, res) => {
  const { solicitud_id, contenido } = req.body;
  const autor_id = req.usuario.id;

  if (!contenido || typeof contenido !== 'string' || !contenido.trim()) {
    return res.status(400).json({ error: 'El contenido del comentario no puede estar vacío.' });
  }

  if (!solicitud_id) {
    return res.status(400).json({ error: 'El ID de la solicitud es obligatorio.' });
  }

  try {
    const { data, error } = await supabase
      .from('comentarios')
      .insert({
        solicitud_id: solicitud_id,
        autor_id: autor_id,
        contenido: contenido.trim(),
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Error al registrar comentario: ' + error.message });
    }

    return res.status(201).json({
      mensaje: 'Comentario guardado exitosamente',
      comentario: data,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// GET /api/solicitudes/:id/comentarios
app.get('/api/solicitudes/:id/comentarios', verificarSesion, async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('comentarios')
      .select('*')
      .eq('solicitud_id', id)
      .order('fecha_creacion', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Error al obtener comentarios: ' + error.message });
    }

    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// ============================================================================
// HU10: Dashboard de Indicadores (Solo Coordinador)
// Métricas agregadas de volumen por estado y tiempo mediano de ciclo en JS puro.
// Regla: CERO métricas que expongan rendimiento individual de agentes.
// ============================================================================
app.get('/api/indicadores', verificarCoordinador, async (req, res) => {
  const { estado, prioridad, categoria } = req.query;

  try {
    let query = supabase.from('solicitudes').select('*');

    // Lógica de filtros opcionales
    if (estado) query = query.eq('estado', estado);
    if (prioridad) query = query.eq('prioridad', prioridad);
    if (categoria) query = query.eq('categoria', categoria);

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Error al consultar indicadores: ' + error.message });
    }

    const solicitudes = data || [];
    const total = solicitudes.length;

    // 1. Volumen de solicitudes agrupadas por estado
    const volumenPorEstado = {
      'Nuevo': 0,
      'En Progreso': 0,
      'Resuelto': 0,
      'Cerrado': 0,
    };

    for (let i = 0; i < solicitudes.length; i++) {
      const est = solicitudes[i].estado || 'Nuevo';
      if (volumenPorEstado[est] !== undefined) {
        volumenPorEstado[est]++;
      } else {
        volumenPorEstado[est] = 1;
      }
    }

    // 2. Tiempo mediano de ciclo (diferencia entre creación y resolución)
    const tiemposHoras = [];

    for (let i = 0; i < solicitudes.length; i++) {
      const sol = solicitudes[i];
      // Solo consideramos solicitudes que ya se resolvieron o cerraron
      if (sol.estado === 'Resuelto' || sol.estado === 'Cerrado') {
        const fechaInicio = new Date(sol.fecha);
        let fechaFin = null;

        // Buscar fecha de resolución en el historial
        if (Array.isArray(sol.historial)) {
          for (let j = 0; j < sol.historial.length; j++) {
            const h = sol.historial[j];
            const accion = (h.accion || '').toLowerCase();
            if (accion.includes('resuelto') || accion.includes('resuelta') || accion.includes('cerrad')) {
              fechaFin = new Date(h.fecha);
              break;
            }
          }
          // Si no hay texto explícito de resuelto, usamos la fecha del último movimiento
          if (!fechaFin && sol.historial.length > 0) {
            const ultimo = sol.historial[sol.historial.length - 1];
            if (ultimo.fecha) fechaFin = new Date(ultimo.fecha);
          }
        }

        if (!fechaFin && sol.fecha_resolucion) {
          fechaFin = new Date(sol.fecha_resolucion);
        }

        if (fechaFin && !isNaN(fechaInicio.getTime()) && !isNaN(fechaFin.getTime())) {
          const diffMs = fechaFin.getTime() - fechaInicio.getTime();
          const horas = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10);
          tiemposHoras.push(horas);
        }
      }
    }

    // Cálculo manual de la mediana en JavaScript puro
    let tiempoMedianoHoras = 0;
    if (tiemposHoras.length > 0) {
      tiemposHoras.sort((a, b) => a - b);
      const mitad = Math.floor(tiemposHoras.length / 2);
      if (tiemposHoras.length % 2 !== 0) {
        tiempoMedianoHoras = tiemposHoras[mitad];
      } else {
        tiempoMedianoHoras = Math.round(((tiemposHoras[mitad - 1] + tiemposHoras[mitad]) / 2) * 10) / 10;
      }
    }

    return res.json({
      total,
      volumenPorEstado,
      tiempoMedianoHoras,
      resueltas: (volumenPorEstado['Resuelto'] || 0) + (volumenPorEstado['Cerrado'] || 0),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
