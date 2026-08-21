import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import LoginPage from './LoginPage';
import BitacoraView from './BitacoraView';
import RegistrarComision from './RegistrarComision';
import UsuariosView from './UsuariosView';
import VehiculosView from './VehiculosView';

// ── Sesión persistente ────────────────────────────────────────
const SESSION_KEY    = 'bv_session';
const TIMEOUT_MS     = 10 * 60 * 1000; // 10 minutos de inactividad

const saveSession = (user) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user, lastActivity: Date.now() }));
};

const loadSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { user, lastActivity } = JSON.parse(raw);
    if (Date.now() - lastActivity > TIMEOUT_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return user;
  } catch { return null; }
};

const clearSession = () => localStorage.removeItem(SESSION_KEY);
const touchSession  = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.lastActivity = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
  } catch {}
};

const NAV = [
  { id: 'bitacora', icon: '📊', label: 'Bitácora semanal', section: 'main' },
  { id: 'registrar', icon: '➕', label: 'Registrar salida', section: 'main' },
  { id: 'usuarios', icon: '👥', label: 'Usuarios', section: 'admin', rol: 'admin' },
  { id: 'vehiculos', icon: '🚗', label: 'Vehículos', section: 'admin', rol: 'admin' },
];

const PAGE_TITLES = {
  bitacora: { title: 'Bitácora semanal', sub: 'Control de salidas y entradas de vehículos' },
  registrar: { title: 'Registrar salida', sub: 'Ingresa una nueva comisión o salida de vehículo' },
  usuarios: { title: 'Gestión de usuarios', sub: 'Administra los conductores y administradores' },
  vehiculos: { title: 'Gestión de vehículos', sub: 'Administra la flota vehicular' },
};

export default function App() {
  const [user, setUser] = useState(loadSession);
  const [page, setPage] = useState('bitacora');
  const [changePwd, setChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  // ── Temporizador de inactividad ──
  useEffect(() => {
    if (!user) return;

    // Actualiza la sesión con cada interacción
    const handleActivity = () => touchSession();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Verifica la inactividad cada minuto
    const interval = setInterval(() => {
      if (!loadSession()) {
        setUser(null);
      }
    }, 60000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
    };
  }, [user]);

  /* ── Login ── */
  const handleLogin = (u) => {
    setUser(u);
    saveSession(u);
    if (u.primer_ingreso) setChangePwd(true);
  };
  
  const handleLogout = () => {
    setUser(null);
    clearSession();
  };

  /* ── Cambiar contraseña en primer ingreso ── */
  const submitPwd = async (e) => {
    e.preventDefault(); setPwdErr('');
    if (newPwd.length < 6) { setPwdErr('Mínimo 6 caracteres'); return; }
    const res = await fetch('https://bitacora-vehiculos-6o20.onrender.com/api/auth/cambiar-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: user.id, nueva_password: newPwd })
    });
    const data = await res.json();
    if (data.success) { setChangePwd(false); setNewPwd(''); }
    else setPwdErr(data.message);
  };

  if (!user) return <LoginPage onLogin={handleLogin} />;

  /* ── Cambio obligatorio de contraseña ── */
  if (changePwd) return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🔐</div>
          <h1>Cambio de contraseña</h1>
          <p>Es tu primer ingreso. Define una contraseña segura.</p>
        </div>
        <form className="login-form" onSubmit={submitPwd}>
          {pwdErr && <p className="error-msg">{pwdErr}</p>}
          <div className="form-group">
            <label>Nueva contraseña</label>
            <input type="password" className="form-control" value={newPwd}
              onChange={e => setNewPwd(e.target.value)} required autoFocus
              placeholder="Mínimo 6 caracteres" />
          </div>
          <button className="btn btn-primary w-full" type="submit" style={{ padding: '11px' }}>
            Guardar y continuar
          </button>
        </form>
      </div>
    </div>
  );

  const visibleNav = NAV.filter(n => !n.rol || user.rol === n.rol || user.rol === 'admin');
  const info = PAGE_TITLES[page] || {};

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🚗 Bitácora de<br />Vehículos</h1>
          <p>Inspección Gral. de Cooperativas</p>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section-title">Principal</p>
          {visibleNav.filter(n => n.section === 'main').map(n => (
            <div key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </div>
          ))}

          <p className="nav-section-title">Administración</p>
          {visibleNav.filter(n => n.section === 'admin').map(n => (
            <div key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">
              {user.nombre[0]}{user.apellido[0]}
            </div>
            <div className="user-info">
              <p className="user-name">{user.nombre} {user.apellido}</p>
              <p className="user-role">{user.rol}</p>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="main-content">
        <div className="topbar">
          <div>
            <h2>{info.title}</h2>
            <p>{info.sub}</p>
          </div>
        </div>
        <div className="page-body">
          {page === 'bitacora' && <BitacoraView userRol={user?.rol} userId={user?.id} />}
          {page === 'registrar' && <RegistrarComision currentUser={user} />}
          {page === 'usuarios' && <UsuariosView />}
          {page === 'vehiculos' && <VehiculosView />}
        </div>
      </main>
    </div>
  );
}
