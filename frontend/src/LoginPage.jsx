import { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [tab, setTab]   = useState('login'); // 'login' | 'activar'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login normal
  const [login, setLogin] = useState({ nombre: '', apellido: '', password: '' });
  // Activación primer uso
  const [act, setAct] = useState({ nombre: '', apellido: '', codigo: '', nueva_password: '', confirmar: '' });

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(login)
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      onLogin(data.user);
    } catch { setError('No se pudo conectar al servidor.'); }
    finally { setLoading(false); }
  };

  const handleActivar = async (e) => {
    e.preventDefault(); setError(''); 
    if (act.nueva_password !== act.confirmar) { setError('Las contraseñas no coinciden'); return; }
    if (act.nueva_password.length < 6) { setError('La contraseña debe tener mínimo 6 caracteres'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/activar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: act.nombre, apellido: act.apellido, codigo: act.codigo, nueva_password: act.nueva_password })
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      onLogin(data.user);
    } catch { setError('No se pudo conectar al servidor.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🚗</div>
          <h1>Bitácora de Vehículos</h1>
          <p>Inspección General de Cooperativas</p>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:0, marginBottom:20, background:'var(--bg-panel)', borderRadius:'var(--radius-sm)', padding:3 }}>
          {[['login','Iniciar sesión'],['activar','Primer uso']].map(([k,label]) => (
            <button key={k} onClick={() => { setTab(k); setError(''); }}
              style={{
                flex:1, padding:'7px 10px', border:'none', cursor:'pointer',
                borderRadius:6, fontSize:12.5, fontFamily:'Inter,sans-serif',
                fontWeight: tab===k ? 600 : 400,
                background: tab===k ? 'var(--bg-card)' : 'transparent',
                color: tab===k ? 'var(--text-1)' : 'var(--text-3)',
                transition: 'all 0.15s'
              }}>
              {label}
            </button>
          ))}
        </div>

        {error && <p className="error-msg" style={{ marginBottom:14 }}>⚠️ {error}</p>}

        {/* Login form */}
        {tab === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Nombre</label>
              <input className="form-control" placeholder="Tu nombre"
                value={login.nombre} onChange={e => setLogin(p=>({...p,nombre:e.target.value}))} required autoFocus />
            </div>
            <div className="form-group">
              <label>Apellido</label>
              <input className="form-control" placeholder="Tu apellido"
                value={login.apellido} onChange={e => setLogin(p=>({...p,apellido:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input type="password" className="form-control" placeholder="••••••••"
                value={login.password} onChange={e => setLogin(p=>({...p,password:e.target.value}))} required />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}
              style={{ marginTop:6, padding:'11px' }}>
              {loading ? 'Iniciando...' : '🔐 Iniciar sesión'}
            </button>
          </form>
        )}

        {/* Activación primer uso */}
        {tab === 'activar' && (
          <form className="login-form" onSubmit={handleActivar}>
            <p style={{ fontSize:12, color:'var(--text-3)', marginBottom:4 }}>
              Ingresa el código que te dio el administrador para activar tu cuenta.
            </p>
            <div className="form-group">
              <label>Nombre</label>
              <input className="form-control" placeholder="Tu nombre"
                value={act.nombre} onChange={e => setAct(p=>({...p,nombre:e.target.value}))} required autoFocus />
            </div>
            <div className="form-group">
              <label>Apellido</label>
              <input className="form-control" placeholder="Tu apellido"
                value={act.apellido} onChange={e => setAct(p=>({...p,apellido:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label>Código de aceptación</label>
              <input className="form-control" placeholder="6 dígitos"
                value={act.codigo} onChange={e => setAct(p=>({...p,codigo:e.target.value}))} required
                maxLength={6} style={{ letterSpacing:'0.2em', textAlign:'center', fontSize:18 }} />
            </div>
            <div className="form-group">
              <label>Nueva contraseña</label>
              <input type="password" className="form-control" placeholder="Mínimo 6 caracteres"
                value={act.nueva_password} onChange={e => setAct(p=>({...p,nueva_password:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label>Confirmar contraseña</label>
              <input type="password" className="form-control" placeholder="Repite la contraseña"
                value={act.confirmar} onChange={e => setAct(p=>({...p,confirmar:e.target.value}))} required />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading}
              style={{ marginTop:6, padding:'11px' }}>
              {loading ? 'Activando...' : '✅ Activar cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
