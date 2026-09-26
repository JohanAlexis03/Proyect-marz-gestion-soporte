import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight, History, Inbox, RefreshCw } from 'lucide-react';
import { API_SOLICITUDES } from '../api';
import { aUTC, formatFecha, formatFechaCorta } from '../utils/fecha';
import { categoriaClase, estadoClase } from '../utils/badges';
import TicketDetail from './TicketDetail';
import './TicketList.css';

export default function TicketList({ userId, refreshKey }) {
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  // Se deriva del listado: si la solicitud deja de existir, el detalle se cierra.
  const seleccionada = tickets.find((ticket) => ticket.id === selectedId) || null;

  // El estado de carga se restablece desde el evento (clic), no desde el effect.
  const handleReload = () => {
    setStatus('loading');
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(API_SOLICITUDES, {
          headers: { 'x-user-id': userId },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `El servidor respondió con estado ${res.status}.`);
        }

        const data = await res.json();
        if (!cancelled) {
          const items = Array.isArray(data) ? data : [];
          // Orden cronológico: la más reciente primero, sin depender del backend.
          items.sort((a, b) => new Date(aUTC(b.fecha)) - new Date(aUTC(a.fecha)));
          setTickets(items);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error al cargar solicitudes:', err);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey, reloadKey]);

  const total = tickets.length;

  return (
    <section className="card ticket-list" aria-labelledby="ticket-list-title">
      <header className="card__header ticket-list__header">
        <div>
          <h2 id="ticket-list-title" className="card__title">
            Mis solicitudes
          </h2>
          <p className="card__subtitle">
            {status === 'ready' && total > 0
              ? `${total} ${total === 1 ? 'solicitud registrada' : 'solicitudes registradas'}`
              : 'Historial de soporte propio.'}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={handleReload}
          disabled={status === 'loading'}
          aria-label="Actualizar listado"
          title="Actualizar"
        >
          <RefreshCw size={16} className={status === 'loading' ? 'is-spinning' : ''} />
        </button>
      </header>

      <div className="ticket-list__body">
        {status === 'loading' && (
          <>
            <div className="ticket-card ticket-card--skeleton" />
            <div className="ticket-card ticket-card--skeleton" />
            <div className="ticket-card ticket-card--skeleton" />
          </>
        )}

        {status === 'error' && (
          <div className="state state--error" role="alert">
            <span className="state__icon state__icon--error">
              <AlertTriangle size={22} />
            </span>
            <h3 className="state__title">No se pudieron cargar tus solicitudes</h3>
            <p className="state__text">
              Falló la conexión con <code>{API_SOLICITUDES}</code>. Verifica que
              el backend esté en ejecución.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleReload}
            >
              Reintentar
            </button>
          </div>
        )}

        {status === 'ready' && total === 0 && (
          <div className="state">
            <span className="state__icon">
              <Inbox size={22} />
            </span>
            <h3 className="state__title">Aún no tienes solicitudes</h3>
            <p className="state__text">
              Cuando crees tu primera solicitud de soporte, aparecerá aquí.
            </p>
          </div>
        )}

        {status === 'ready' && total > 0 && (
          <ul className="ticket-list__items">
            {tickets.map((ticket) => {
              const historial = Array.isArray(ticket.historial) ? ticket.historial : [];
              const ultima = historial.length > 0 ? historial[historial.length - 1] : null;

              return (
                <li
                  key={ticket.id}
                  className="ticket-card"
                  onClick={() => setSelectedId(ticket.id)}
                >
                  <div className="ticket-card__top">
                    <h3 className="ticket-card__title">{ticket.titulo}</h3>
                    <span className={estadoClase(ticket.estado)}>
                      {ticket.estado || 'Sin estado'}
                    </span>
                  </div>

                  <p className="ticket-card__description">{ticket.descripcion}</p>

                  {ultima && (
                    <p className="ticket-card__update">
                      <History size={13} aria-hidden="true" />
                      <span>
                        <strong>Últ. act. {formatFechaCorta(ultima.fecha)}</strong>
                        {ultima.accion ? ` · ${ultima.accion}` : ''}
                      </span>
                    </p>
                  )}

                  <div className="ticket-card__footer">
                    <div className="ticket-card__meta">
                      <span className={categoriaClase(ticket.categoria)}>
                        {ticket.categoria || 'Sin categoría'}
                      </span>
                      <time className="ticket-card__date" dateTime={ticket.fecha}>
                        {formatFecha(ticket.fecha)}
                      </time>
                    </div>

                    <button
                      type="button"
                      className="ticket-card__link"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(ticket.id);
                      }}
                    >
                      Ver detalle
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {seleccionada && (
        <TicketDetail ticket={seleccionada} onClose={() => setSelectedId(null)} />
      )}
    </section>
  );
}
