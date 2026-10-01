import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppHeader from './components/AppHeader';
import Login from './components/Login';
import PanelCoordinador from './components/PanelCoordinador';
import RutaProtegida from './components/RutaProtegida';
import TicketForm from './components/TicketForm';
import TicketList from './components/TicketList';
import './App.css';

// Vista del Solicitante: HU02 (crear) + HU03 (consultar).
function SolicitanteShell() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTicketCreated = () => {
    setRefreshKey((key) => key + 1);
  };

  return (
    <>
      <AppHeader />

      <main className="app-main">
        <div className="app-layout">
          <TicketForm onTicketCreated={handleTicketCreated} />
          <TicketList refreshKey={refreshKey} />
        </div>
      </main>
    </>
  );
}

// Vista del Agente: HU07, la cola completa para avanzar el estado.
function AgenteShell() {
  return (
    <>
      <AppHeader />

      <main className="app-main">
        <div className="app-layout app-layout--unica">
          <TicketList
            titulo="Cola de soporte"
            subtitulo="Solicitudes del equipo."
            textoVacio="No hay solicitudes pendientes en este momento."
          />
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

        {/* HU07: cola del Agente, restringida a su rol (HU01) */}
        <Route
          path="/agente"
          element={
            <RutaProtegida rolPermitido="Agente">
              <AgenteShell />
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
