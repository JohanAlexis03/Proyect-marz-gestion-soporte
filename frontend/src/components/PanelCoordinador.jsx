import React, { useState, useEffect } from 'react';
import TicketDetail from './TicketDetail';
import BuscadorFiltros from './BuscadorFiltros';
import DashboardIndicadores from './DashboardIndicadores';

const API_BASE = '/api';

export default function PanelCoordinador() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  // HU05: el detalle es el único lugar donde vive el formulario de asignación,
  // y al Coordinador antes no había manera de abrirlo desde acá.
  const [detalleId, setDetalleId] = useState(null);

  // Parámetros de ordenamiento
  const [sortBy, setSortBy] = useState('fecha');
  const [order, setOrder] = useState('desc');

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token = localStorage.getItem('token');

  // Se deriva de la lista para que, al cambiar un estado o asignar un agente,
  // el detalle refresque en vez de quedar con la copia vieja.
  const detalle = solicitudes.find((s) => s.id === detalleId) || null;

  // Cargar solicitudes con ordenamiento
  const cargarSolicitudes = async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/solicitudes?sortBy=${sortBy}&order=${order}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Error al obtener solicitudes');
      }

      const data = await resp.json();
      setSolicitudes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, [sortBy, order]);

  // Cambio controlado (Inicio Sprint 2): subir a Alta exige justificacion y
  // fecha objetivo. Elegir "Alta" no manda el PATCH al toque: abre la fila.
  const [altaPendiente, setAltaPendiente] = useState(null);
  const [justificacionAlta, setJustificacionAlta] = useState('');
  const [fechaObjetivoAlta, setFechaObjetivoAlta] = useState('');
  const [guardandoAlta, setGuardandoAlta] = useState(false);

  const hoyISO = () => {
    const ahora = new Date();
    return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  };

  // Devuelve { ok } para que quien pida la confirmacion sepa si cerro la fila.
  const enviarPrioridad = async (id, nuevaPrioridad, extras = {}) => {
    setError('');
    setMensajeExito('');

    try {
      const resp = await fetch(`${API_BASE}/solicitudes/${id}/prioridad`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prioridad: nuevaPrioridad, ...extras })
      });

      const resultado = await resp.json();

      if (!resp.ok) {
        throw new Error(resultado.error || 'No se pudo actualizar la prioridad');
      }

      // Actualizamos la solicitud en el estado local de inmediato
      setSolicitudes((prev) =>
        prev.map((sol) => (sol.id === id ? resultado.solicitud : sol))
      );

      setMensajeExito(`Prioridad de la solicitud #${id} actualizada a "${nuevaPrioridad}" exitosamente.`);
      setTimeout(() => setMensajeExito(''), 4000);
      return { ok: true };
    } catch (err) {
      setError(err.message);
      return { ok: false };
    }
  };

  const handleCambioPrioridad = (id, nuevaPrioridad) => {
    if (nuevaPrioridad === 'Alta') {
      setAltaPendiente(id);
      setJustificacionAlta('');
      setFechaObjetivoAlta('');
      setError('');
      return;
    }
    setAltaPendiente(null);
    return enviarPrioridad(id, nuevaPrioridad);
  };

  const confirmarAlta = async () => {
    if (guardandoAlta) return;

    if (!justificacionAlta.trim()) {
      setError('La prioridad Alta exige indicar la justificacion.');
      return;
    }
    if (justificacionAlta.trim().length > 300) {
      setError('La justificacion de la prioridad Alta no puede superar los 300 caracteres.');
      return;
    }
    if (!fechaObjetivoAlta) {
      setError('La prioridad Alta exige indicar la fecha objetivo.');
      return;
    }
    if (fechaObjetivoAlta < hoyISO()) {
      setError('La fecha objetivo no puede ser anterior a la fecha actual.');
      return;
    }

    setGuardandoAlta(true);
    const resultado = await enviarPrioridad(altaPendiente, 'Alta', {
      justificacion_prioridad: justificacionAlta.trim(),
      fecha_objetivo: fechaObjetivoAlta,
    });
    setGuardandoAlta(false);

    // Solo se cierra si el servidor acepto; si no, el error queda a la vista.
    if (resultado.ok) setAltaPendiente(null);
  };

  const handleCerrarSesion = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  // Función para formatear el historial de manera segura (soporta string, array de strings o array de objetos)
  const formatearHistorial = (historial) => {
    if (!historial) return 'Sin cambios registrados';
    if (Array.isArray(historial)) {
      if (historial.length === 0) return 'Sin cambios registrados';
      return historial
        .map((item) => {
          if (typeof item === 'object' && item !== null) {
            if (item.fecha && item.accion) return `[${item.fecha}] ${item.accion}`;
            if (item.accion) return item.accion;
            return JSON.stringify(item);
          }
          return String(item);
        })
        .join('\n');
    }
    if (typeof historial === 'object') {
      return JSON.stringify(historial);
    }
    return String(historial);
  };

  return (
    <div className="container">
      {/* Encabezado */}
      <div className="header">
        <div>
          <h2>Panel de Coordinación (HU04)</h2>
          <p className="user-info">
            Usuario: <strong>{usuario.email || 'No identificado'}</strong> | Rol: <strong>{usuario.rol || 'N/A'}</strong>
          </p>
        </div>
        <button className="btn-logout" onClick={handleCerrarSesion}>
          Cerrar Sesión
        </button>
      </div>

      {/* Alertas */}
      {error && <div className="error-msg">{error}</div>}
      {mensajeExito && <div className="success-msg">{mensajeExito}</div>}

      {/* HU10: Dashboard de Indicadores (Solo Coordinador) */}
      <DashboardIndicadores />

      {/* HU09: Buscador y Filtros */}
      <BuscadorFiltros onBuscar={(resultados) => setSolicitudes(resultados)} />

      {/* Barra de Controles y Ordenamiento */}
      <div className="toolbar">
        <h3>Listado General de Solicitudes</h3>
        <div className="sort-controls">
          <label htmlFor="sortSelect"><strong>Ordenar por:</strong></label>
          <select
            id="sortSelect"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="fecha">Fecha</option>
            <option value="prioridad">Prioridad</option>
            <option value="estado">Estado</option>
          </select>

          <select
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>

          <button
            onClick={cargarSolicitudes}
            style={{ padding: '6px 10px', cursor: 'pointer' }}
          >
            Recargar
          </button>
        </div>
      </div>

      {/* Tabla de Solicitudes */}
      {cargando ? (
        <p>Cargando solicitudes...</p>
      ) : solicitudes.length === 0 ? (
        <p>No hay solicitudes registradas en el sistema.</p>
      ) : (
        <table className="tabla-solicitudes">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Prioridad (En Vivo)</th>
              <th>Fecha</th>
              <th>Historial</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((sol) => {
              const textoHistorial = formatearHistorial(sol.historial);
              return (
                <React.Fragment key={sol.id}>
                <tr>
                  <td style={{ fontSize: '11px', wordBreak: 'break-all' }}>{sol.id}</td>
                  <td>
                    <strong
                      style={{ cursor: 'pointer', color: '#2563eb' }}
                      title="Clic para ver detalle"
                      onClick={() => setSolicitudSeleccionada(sol)}
                    >
                      {sol.titulo}
                    </strong>
                  </td>
                  <td>{sol.descripcion}</td>
                  <td>{sol.categoria || 'General'}</td>
                  <td>{sol.estado}</td>
                  <td>
                    <select
                      className={`select-prioridad ${sol.prioridad}`}
                      value={sol.prioridad || 'Media'}
                      onChange={(e) => handleCambioPrioridad(sol.id, e.target.value)}
                    >
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </td>
                  <td>
                    {sol.fecha ? new Date(sol.fecha).toLocaleDateString() : 'N/A'}
                  </td>
                    <td>
                      <div className="historial-cell" title={textoHistorial}>
                        {textoHistorial}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-detalle"
                        onClick={() => setDetalleId(sol.id)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>

                  {altaPendiente === sol.id && (
                    <tr className="alta-pendiente">
                      <td colSpan={9}>
                      <div className="alta-pendiente__cuerpo">
                        <strong>Para pasar a Alta hace falta justificar la prioridad.</strong>

                        <div className="field">
                          <label className="field__label" htmlFor={`justif-${sol.id}`}>
                            Justificación <span className="field__required">*</span>
                          </label>
                          <textarea
                            id={`justif-${sol.id}`}
                            className="field__control field__control--textarea"
                            rows={3}
                            maxLength={300}
                            placeholder="¿Por qué debe atenderse como prioritaria?"
                            value={justificacionAlta}
                            onChange={(e) => setJustificacionAlta(e.target.value)}
                          />
                          <span className="field__hint">{justificacionAlta.length}/300 caracteres.</span>
                        </div>

                        <div className="field">
                          <label className="field__label" htmlFor={`fecha-${sol.id}`}>
                            Fecha objetivo <span className="field__required">*</span>
                          </label>
                          <input
                            id={`fecha-${sol.id}`}
                            type="date"
                            className="field__control"
                            min={hoyISO()}
                            value={fechaObjetivoAlta}
                            onChange={(e) => setFechaObjetivoAlta(e.target.value)}
                          />
                        </div>

                        <div className="alta-pendiente__acciones">
                          <button
                            type="button"
                            className="btn btn--primary"
                            onClick={confirmarAlta}
                            disabled={guardandoAlta}
                          >
                            {guardandoAlta ? 'Guardando…' : 'Confirmar prioridad Alta'}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setAltaPendiente(null)}
                            disabled={guardandoAlta}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {detalle && (
        <TicketDetail
          ticket={detalle}
          onClose={() => setDetalleId(null)}
          onCambio={cargarSolicitudes}
        />
      )}
    </div>
  );
}
