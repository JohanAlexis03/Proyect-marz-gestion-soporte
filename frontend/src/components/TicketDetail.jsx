import { useEffect, useRef } from 'react';
import { History, X } from 'lucide-react';
import { formatFecha, formatFechaCorta } from '../utils/fecha';
import { categoriaClase, estadoClase } from '../utils/badges';
import './TicketDetail.css';

export default function TicketDetail({ ticket, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    dialog.showModal();

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowAnterior;
      if (dialog.open) dialog.close();
    };
  }, []);

  const historial = Array.isArray(ticket.historial) ? ticket.historial : [];
  const ultima = historial.length > 0 ? historial[historial.length - 1] : null;

  // Clic fuera del panel (sobre el backdrop) → cerrar.
  const handleBackdrop = (event) => {
    if (event.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="detail"
      aria-labelledby="detail-title"
      onClose={onClose}
      onClick={handleBackdrop}
    >
      <div className="detail__panel">
        <header className="detail__header">
          <div className="detail__badges">
            <span className={estadoClase(ticket.estado)}>{ticket.estado || 'Sin estado'}</span>
            <span className={categoriaClase(ticket.categoria)}>
              {ticket.categoria || 'Sin categoría'}
            </span>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Cerrar detalle"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <h2 id="detail-title" className="detail__title">
          {ticket.titulo}
        </h2>
        <p className="detail__ref">Solicitud · {ticket.id}</p>

        <section className="detail__section">
          <h3 className="detail__subtitle">Descripción</h3>
          <p className="detail__description">{ticket.descripcion}</p>
        </section>

        <dl className="detail__meta">
          <div className="detail__meta-item">
            <dt>Creada</dt>
            <dd>
              <time dateTime={ticket.fecha}>{formatFecha(ticket.fecha)}</time>
            </dd>
          </div>

          <div className="detail__meta-item">
            <dt>Prioridad</dt>
            <dd>{ticket.prioridad || 'Sin asignar'}</dd>
          </div>

          <div className="detail__meta-item detail__meta-item--full">
            <dt>Última actualización</dt>
            <dd>
              {ultima ? (
                <>
                  <span className="detail__meta-strong">{formatFechaCorta(ultima.fecha)}</span>
                  <span className="detail__meta-detail">{ultima.accion}</span>
                </>
              ) : (
                <span className="detail__meta-detail">Sin cambios desde su creación.</span>
              )}
            </dd>
          </div>
        </dl>

        <section className="detail__section">
          <h3 className="detail__subtitle">
            <History size={15} aria-hidden="true" />
            Historial
          </h3>

          {historial.length === 0 ? (
            <p className="detail__empty">Todavía no hay movimientos en esta solicitud.</p>
          ) : (
            <ol className="detail__timeline">
              {historial.map((entrada, index) => (
                <li key={`${entrada.fecha}-${index}`} className="detail__timeline-item">
                  <span className="detail__timeline-date">{formatFechaCorta(entrada.fecha)}</span>
                  <span className="detail__timeline-action">{entrada.accion}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </dialog>
  );
}
