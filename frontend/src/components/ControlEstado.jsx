import { useState } from 'react';
import { API_SOLICITUDES } from '../api';

// El backend es la que decide si una transición es válida; esta tabla solo
// define qué botones mostrar. Si alguna vez divergen, el servidor rechaza
// igual y el usuario ve el error, así que no hay riesgo de seguridad.
const TRANSICIONES_POR_ROL = {
  Coordinador: { Nuevo: ['En Progreso'], 'En Progreso': ['Resuelto'] },
  Agente: { Nuevo: ['En Progreso'], 'En Progreso': ['Resuelto'] },
  Solicitante: {
    Resuelto: ['Cerrado', 'En Progreso'],
    Cerrado: ['En Progreso'],
  },
};

// Volver a "En Progreso" desde un estado final siempre exige motivo (HU08).
const requiereMotivo = (desde, hacia) =>
  hacia === 'En Progreso' && (desde === 'Resuelto' || desde === 'Cerrado');

const etiqueta = (desde, hacia) => {
  if (requiereMotivo(desde, hacia)) return 'Reabrir solicitud';
  if (hacia === 'En Progreso') return 'Iniciar atención';
  if (hacia === 'Resuelto') return 'Marcar resuelto';
  return 'Aceptar solución';
};

function leerRol() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || '{}').rol || null;
  } catch {
    return null;
  }
}

export default function ControlEstado({ ticket, onCambio }) {
  const [pendiente, setPendiente] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  const rol = leerRol();
  const desde = ticket.estado || 'Nuevo';
  const permitidas = TRANSICIONES_POR_ROL[rol]?.[desde] || [];

  // Sin transiciones posibles para este rol y estado, no hay nada que mostrar.
  if (permitidas.length === 0) return null;

  const enviar = async (hacia) => {
    setOcupado(true);
    setError('');

    try {
      const res = await fetch(`${API_SOLICITUDES}/${ticket.id}/estado`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ estado: hacia, motivo }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || `El servidor respondió con estado ${res.status}.`);
        return;
      }

      setPendiente(null);
      setMotivo('');
      onCambio?.();
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const elegir = (hacia) => {
    setError('');
    if (requiereMotivo(desde, hacia)) {
      setPendiente(hacia);
      setMotivo('');
      return;
    }
    enviar(hacia);
  };

  const cancelar = () => {
    setPendiente(null);
    setMotivo('');
    setError('');
  };

  return (
    <section className="detail__section">
      <h3 className="detail__subtitle">Cambiar estado</h3>

      <p className="control-estado__actual">
        Estado actual <strong>{desde}</strong>
      </p>

      <div className="control-estado__acciones">
        {pendiente ? (
          <div className="control-estado__motivo">
            <div className="field">
              <label className="field__label" htmlFor="motivo-reapertura">
                Motivo de reapertura <span className="field__required">*</span>
              </label>
              <textarea
                id="motivo-reapertura"
                className="field__control field__control--textarea"
                rows="3"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Explica por qué la solución no resolvió el problema."
              />
              <span className="field__hint">Queda registrado en el historial.</span>
            </div>

            <div className="control-estado__botones">
              <button
                type="button"
                className="btn btn--primary"
                disabled={ocupado || !motivo.trim()}
                onClick={() => enviar(pendiente)}
              >
                {ocupado ? 'Guardando…' : 'Confirmar reapertura'}
              </button>
              <button type="button" className="btn" onClick={cancelar} disabled={ocupado}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          permitidas.map((hacia) => (
            <button
              key={hacia}
              type="button"
              className="btn btn--primary"
              disabled={ocupado}
              onClick={() => elegir(hacia)}
            >
              {etiqueta(desde, hacia)}
            </button>
          ))
        )}
      </div>

      {error && (
        <div className="feedback feedback--error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
