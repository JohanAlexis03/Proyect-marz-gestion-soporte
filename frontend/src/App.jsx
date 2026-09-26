import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LifeBuoy, UserRound } from 'lucide-react';
import Login from './components/Login';
import PanelCoordinador from './components/PanelCoordinador';
import RutaProtegida from './components/RutaProtegida';
import TicketForm from './components/TicketForm';
import TicketList from './components/TicketList';
import './App.css';

// Usuario autenticado (Sprint 1: sesion simulada, se reemplaza por HU01).
const CURRENT_USER = {
  id: 'user-123',
  role: 'Solicitante',
};

// Vista del Solicitante: HU02 (crear) + HU03 (consultar).
function SolicitanteShell() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTicketCreated = () => {
    setRefreshKey((key) => key + 1);
  };

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
          <TicketForm
            userId={CURRENT_USER.id}
            onTicketCreated={handleTicketCreated}
          />
          <TicketList userId={CURRENT_USER.id} refreshKey={refreshKey} />
        </div>
      </main>
    </>
  );
}

// Vista para usuarios autenticados con roles distintos a Coordinador (HU01).
function VistaOtroRol() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '40px' }}>
      <h2>Bienvenido al Portal</h2>
      <p style={{ margin: '15px 0' }}>
        Has iniciado sesión como <strong>{usuario.email}</strong> con rol:{' '}
        <strong>{usuario.rol}</strong>.
      </p>
      <div style={{ margin: '20px auto', maxWidth: '500px' }}>
        <p style={{ color: '#555', marginBottom: '15px' }}>
          Como tu rol no es <strong>Coordinador</strong>, tus permisos están
          restringidos y el sistema no te permite acceder al Panel de Coordinación.
        </p>
        <button
          className="btn-logout"
          onClick={() => {
            localStorage.clear();
            window.location.href = '/login';
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* HU01 */}
        <Route path="/login" element={<Login />} />

        {/* HU04: panel restringido al rol Coordinador */}
        <Route
          path="/coordinador"
          element={
            <RutaProtegida rolPermitido="Coordinador">
              <PanelCoordinador />
            </RutaProtegida>
          }
        />

        {/* Vista para los demas roles autenticados */}
        <Route path="/otro-rol" element={<VistaOtroRol />} />

        {/* HU02 + HU03: vista por defecto del Solicitante */}
        <Route path="/" element={<SolicitanteShell />} />

        {/* Cualquier otra ruta vuelve al Solicitante */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
