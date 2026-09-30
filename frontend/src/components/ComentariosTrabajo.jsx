import React, { useState, useEffect } from 'react';

export default function ComentariosTrabajo({ solicitudId }) {
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  // Recargar la lista de comentarios de la solicitud
  const cargarComentarios = async () => {
    if (!solicitudId) return;
    setCargando(true);
    try {
      const resp = await fetch(`/api/solicitudes/${solicitudId}/comentarios`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Error al obtener comentarios');
      }

      const data = await resp.json();
      setComentarios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarComentarios();
  }, [solicitudId]);

  const handleEnviar = async (e) => {
    e.preventDefault();

    if (!texto.trim()) {
      setError('El comentario no puede estar vacío.');
      return;
    }

    setEnviando(true);
    setError('');

    try {
      const resp = await fetch('/api/comentarios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          solicitud_id: solicitudId,
          contenido: texto.trim(),
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Error al enviar el comentario');
      }

      // Limpiar textarea y recargar la lista
      setTexto('');
      await cargarComentarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '650', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '10px' }}>
        Comentarios de Trabajo
      </h3>

      {/* Lista de comentarios */}
      <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {cargando && <p style={{ fontSize: '13px', color: '#64748b' }}>Cargando comentarios...</p>}

        {!cargando && comentarios.length === 0 && (
          <p style={{ fontSize: '13px', fontStyle: 'italic', color: '#94a3b8' }}>
            No hay comentarios en esta solicitud todavía.
          </p>
        )}

        {comentarios.map((c) => (
          <div
            key={c.id}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13.5px',
            }}
          >
            <p style={{ margin: 0, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{c.contenido}</p>
            {c.fecha_creacion && (
              <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                {new Date(c.fecha_creacion).toLocaleString('es-CO')}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Formulario para agregar nuevo comentario */}
      <form onSubmit={handleEnviar}>
        <textarea
          rows="2"
          placeholder="Escribe un comentario sobre el trabajo realizado..."
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setError('');
          }}
          disabled={enviando}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '13.5px',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />

        {error && <p style={{ color: '#ef4444', fontSize: '12.5px', margin: '4px 0' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '500',
              cursor: enviando || !texto.trim() ? 'not-allowed' : 'pointer',
              opacity: enviando || !texto.trim() ? 0.6 : 1,
            }}
          >
            {enviando ? 'Guardando...' : 'Comentar'}
          </button>
        </div>
      </form>
    </div>
  );
}
