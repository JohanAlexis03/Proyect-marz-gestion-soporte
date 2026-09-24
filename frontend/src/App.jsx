import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login.jsx';
import PanelCoordinador from './components/PanelCoordinador.jsx';
import RutaProtegida from './components/RutaProtegida.jsx';

// Vista de ejemplo para usuarios con roles distintos a Coordinador
function VistaOtroRol() {
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  return (
    <div className="container" style={{ textAlign: 'center', marginTop: '40px' }}>
      <h2>Bienvenido al Portal</h2>
      <p style={{ margin: '15px 0' }}>
        Has iniciado sesión como <strong>{usuario.email}</strong> con rol: <strong>{usuario.rol}</strong>.
      </p>
      <div style={{ margin: '20px auto', maxWidth: '500px' }}>
        <p style={{ color: '#555', marginBottom: '15px' }}>
          Como tu rol no es <strong>Coordinador</strong>, tus permisos están restringidos y el sistema no te permite acceder al Panel de Coordinación.
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
        <Route path="/login" element={<Login />} />

        {/* Ruta protegida exclusiva para el Coordinador */}
        <Route
          path="/coordinador"
          element={
            <RutaProtegida rolPermitido="Coordinador">
              <PanelCoordinador />
            </RutaProtegida>
          }
        />

        {/* Vista para otros roles autenticados */}
        <Route path="/otro-rol" element={<VistaOtroRol />} />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
