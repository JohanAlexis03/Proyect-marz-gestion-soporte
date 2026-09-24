require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Conexión directa a Supabase con variables de entorno
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// Middleware: Protección de rol Coordinador
// ==========================================
const verificarCoordinador = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'No autorizado: Token no proporcionado' });
  }

  try {
    // Manejo de token simple en base64 para evitar dependencias extra
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    if (decoded.rol !== 'Coordinador') {
      return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Coordinador' });
    }

    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// ==========================================
// HU01: Endpoint de Login simple
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Credenciales inválidas' });
  }

  try {
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, email, rol')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generamos un token base64 simple con id, email y rol
    const token = Buffer.from(JSON.stringify(usuario)).toString('base64');

    return res.json({
      mensaje: 'Autenticación exitosa',
      token,
      usuario
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// ==========================================
// HU04: Listar todas las solicitudes (Coordinador)
// Permite ordenar por prioridad, estado y fecha
// ==========================================
app.get('/api/solicitudes', verificarCoordinador, async (req, res) => {
  const { sortBy = 'fecha', order = 'desc' } = req.query;

  const camposPermitidos = ['prioridad', 'estado', 'fecha'];
  const campoOrden = camposPermitidos.includes(sortBy) ? sortBy : 'fecha';
  const esAscendente = order.toLowerCase() === 'asc';

  try {
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*')
      .order(campoOrden, { ascending: esAscendente });

    if (error) {
      return res.status(500).json({ error: 'Error al consultar solicitudes: ' + error.message });
    }

    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

// ==========================================
// HU04: Cambiar prioridad de solicitud (Coordinador)
// Guarda registro en texto simple en el historial
// ==========================================
app.patch('/api/solicitudes/:id/prioridad', verificarCoordinador, async (req, res) => {
  const { id } = req.params;
  const { prioridad } = req.body;

  const prioridadesValidas = ['Baja', 'Media', 'Alta'];
  if (!prioridad || !prioridadesValidas.includes(prioridad)) {
    return res.status(400).json({
      error: `Prioridad no válida. Debe ser una de: ${prioridadesValidas.join(', ')}`
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
    const logRegistro = `[${marcaTiempo}] Prioridad actualizada de "${solicitudPrevia.prioridad || 'N/A'}" a "${prioridad}" por Coordinador (${req.usuario.email})`;
    
    let nuevoHistorial;
    if (Array.isArray(solicitudPrevia.historial)) {
      nuevoHistorial = [
        ...solicitudPrevia.historial,
        {
          fecha: new Date().toISOString().split('T')[0],
          accion: logRegistro
        }
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
        historial: nuevoHistorial
      })
      .eq('id', id)
      .select()
      .single();

    if (errUpdate) {
      return res.status(500).json({ error: 'Error al actualizar la solicitud: ' + errUpdate.message });
    }

    return res.json({
      mensaje: 'Prioridad actualizada con éxito',
      solicitud: solicitudActualizada
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno en el servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
