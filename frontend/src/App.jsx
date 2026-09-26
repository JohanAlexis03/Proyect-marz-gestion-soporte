import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LifeBuoy, LogOut, UserRound } from 'lucide-react';
import Login from './components/Login';
import PanelCoordinador from './components/PanelCoordinador';
import RutaProtegida from './components/RutaProtegida';
import TicketForm from './components/TicketForm';
import TicketList from './components/TicketList';
import './App.css';

// Sesion real que guarda HU01 en localStorage (id, email, rol).
function leerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
}

// Vista del Solicitante: HU02 (crear) + HU03 (consultar).
function SolicitanteShell() {
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const usuario = leerUsuario();

  const handleTicketCreated = () => {
    setRefreshKey((key) => key + 1);
  };

  const handleCerrarSesion = () => {
    localStorage.clear();
    // replace: no dejar esta vista en el historial para que Atras no regrese.
    navigate('/login', { replace: true });
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

          <div className="app-header__actions">
            <div className="app-user">
              <span className="app-user__avatar" aria-hidden="true">
                <UserRound size={18} strokeWidth={2} />
              </span>
              <span className="app-user__meta">
                <span className="app-user__id">{usuario?.email}</span>
                <span className="app-user__role">{usuario?.rol}</span>
              </span>
            </div>

            <button
              type="button"
              className="app-header__logout"
              onClick={handleCerrarSesion}
            >
              <LogOut size={16} strokeWidth={2} />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-layout">
          <TicketForm onTicketCreated={handleTicketCreated} />
          <TicketList refreshKey={refreshKey} />
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
  // El navegador guarda paginas cerradas (bfcache) y puede devolver el estado
  // viejo al pulsar Atras/Adelante, sin volver a montar React. Recargamos para
  // que RutaProtegida vuelva a comprobar la sesion.
  useEffect(() => {
    const handlePageshow = (evento) => {
      if (evento.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', handlePageshow);
    return () => window.removeEventListener('pageshow', handlePageshow);
  }, []);

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

        {/* HU02 + HU03: vista del Solicitante, restringida a su rol (HU01) */}
        <Route
          path="/"
          element={
            <RutaProtegida rolPermitido="Solicitante">
              <SolicitanteShell />
            </RutaProtegida>
          }
        />

        {/* Cualquier otra ruta vuelve al Solicitante */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
