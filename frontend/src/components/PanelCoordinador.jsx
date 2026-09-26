import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:4000/api';

export default function PanelCoordinador() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  // Parámetros de ordenamiento
  const [sortBy, setSortBy] = useState('fecha');
  const [order, setOrder] = useState('desc');

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const token = localStorage.getItem('token');

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

  // Cambiar prioridad en vivo (HU04)
  const handleCambioPrioridad = async (id, nuevaPrioridad) => {
    setError('');
    setMensajeExito('');

    try {
      const resp = await fetch(`${API_BASE}/solicitudes/${id}/prioridad`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prioridad: nuevaPrioridad })
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
    } catch (err) {
      setError(err.message);
    }
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
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((sol) => {
              const textoHistorial = formatearHistorial(sol.historial);
              return (
                <tr key={sol.id}>
                  <td style={{ fontSize: '11px', wordBreak: 'break-all' }}>{sol.id}</td>
                  <td><strong>{sol.titulo}</strong></td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
