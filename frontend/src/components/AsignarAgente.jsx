import React, { useState, useEffect } from 'react';

export default function AsignarAgente({ solicitudId, agenteActualId, onAgenteAsignado }) {
  const [agentes, setAgentes] = useState([]);
  const [agenteSeleccionado, setAgenteSeleccionado] = useState(agenteActualId || '');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');

  const token = localStorage.getItem('token');

  // Cargar lista de agentes desde el backend
  useEffect(() => {
    const cargarAgentes = async () => {
      try {
        const resp = await fetch('/api/agentes', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!resp.ok) {
          const errData = await resp.json();
          throw new Error(errData.error || 'Error al cargar lista de agentes');
        }

        const data = await resp.json();
        setAgentes(data);
      } catch (err) {
        setError(err.message);
      }
    };

    cargarAgentes();
  }, [token]);

  const handleAsignar = async () => {
    if (!agenteSeleccionado) {
      setError('Por favor selecciona un agente.');
      return;
    }

    setCargando(true);
    setError('');
    setMensajeExito('');

    try {
      const resp = await fetch(`/api/solicitudes/${solicitudId}/asignar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ agente_id: agenteSeleccionado }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo asignar el agente');
      }

      setMensajeExito('Agente asignado exitosamente');
      if (onAgenteAsignado) {
        onAgenteAsignado(data.solicitud);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ marginTop: '12px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
        Asignar a un Agente:
      </label>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={agenteSeleccionado}
          onChange={(e) => {
            setAgenteSeleccionado(e.target.value);
            setError('');
            setMensajeExito('');
          }}
          disabled={cargando}
          style={{
            flex: '1',
            minWidth: '200px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '13.5px',
          }}
        >
          <option value="">-- Selecciona un agente --</option>
          {agentes.map((agente) => (
            <option key={agente.id} value={agente.id}>
              {agente.email}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAsignar}
          disabled={cargando || !agenteSeleccionado}
          style={{
            padding: '7px 14px',
            borderRadius: '6px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '500',
            cursor: cargando || !agenteSeleccionado ? 'not-allowed' : 'pointer',
            opacity: cargando || !agenteSeleccionado ? 0.6 : 1,
          }}
        >
          {cargando ? 'Asignando...' : 'Asignar'}
        </button>
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: '12.5px', marginTop: '6px', margin: '6px 0 0' }}>{error}</p>}
      {mensajeExito && <p style={{ color: '#16a34a', fontSize: '12.5px', marginTop: '6px', margin: '6px 0 0' }}>{mensajeExito}</p>}
    </div>
  );
}
