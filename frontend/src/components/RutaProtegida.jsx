import React from 'react';
import { Navigate } from 'react-router-dom';

export default function RutaProtegida({ rolPermitido, children }) {
  const usuarioRaw = localStorage.getItem('usuario');
  const token = localStorage.getItem('token');

  // Si no hay sesión iniciada, enviar directo al login
  if (!usuarioRaw || !token) {
    return <Navigate to="/login" replace />;
  }

  try {
    const usuario = JSON.parse(usuarioRaw);

    // Si el rol no coincide con el permitido, bloqueamos el acceso
    if (usuario.rol !== rolPermitido) {
      return (
        <div className="container" style={{ textAlign: 'center', marginTop: '40px' }}>
          <h2 style={{ color: '#dc3545' }}>Acceso Denegado (403)</h2>
          <p style={{ margin: '15px 0' }}>
            Tu rol actual es <strong>"{usuario.rol}"</strong> y esta sección es exclusiva para el rol <strong>"{rolPermitido}"</strong>.
          </p>
          <button
            className="btn-logout"
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
          >
            Cerrar sesión e ingresar con otra cuenta
          </button>
        </div>
      );
    }

    return children;
  } catch (error) {
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }
}
