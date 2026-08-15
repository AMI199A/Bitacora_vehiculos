import { useState } from 'react';
import './index.css';
import LoginPage from './LoginPage';
import BitacoraView from './BitacoraView';
import RegistrarComision from './RegistrarComision';
import UsuariosView from './UsuariosView';
import VehiculosView from './VehiculosView';

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
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('bitacora');
  const [changePwd, setChangePwd] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  /* ── Login ── */
  const handleLogin = (u) => {
    setUser(u);
    if (u.primer_ingreso) setChangePwd(true);
  };

  /* ── Cambiar contraseña en primer ingreso ── */
  const submitPwd = async (e) => {
    e.preventDefault(); setPwdErr('');
    if (newPwd.length < 6) { setPwdErr('Mínimo 6 caracteres'); return; }
    const res = await fetch('/api/auth/cambiar-password', {
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
          <button className="btn-logout" onClick={() => setUser(null)}>Cerrar sesión</button>
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
          {page === 'bitacora' && <BitacoraView userRol={user?.rol} />}
          {page === 'registrar' && <RegistrarComision currentUser={user} />}
          {page === 'usuarios' && <UsuariosView />}
          {page === 'vehiculos' && <VehiculosView />}
        </div>
      </main>
    </div>
  );
}
