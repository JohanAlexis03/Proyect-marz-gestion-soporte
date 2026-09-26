import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = '/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const resp = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      // Guardamos sesión y rol en localStorage (Requisito)
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));

      // Redirección según rol
      if (data.usuario.rol === 'Coordinador') {
        navigate('/coordinador');
      } else {
        navigate('/otro-rol');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-box">
      <h2>Iniciar Sesión (HU01)</h2>
      
      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="email">Correo Electrónico:</label>
          <input
            id="email"
            type="email"
            placeholder="ej: coordinador@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Contraseña:</label>
          <input
            id="password"
            type="password"
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn-submit" disabled={cargando}>
          {cargando ? 'Verificando...' : 'Ingresar'}
        </button>
      </form>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p><strong>Roles del sistema:</strong></p>
        <p>Solicitante, Agente, Coordinador, Auditor.</p>
        <p style={{ marginTop: '5px' }}>
          <em>Nota: Ingresa un correo que exista en tu tabla <code>usuarios</code> de Supabase.</em>
        </p>
      </div>
    </div>
  );
}
