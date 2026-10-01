import React, { useState, useEffect } from 'react';

export default function DashboardIndicadores() {
  const [indicadores, setIndicadores] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Filtros para recalcular métricas
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const token = localStorage.getItem('token');

  // Función para consultar las métricas agregadas
  const cargarIndicadores = async () => {
    setCargando(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroPrioridad) params.append('prioridad', filtroPrioridad);
      if (filtroCategoria) params.append('categoria', filtroCategoria);

      const resp = await fetch(`/api/indicadores?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error || `Error del servidor (código ${resp.status})`);
      }

      const data = await resp.json().catch(() => null);
      if (!data) throw new Error('Respuesta inválida del servidor');
      setIndicadores(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarIndicadores();
  }, [filtroEstado, filtroPrioridad, filtroCategoria]);

  const total = indicadores ? indicadores.total : 0;
  const volumen = indicadores ? indicadores.volumenPorEstado : {};

  // Función auxiliar para calcular el ancho de la barra
  const calcularPorcentaje = (cantidad) => {
    if (!total || total === 0) return 0;
    return Math.round((cantidad / total) * 100);
  };

  return (
    <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '17px', color: '#1e293b' }}>
          Dashboard de Indicadores
        </h3>

        {/* Filtros arriba */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Todos los Estados</option>
            <option value="Nuevo">Nuevo</option>
            <option value="En Progreso">En Progreso</option>
            <option value="Resuelto">Resuelto</option>
            <option value="Cerrado">Cerrado</option>
          </select>

          <select
            value={filtroPrioridad}
            onChange={(e) => setFiltroPrioridad(e.target.value)}
            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Todas las Prioridades</option>
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Todas las Categorías</option>
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Redes">Redes</option>
          </select>

          <button
            type="button"
            onClick={cargarIndicadores}
            style={{ padding: '5px 10px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #94a3b8', background: '#f1f5f9' }}
          >
            Recalcular
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'red', fontSize: '13px' }}>{error}</p>}
      {cargando && <p style={{ color: '#64748b', fontSize: '13px' }}>Calculando indicadores...</p>}

      {indicadores && !cargando && (
        <div>
          {/* Tarjetas de Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Total Solicitudes
              </span>
              <strong style={{ fontSize: '24px', color: '#0f172a' }}>{indicadores.total}</strong>
            </div>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#16a34a', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Resueltas / Cerradas
              </span>
              <strong style={{ fontSize: '24px', color: '#15803d' }}>{indicadores.resueltas}</strong>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '12px', color: '#2563eb', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Tiempo Mediano de Ciclo
              </span>
              <strong style={{ fontSize: '24px', color: '#1d4ed8' }}>
                {indicadores.tiempoMedianoHoras} <span style={{ fontSize: '14px', fontWeight: 'normal' }}>horas</span>
              </strong>
            </div>
          </div>

          {/* Gráfico de Barras Simuladas con divs (Volumen por Estado) */}
          <div style={{ background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '6px', padding: '12px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13.5px', color: '#334155' }}>
              Volumen de Solicitudes por Estado
            </h4>

            {[
              { estado: 'Nuevo', color: '#3b82f6' },
              { estado: 'En Progreso', color: '#f59e0b' },
              { estado: 'Resuelto', color: '#10b981' },
              { estado: 'Cerrado', color: '#6b7280' },
            ].map(({ estado, color }) => {
              const cant = volumen[estado] || 0;
              const pct = calcularPorcentaje(cant);

              return (
                <div key={estado} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span><strong>{estado}</strong> ({cant})</span>
                    <span>{pct}%</span>
                  </div>
                  {/* Barra simulada con un div contenedor y div de ancho dinámico */}
                  <div style={{ width: '100%', height: '14px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: color,
                        transition: 'width 0.3s ease-in-out',
                        minWidth: cant > 0 ? '4px' : '0'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
