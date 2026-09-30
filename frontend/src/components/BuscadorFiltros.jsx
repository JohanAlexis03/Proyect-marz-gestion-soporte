import React, { useState } from 'react';

export default function BuscadorFiltros({ onBuscar }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('');
  const [prioridad, setPrioridad] = useState('');
  const [categoria, setCategoria] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  // Función para armar la URL y buscar
  const handleBuscar = async (e) => {
    if (e) e.preventDefault();
    setCargando(true);
    setError('');

    try {
      // Armamos los query params
      const params = new URLSearchParams();
      if (texto.trim()) params.append('texto', texto.trim());
      if (estado) params.append('estado', estado);
      if (prioridad) params.append('prioridad', prioridad);
      if (categoria) params.append('categoria', categoria);

      const url = `/api/solicitudes?${params.toString()}`;
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error || `Error del servidor (código ${resp.status})`);
      }

      const data = await resp.json().catch(() => null);
      if (onBuscar && data) {
        onBuscar(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const handleLimpiar = async () => {
    setTexto('');
    setEstado('');
    setPrioridad('');
    setCategoria('');
    setError('');
    setCargando(true);

    try {
      // Al limpiar traemos todo sin filtros
      const resp = await fetch('/api/solicitudes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await resp.json();
      if (onBuscar) onBuscar(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
      <form onSubmit={handleBuscar} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
        
        {/* Input de texto */}
        <div style={{ flex: '1', minWidth: '180px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
            Buscar por texto:
          </label>
          <input
            type="text"
            placeholder="Título o descripción..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
          />
        </div>

        {/* Select Estado */}
        <div style={{ minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
            Estado:
          </label>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Todos</option>
            <option value="Nuevo">Nuevo</option>
            <option value="En Progreso">En Progreso</option>
            <option value="Resuelto">Resuelto</option>
            <option value="Cerrado">Cerrado</option>
          </select>
        </div>

        {/* Select Prioridad */}
        <div style={{ minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
            Prioridad:
          </label>
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Todas</option>
            <option value="Baja">Baja</option>
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
          </select>
        </div>

        {/* Select Categoría */}
        <div style={{ minWidth: '130px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
            Categoría:
          </label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          >
            <option value="">Todas</option>
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Redes">Redes</option>
          </select>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="submit"
            disabled={cargando}
            style={{
              padding: '6px 14px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            {cargando ? 'Buscando...' : 'Buscar'}
          </button>

          <button
            type="button"
            onClick={handleLimpiar}
            disabled={cargando}
            style={{
              padding: '6px 10px',
              background: '#e2e8f0',
              color: '#334155',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {error && <p style={{ color: 'red', fontSize: '12px', marginTop: '6px', marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
