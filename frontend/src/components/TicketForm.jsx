import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react';
import { API_SOLICITUDES } from '../api';
import './TicketForm.css';

const CATEGORIES = ['Hardware', 'Software', 'Redes'];
const PRIORITIES = ['Baja', 'Media', 'Alta'];

// Fecha local en AAAA-MM-DD: toISOString() da UTC y aca (UTC-5) puede caer
// en el día anterior antes de las 5 de la mañana.
const hoyISO = () => {
  const ahora = new Date();
  return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
};

const INITIAL_FORM = {
  titulo: '',
  categoria: '',
  descripcion: '',
  prioridad: 'Media',
  justificacion: '',
  fechaObjetivo: '',
};

export default function TicketForm({ onTicketCreated }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    const { titulo, categoria, descripcion, prioridad, justificacion, fechaObjetivo } = form;
    if (!titulo.trim() || !categoria || !descripcion.trim()) {
      setError('Completa los tres campos obligatorios.');
      return;
    }

    // Cambio controlado: la prioridad Alta no se registra sin justificacion
    // ni fecha objetivo, y se avisa aca mismo en lugar de fallar en el servidor.
    if (prioridad === 'Alta') {
      if (!justificacion.trim()) {
        setError('La prioridad Alta requiere una justificación.');
        return;
      }
      if (justificacion.trim().length > 300) {
        setError('La justificación de la prioridad Alta no puede superar los 300 caracteres.');
        return;
      }
      if (!fechaObjetivo) {
        setError('La prioridad Alta requiere una fecha objetivo.');
        return;
      }
      if (fechaObjetivo < hoyISO()) {
        setError('La fecha objetivo no puede ser anterior a la fecha actual.');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API_SOLICITUDES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          titulo: titulo.trim(),
          categoria,
          descripcion: descripcion.trim(),
          prioridad,
          ...(prioridad === 'Alta'
            ? {
                justificacion_prioridad: justificacion.trim(),
                fecha_objetivo: fechaObjetivo,
              }
            : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `El servidor respondió con estado ${res.status}.`);
      }

      setForm(INITIAL_FORM);
      setSuccess('Solicitud registrada correctamente.');
      if (onTicketCreated) onTicketCreated();
    } catch (err) {
      const isNetworkError = err instanceof TypeError;
      setError(
        isNetworkError
          ? `No se pudo conectar con el servidor. Verifica que el backend esté activo en ${API_SOLICITUDES}.`
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card ticket-form" aria-labelledby="ticket-form-title">
      <header className="card__header">
        <h2 id="ticket-form-title" className="card__title">
          Nueva solicitud
        </h2>
        <p className="card__subtitle">Registra un pedido de soporte para tu equipo.</p>
      </header>

      {error && (
        <div className="feedback feedback--error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="feedback feedback--success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{success}</span>
        </div>
      )}

      <form className="ticket-form__fields" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="titulo">
            Título de la solicitud <span className="field__required">*</span>
          </label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            className="field__control"
            placeholder="Ej. No enciende la impresora del piso 3"
            value={form.titulo}
            onChange={updateField('titulo')}
            maxLength={120}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="categoria">
            Categoría <span className="field__required">*</span>
          </label>
          <select
            id="categoria"
            name="categoria"
            className="field__control field__control--select"
            value={form.categoria}
            onChange={updateField('categoria')}
          >
            <option value="">Seleccione una categoría…</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

          <div className="field">
            <label className="field__label" htmlFor="prioridad">
              Prioridad
            </label>
            <select
              id="prioridad"
              name="prioridad"
              className="field__control field__control--select"
              value={form.prioridad}
              onChange={updateField('prioridad')}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
            <span className="field__hint">
              La prioridad Alta pide justificación y fecha objetivo.
            </span>
          </div>

          {form.prioridad === 'Alta' && (
            <>
              <div className="field">
                <label className="field__label" htmlFor="justificacion">
                  Justificación de la prioridad Alta{' '}
                  <span className="field__required">*</span>
                </label>
                <textarea
                  id="justificacion"
                  name="justificacion"
                  className="field__control field__control--textarea"
                  placeholder="Explica por qué esta solicitud debe atenderse como prioritaria…"
                  rows={3}
                  value={form.justificacion}
                  onChange={updateField('justificacion')}
                  maxLength={300}
                />
                <span className="field__hint">
                  {form.justificacion.length}/300 caracteres.
                </span>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="fechaObjetivo">
                  Fecha objetivo <span className="field__required">*</span>
                </label>
                <input
                  id="fechaObjetivo"
                  name="fechaObjetivo"
                  type="date"
                  className="field__control"
                  value={form.fechaObjetivo}
                  onChange={updateField('fechaObjetivo')}
                  min={hoyISO()}
                />
              </div>
            </>
          )}

          <div className="field">
            <label className="field__label" htmlFor="descripcion">
              Descripción <span className="field__required">*</span>
            </label>
          <textarea
            id="descripcion"
            name="descripcion"
            className="field__control field__control--textarea"
            placeholder="Describe el problema con el mayor detalle posible…"
            rows={5}
            value={form.descripcion}
            onChange={updateField('descripcion')}
            maxLength={1000}
          />
          <span className="field__hint">Máximo 1000 caracteres.</span>
        </div>

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={16} className="btn__spinner" aria-hidden="true" />
              Guardando…
            </>
          ) : (
            <>
              <Send size={16} aria-hidden="true" />
              Crear solicitud
            </>
          )}
        </button>
      </form>
    </section>
  );
}
