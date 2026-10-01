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
const PRIORIDADES_VALIDAS = ['Baja', 'Media', 'Alta'];

// ---------------------------------------------------------------------------
// Cambio controlado (Inicio del Sprint 2): prioridad Alta exige justificacion
// y fecha objetivo. Aplica a los dos puntos de entrada de la prioridad, la
// HU02 (crear) y la HU04 (reclasificar), asi no queda una via sin control.
// ---------------------------------------------------------------------------
const esFechaValida = (valor) => {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
};

// Fecha local en AAAA-MM-DD, para comparar igual que llega del formulario.
const hoy = () => {
  const ahora = new Date();
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

// Devuelve el mensaje de error, o null si la prioridad Alta esta completa.
const validarPrioridadAlta = (campos) => {
  const justificacion = typeof campos.justificacion_prioridad === 'string'
    ? campos.justificacion_prioridad.trim()
    : '';

  if (!justificacion) {
    return 'La prioridad Alta exige indicar la justificacion.';
  }
  if (justificacion.length > 300) {
    return 'La justificacion de la prioridad Alta no puede superar los 300 caracteres.';
  }
  if (!esFechaValida(campos.fecha_objetivo)) {
    return 'La prioridad Alta exige una fecha objetivo con formato AAAA-MM-DD.';
  }
  if (campos.fecha_objetivo < hoy()) {
    return 'La fecha objetivo no puede ser anterior a la fecha actual.';
  }
  return null;
};

// Si la prioridad es Alta devuelve los dos campos limpios; en cualquier otro
// caso los vacia, porque la justificacion solo aplica a la prioridad Alta.
const camposPrioridad = (prioridad, campos) => {
  if (prioridad !== 'Alta') {
    return { justificacion_prioridad: null, fecha_objetivo: null };
  }
  return {
    justificacion_prioridad: campos.justificacion_prioridad.trim(),
    fecha_objetivo: campos.fecha_objetivo,
  };
};

app.post('/api/solicitudes', verificarSesion, async (req, res) => {
  const propietarioId = req.usuario.id;
  if (!propietarioId) return res.status(401).json({ error: 'Token sin identidad de usuario.' });

  const { titulo, categoria, descripcion, prioridad, justificacion_prioridad, fecha_objetivo } =
    req.body || {};

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

  // La prioridad se elegia solo en el panel de coordinacion; la HU02 ahora la
  // recibe al crear, y si es Alta tiene que venir justificada (cambio controlado).
  const prioridadFinal = prioridad || 'Media';
  if (!PRIORIDADES_VALIDAS.includes(prioridadFinal)) {
    return res.status(400).json({
      error: `Prioridad no válida. Debe ser una de: ${PRIORIDADES_VALIDAS.join(', ')}`,
    });
  }

  if (prioridadFinal === 'Alta') {
    const errorPrioridad = validarPrioridadAlta({ justificacion_prioridad, fecha_objetivo });
    if (errorPrioridad) return res.status(400).json({ error: errorPrioridad });
  }

  const camposAlta = camposPrioridad(prioridadFinal, { justificacion_prioridad, fecha_objetivo });

  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .insert({
        titulo: titulo.trim(),
        categoria,
        descripcion: descripcion.trim(),
        estado: 'Nuevo',
        prioridad: prioridadFinal,
        ...camposAlta,
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

    // Permisos: por defecto solo las propias. Coordinador y Agente ven la
    // cola completa (HU04 y HU07). Todo lo demas, incluido un rol desconocido,
    // queda con lo suyo. La rama original filtraba solo "Solicitante", lo que
    // hacia que cualquier otro rol viera todo: aca no se puede fallar abierto.
    if (!['Coordinador', 'Agente'].includes(req.usuario.rol)) {
      query = query.eq('propietario_id', req.usuario.id);
    }

    // Busqueda por texto en titulo o descripcion.
    // Los caracteres que separan o agrupan condiciones dentro de .or() vienen
    // del usuario: se quitan para que no alteren el filtro.
    if (texto && typeof texto === 'string' && texto.trim()) {
      const limpio = texto.trim().replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
      if (limpio) {
        query = query.or(`titulo.ilike.%${limpio}%,descripcion.ilike.%${limpio}%`);
      }
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
    const { prioridad, justificacion_prioridad, fecha_objetivo } = req.body || {};

    if (!prioridad || !PRIORIDADES_VALIDAS.includes(prioridad)) {
      return res.status(400).json({
        error: `Prioridad no válida. Debe ser una de: ${PRIORIDADES_VALIDAS.join(', ')}`,
      });
    }

    // Cambio controlado: subir a Alta desde el panel exige justificar y fijar
    // fecha objetivo; sin eso la reclasificacion no se aplica.
    if (prioridad === 'Alta') {
      const errorPrioridad = validarPrioridadAlta({ justificacion_prioridad, fecha_objetivo });
      if (errorPrioridad) return res.status(400).json({ error: errorPrioridad });
    }

    const camposAlta = camposPrioridad(prioridad, { justificacion_prioridad, fecha_objetivo });

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
      let logRegistro = `[${marcaTiempo}] Prioridad actualizada de "${
        solicitudPrevia.prioridad || 'N/A'
      }" a "${prioridad}" por Coordinador (${req.usuario.email})`;
      if (prioridad === 'Alta') {
        logRegistro += ` · Justificacion: ${camposAlta.justificacion_prioridad} · Fecha objetivo: ${camposAlta.fecha_objetivo}`;
      }


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
          ...camposAlta,
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
// HU07 + HU08: Cambiar el estado de una solicitud
// HU07 avanza el flujo de atencion (Agente y Coordinador); HU08 acepta la
// solucion o la reabre (Solicitante). Cada movimiento queda en el historial.
// ============================================================================
const ESTADOS_VALIDOS = ['Nuevo', 'En Progreso', 'Resuelto', 'Cerrado'];

// Un rol solo puede mover la solicitud hacia los estados que le corresponden.
const TRANSICIONES_POR_ROL = {
  Coordinador: { Nuevo: ['En Progreso'], 'En Progreso': ['Resuelto'] },
  Agente: { Nuevo: ['En Progreso'], 'En Progreso': ['Resuelto'] },
  Solicitante: {
    Resuelto: ['Cerrado', 'En Progreso'],
    Cerrado: ['En Progreso'],
  },
};

// Reabrir exige motivo escrito para que la traza quede completa (HU08).
const requiereMotivo = (desde, hacia) =>
  hacia === 'En Progreso' && (desde === 'Resuelto' || desde === 'Cerrado');

app.patch('/api/solicitudes/:id/estado', verificarSesion, async (req, res) => {
  const { id } = req.params;
  const { estado, motivo } = req.body || {};
  const rol = req.usuario.rol;

  if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({
      error: `Estado no valido. Debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`,
    });
  }

  const permitidas = TRANSICIONES_POR_ROL[rol];
  if (!permitidas) {
    return res.status(403).json({ error: 'Acceso denegado: tu rol no puede cambiar estados' });
  }

    try {
      const { data: solicitudPrevia, error: errConsulta } = await supabase
        .from('solicitudes')
        .select('estado, historial, propietario_id')
        .eq('id', id)
        .single();

      if (errConsulta || !solicitudPrevia) {
        return res.status(404).json({ error: 'Solicitud no encontrada' });
      }

      // Autorizacion a nivel de objeto: el Solicitante solo mueve las suyas.
      // Sin esto basta con conocer el UUID para aceptar o reabrir la solicitud
      // de otro usuario (IDOR), aunque la lista filtrada no lo muestre.
      if (rol === 'Solicitante' && solicitudPrevia.propietario_id !== req.usuario.id) {
        return res.status(403).json({ error: 'Acceso denegado: esta solicitud no te pertenece' });
      }

      const desde = solicitudPrevia.estado || 'Nuevo';

    if (estado === desde) {
      return res.status(400).json({ error: 'La solicitud ya tiene ese estado' });
    }

    const destino = permitidas[desde];
    if (!Array.isArray(destino) || !destino.includes(estado)) {
      return res.status(400).json({
        error: `Transicion no permitida: "${desde}" -> "${estado}"`,
        transicionesPermitidas: destino || [],
      });
    }

    const motivoLimpio = typeof motivo === 'string' ? motivo.trim() : '';
    if (requiereMotivo(desde, estado) && !motivoLimpio) {
      return res
        .status(400)
        .json({ error: 'Para reabrir la solicitud hace falta indicar el motivo' });
    }

    const marcaTiempo = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
    let logRegistro = `[${marcaTiempo}] Estado actualizado de "${desde}" a "${estado}" por ${rol} (${req.usuario.email})`;
    if (motivoLimpio) {
      logRegistro += ` · Motivo: ${motivoLimpio}`;
    }

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

    const { data: solicitudActualizada, error: errUpdate } = await supabase
      .from('solicitudes')
      .update({ estado, historial: nuevoHistorial })
      .eq('id', id)
      .select()
      .single();

    if (errUpdate) {
      return res.status(500).json({ error: 'Error al actualizar la solicitud: ' + errUpdate.message });
    }

    return res.json({
      mensaje: 'Estado actualizado con exito',
      solicitud: normalizarFila(solicitudActualizada),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// ============================================================================
// HU05 + HU06: asignar agente y comentarios de trabajo
// El equipo dejo el frontend en la rama del Sprint 2 pero el backend en la del
// Sprint 3; se trae aca para que el Sprint 2 quede funcional por si solo.
// ============================================================================

// GET /api/agentes · lista los usuarios con rol Agente
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

// PUT /api/solicitudes/:id/asignar · HU05
// Repartir la cola es decision del Coordinador (HU04); cualquier otro rol
// quedaba pudiendo asignarse solicitudes con solo conocer el UUID.
app.put('/api/solicitudes/:id/asignar', verificarCoordinador, async (req, res) => {
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

// POST /api/comentarios · HU06
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
    const { data: solicitudPrevia, error: errConsulta } = await supabase
      .from('solicitudes')
      .select('propietario_id')
      .eq('id', solicitud_id)
      .single();

    if (errConsulta || !solicitudPrevia) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Autorizacion a nivel de objeto: el Solicitante solo comenta en las suyas.
    // El Coordinador y el Agente trabajan sobre toda la cola, asi que no
    // llevan este limite.
    if (
      req.usuario.rol === 'Solicitante' &&
      solicitudPrevia.propietario_id !== req.usuario.id
    ) {
      return res.status(403).json({ error: 'Acceso denegado: esta solicitud no te pertenece' });
    }

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

// GET /api/solicitudes/:id/comentarios · HU06
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
