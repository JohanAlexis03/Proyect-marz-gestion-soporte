import { LifeBuoy, LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// La sesión que guarda HU01 en localStorage (id, email, rol).
function leerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario') || 'null');
  } catch {
    return null;
  }
}

// Cabecera común de las vistas autenticadas: marca, usuario y cierre de sesión.
export default function AppHeader({ subtitulo = 'MAR-Z · Sprint 1' }) {
  const navigate = useNavigate();
  const usuario = leerUsuario();

  const handleCerrarSesion = () => {
    localStorage.clear();
    // replace: no dejar esta vista en el historial para que Atras no regrese.
    navigate('/login', { replace: true });
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-brand">
          <span className="app-brand__logo" aria-hidden="true">
            <LifeBuoy size={22} strokeWidth={2} />
          </span>
          <div className="app-brand__text">
            <span className="app-brand__title">Plataforma de Soporte Interno</span>
            <span className="app-brand__subtitle">{subtitulo}</span>
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
  );
}
