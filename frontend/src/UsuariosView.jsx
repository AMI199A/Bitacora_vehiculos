import { useState, useEffect } from 'react';

export default function UsuariosView() {
  const [usuarios,    setUsuarios]    = useState([]);
  const [showModal,   setShowModal]   = useState(false);
  const [editingId,   setEditingId]   = useState(null);
  const [codigoModal, setCodigoModal] = useState(null); // {nombre, apellido, codigo}
  const [form, setForm] = useState({ nombre:'', apellido:'', rol:'conductor' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const cargar = () =>
    fetch('https://bitacora-vehiculos-6o20.onrender.com/api/usuarios').then(r=>r.json()).then(d => { if (d.success) setUsuarios(d.data); });

  useEffect(()=>{ cargar(); },[]);
  const handle = e => setForm(p=>({...p,[e.target.name]:e.target.value}));

  const openModal = (user = null) => {
    if (user) {
      setForm({ nombre: user.nombre, apellido: user.apellido, rol: user.rol });
      setEditingId(user.id);
    } else {
      setForm({ nombre:'', apellido:'', rol:'conductor' });
      setEditingId(null);
    }
    setError('');
    setShowModal(true);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const url = editingId ? `https://bitacora-vehiculos-6o20.onrender.com/api/usuarios/${editingId}` : 'https://bitacora-vehiculos-6o20.onrender.com/api/usuarios';
      const method = editingId ? 'PUT' : 'POST';
      const res  = await fetch(url, {
        method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      
      setShowModal(false);
      setForm({ nombre:'', apellido:'', rol:'conductor' });
      
      if (!editingId && data.codigo) {
        // Mostrar código generado solo al crear
        setCodigoModal({ nombre: data.data.nombre, apellido: data.data.apellido, codigo: data.codigo });
      }
      setEditingId(null);
      cargar();
    } catch(err){ setError(err.message); }
    finally { setLoading(false); }
  };

  const eliminar = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar al usuario ${nombre}?`)) return;
    await fetch(`https://bitacora-vehiculos-6o20.onrender.com/api/usuarios/${id}`,{method:'DELETE'});
    cargar();
  };

  const resetPassword = async (id, nombre) => {
    if (!window.confirm(`¿Resetear la contraseña de ${nombre}?\nSe generará un nuevo código de aceptación.`)) return;
    const res  = await fetch(`https://bitacora-vehiculos-6o20.onrender.com/api/usuarios/${id}/reset-password`,{method:'PUT'});
    const data = await res.json();
    if (data.success) {
      setCodigoModal({ nombre, apellido:'', codigo: data.codigo, esReset: true });
    }
  };

  const ROL_LABELS = { admin:'🛡 Administrador', analista:'📊 Analista', conductor:'🚗 Conductor' };

  return (
    <div>
      <div style={{display:'flex',alignItems:'flex-start',marginBottom:20}}>
        <div>
          <p className="section-title">Gestión de Usuarios</p>
          <p className="section-sub">{usuarios.length} usuario{usuarios.length!==1?'s':''} en el sistema</p>
        </div>
        <button className="btn btn-primary ml-auto" onClick={()=>openModal()}>
          + Nuevo usuario
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Usuario</th><th>Rol</th><th>Código de aceptación</th><th>Estado cuenta</th><th>Creado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.length===0 ? (
              <tr className="empty-row"><td colSpan={6}>No hay usuarios registrados</td></tr>
            ) : usuarios.map(u=>(
              <tr key={u.id}>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div className="user-avatar" style={{width:30,height:30,fontSize:11}}>
                      {u.nombre[0]}{u.apellido[0]}
                    </div>
                    <div>
                      <div style={{fontWeight:600}}>{u.nombre} {u.apellido}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`badge ${u.rol==='admin'?'badge-admin':u.rol==='analista'?'badge-pending':'badge-conductor'}`}>
                    {ROL_LABELS[u.rol]||u.rol}
                  </span>
                </td>
                <td>
                  {u.primer_ingreso && u.codigo_aceptacion ? (
                    <code style={{background:'rgba(99,102,241,0.12)',padding:'3px 10px',borderRadius:6,fontSize:14,letterSpacing:'0.15em',color:'var(--accent-2)'}}>
                      {u.codigo_aceptacion}
                    </code>
                  ) : <span className="text-muted text-sm">—</span>}
                </td>
                <td>
                  <span className={`badge ${u.primer_ingreso?'badge-pending':'badge-done'}`}>
                    {u.primer_ingreso?'⚠️ Pendiente activación':'✅ Activo'}
                  </span>
                </td>
                <td className="text-muted text-sm">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('es-GT') : '—'}
                </td>
                <td>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openModal(u)}>
                      ✏️ Editar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>resetPassword(u.id,`${u.nombre} ${u.apellido}`)}>
                      🔑 Resetear
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={()=>eliminar(u.id,`${u.nombre} ${u.apellido}`)}>
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: crear/editar usuario */}
      {showModal && (
        <div className="modal-backdrop" onClick={()=>{setShowModal(false); setEditingId(null);}}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? 'Editar usuario' : 'Nuevo usuario'}</h3>
              <button className="modal-close" onClick={()=>{setShowModal(false); setEditingId(null);}}>×</button>
            </div>
            <form onSubmit={guardarUsuario}>
              <div className="modal-body">
                {error && <p className="error-msg">{error}</p>}
                {!editingId && (
                  <p className="text-sm text-muted">
                    El sistema generará automáticamente un <strong style={{color:'var(--accent-2)'}}>código de aceptación</strong> que debes entregar al usuario para su primer ingreso.
                  </p>
                )}
                <div className="form-group">
                  <label>Nombre *</label>
                  <input name="nombre" className="form-control" value={form.nombre} onChange={handle} required autoFocus />
                </div>
                <div className="form-group">
                  <label>Apellido *</label>
                  <input name="apellido" className="form-control" value={form.apellido} onChange={handle} required />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select name="rol" className="form-control" value={form.rol} onChange={handle}>
                    <option value="conductor">🚗 Conductor</option>
                    <option value="analista">📊 Analista</option>
                    <option value="admin">🛡 Administrador</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={()=>{setShowModal(false); setEditingId(null);}}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Crear y generar código')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: mostrar código */}
      {codigoModal && (
        <div className="modal-backdrop" onClick={()=>setCodigoModal(null)}>
          <div className="modal modal-sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{codigoModal.esReset?'Código de reset':'Código de aceptación'}</h3>
              <button className="modal-close" onClick={()=>setCodigoModal(null)}>×</button>
            </div>
            <div className="modal-body" style={{textAlign:'center'}}>
              <p style={{fontSize:13,marginBottom:16,color:'var(--text-2)'}}>
                {codigoModal.esReset?'Nuevo código para':'Código para activar la cuenta de'}{' '}
                <strong style={{color:'var(--text-1)'}}>{codigoModal.nombre} {codigoModal.apellido}</strong>
              </p>
              <div style={{background:'var(--bg-panel)',border:'2px dashed var(--accent)',borderRadius:12,padding:'20px 30px',marginBottom:16}}>
                <p style={{fontSize:11,color:'var(--text-3)',marginBottom:6}}>CÓDIGO DE ACEPTACIÓN</p>
                <p style={{fontSize:40,fontWeight:700,letterSpacing:'0.25em',color:'var(--accent-2)',fontFamily:'monospace'}}>
                  {codigoModal.codigo}
                </p>
              </div>
              <p style={{fontSize:12,color:'var(--warning)'}}>
                ⚠️ Anota este código y entrégalo al usuario. No se volverá a mostrar.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={()=>setCodigoModal(null)}>Entendido, ya lo anoté</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
