import { LifeBuoy, UserRound } from 'lucide-react';
import TicketForm from './components/TicketForm';
import './App.css';

// Usuario autenticado (Sprint 1: sesión simulada, se reemplaza por HU01).
const CURRENT_USER = {
  id: 'user-123',
  role: 'Solicitante',
};

export default function App() {
  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-brand">
            <span className="app-brand__logo" aria-hidden="true">
              <LifeBuoy size={22} strokeWidth={2} />
            </span>
            <div className="app-brand__text">
              <span className="app-brand__title">Plataforma de Soporte Interno</span>
              <span className="app-brand__subtitle">MAR-Z · Sprint 1</span>
            </div>
          </div>

          <div className="app-user">
            <span className="app-user__avatar" aria-hidden="true">
              <UserRound size={18} strokeWidth={2} />
            </span>
            <span className="app-user__meta">
              <span className="app-user__id">{CURRENT_USER.id}</span>
              <span className="app-user__role">{CURRENT_USER.role}</span>
            </span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-layout">
          <TicketForm userId={CURRENT_USER.id} />
        </div>
      </main>
    </>
  );
}
