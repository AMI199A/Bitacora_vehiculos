import { useState, useEffect } from 'react';

const API = 'https://bitacora-vehiculos-6o20.onrender.com';

const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day===0?-6:1); return new Date(dt.setDate(diff)); };
const addDays   = (d,n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const fmtDate   = (d) => d.toISOString().split('T')[0];
const fmtDisp   = (d) => new Date(d+'T12:00:00').toLocaleDateString('es-GT',{weekday:'short',month:'short',day:'numeric'});
const dayName   = (d) => new Date(d+'T12:00:00').toLocaleDateString('es-GT',{weekday:'long',day:'numeric',month:'long'});

// ── Modal de Edición ─────────────────────────────────────────
function EditModal({ item, usuarios, vehiculos, onClose, onSaved }) {
  const toTimeStr = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v.substring(0,5);
    if (v instanceof Date) return v.toISOString().substring(11,16);
    return String(v).substring(0,5);
  };
  const toDateStr = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v.split('T')[0];
    if (v instanceof Date) return v.toISOString().split('T')[0];
    return String(v).split('T')[0];
  };

  const [form, setForm] = useState({
    usuario_id:           item.usuario_id   || '',
    vehiculo_id:          item.vehiculo_id  || '',
    fecha_salida:         toDateStr(item.fecha_salida),
    hora_salida:          toTimeStr(item.hora_salida),
    hora_entrada:         toTimeStr(item.hora_entrada),
    descripcion_comision: item.descripcion_comision || '',
    lugares:              item.lugares      || '',
    acompanantes:         item.acompanantes || '',
    con_nombramiento:     item.con_nombramiento || false,
    no_nombramiento:      item.no_nombramiento  || '',
    seccion:              item.seccion      || '',
    kilometraje_salida:   item.kilometraje_salida  ?? '',
    kilometraje_ingreso:  item.kilometraje_ingreso ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type==='checkbox' ? checked : value }));
  };

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        kilometraje_salida:  form.kilometraje_salida  ? Number(form.kilometraje_salida)  : null,
        kilometraje_ingreso: form.kilometraje_ingreso ? Number(form.kilometraje_ingreso) : null,
      };
      const res  = await fetch(`${API}/api/comisiones/${item.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      onSaved();
    } catch (e) {
      setErr(e.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const total = form.kilometraje_salida && form.kilometraje_ingreso
    ? Number(form.kilometraje_ingreso) - Number(form.kilometraje_salida) : null;

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:1000,
      background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',
      padding:16
    }} onClick={onClose}>
      <div style={{
        background:'var(--bg-card)',borderRadius:16,width:'100%',maxWidth:680,
        maxHeight:'90vh',overflowY:'auto',boxShadow:'0 24px 64px rgba(0,0,0,0.5)',
        border:'1px solid var(--border)'
      }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>✏️ Editar boleta</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={save} style={{padding:24}}>
          {err && <div className="error-msg" style={{marginBottom:16}}>⚠️ {err}</div>}

          {/* Conductor y vehículo */}
          <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Conductor y vehículo</p>
          <div className="form-grid mb-4">
            <div className="form-group">
              <label>Conductor *</label>
              <select name="usuario_id" className="form-control" value={form.usuario_id} onChange={handle} required>
                <option value="">— Seleccionar —</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Vehículo *</label>
              <select name="vehiculo_id" className="form-control" value={form.vehiculo_id} onChange={handle} required>
                <option value="">— Seleccionar —</option>
                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} — {v.placa}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha y horas */}
          <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Fecha y horario</p>
          <div className="form-grid cols-3 mb-4">
            <div className="form-group">
              <label>Fecha de salida *</label>
              <input name="fecha_salida" type="date" className="form-control" value={form.fecha_salida} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Hora de salida *</label>
              <input name="hora_salida" type="time" className="form-control" value={form.hora_salida} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Hora de entrada</label>
              <input name="hora_entrada" type="time" className="form-control" value={form.hora_entrada} onChange={handle} />
            </div>
          </div>

          {/* Comisión */}
          <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Comisión</p>
          <div className="form-grid mb-4">
            <div className="form-group full">
              <label>Descripción *</label>
              <input name="descripcion_comision" className="form-control" value={form.descripcion_comision} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Lugares *</label>
              <input name="lugares" className="form-control" value={form.lugares} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Acompañantes</label>
              <input name="acompanantes" className="form-control" value={form.acompanantes} onChange={handle} />
            </div>
          </div>

          {/* Nombramiento */}
          <div style={{background:'var(--bg-panel)',borderRadius:8,padding:'12px 16px',marginBottom:16}}>
            <label className="form-check" style={{marginBottom:8}}>
              <input type="checkbox" name="con_nombramiento" checked={form.con_nombramiento} onChange={handle} />
              <span>Con nombramiento</span>
            </label>
            {form.con_nombramiento && (
              <div className="form-group">
                <label>No. de nombramiento *</label>
                <input name="no_nombramiento" className="form-control" value={form.no_nombramiento} onChange={handle} required={form.con_nombramiento} />
              </div>
            )}
          </div>

          {/* Sección */}
          <div className="form-grid mb-4">
            <div className="form-group full">
              <label>Sección *</label>
              <input name="seccion" className="form-control" value={form.seccion} onChange={handle} required />
            </div>
          </div>

          {/* Kilometraje */}
          <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Kilometraje</p>
          <div className="form-grid mb-4">
            <div className="form-group">
              <label>KM Salida *</label>
              <input name="kilometraje_salida" type="number" min="0" className="form-control" value={form.kilometraje_salida} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>KM Ingreso</label>
              <input name="kilometraje_ingreso" type="number" min="0" className="form-control" value={form.kilometraje_ingreso} onChange={handle} />
            </div>
          </div>

          {total !== null && (
            <div style={{padding:'12px 16px',background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:8,marginBottom:16}}>
              📏 <strong>Total estimado:</strong> {total} km
            </div>
          )}

          <hr className="divider" />
          <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '⏳ Guardando...' : '💾 Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────
export default function BitacoraView({ userRol }) {
  const [comisiones, setComisiones] = useState([]);
  const [monday, setMonday]         = useState(getMonday(new Date()));
  const [loading, setLoading]       = useState(false);
  const [anioCierre, setAnioCierre] = useState(String(new Date().getFullYear()));
  const [vista, setVista]           = useState('semana');
  const [diaSeleccionado, setDia]   = useState(null);

  // Editar / eliminar
  const [editItem,   setEditItem]   = useState(null);
  const [usuarios,   setUsuarios]   = useState([]);
  const [vehiculos,  setVehiculos]  = useState([]);

  const fi = fmtDate(monday);
  const ff = fmtDate(addDays(monday, 4));

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/api/comisiones/semanal?fecha_inicio=${fi}&fecha_fin=${ff}`);
      const data = await res.json();
      if (data.success) setComisiones(data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [monday]);

  // Cargar usuarios y vehículos para el modal de edición
  useEffect(() => {
    if (userRol !== 'admin' && userRol !== 'analista') return;
    Promise.all([
      fetch(`${API}/api/usuarios`).then(r=>r.json()),
      fetch(`${API}/api/vehiculos`).then(r=>r.json()),
    ]).then(([u,v]) => {
      if (u.success) setUsuarios(u.data);
      if (v.success) setVehiculos(v.data);
    });
  }, [userRol]);

  const prevWeek = () => setMonday(p => addDays(p,-7));
  const nextWeek = () => setMonday(p => addDays(p,7));

  // Agrupar por día
  const porDia = {};
  comisiones.forEach(c => {
    const f = typeof c.fecha_salida==='string' ? c.fecha_salida.split('T')[0]
              : c.fecha_salida instanceof Date ? c.fecha_salida.toISOString().split('T')[0]
              : String(c.fecha_salida);
    if (!porDia[f]) porDia[f] = [];
    porDia[f].push(c);
  });

  const diasSemana = Array.from({length:5},(_,i) => fmtDate(addDays(monday,i)));

  const descargarPDF = async (id) => {
    window.open(`${API}/api/comisiones/${id}/pdf`, '_blank');
    setComisiones(prev => prev.map(c => c.id===id ? {...c, estado:'DESCARGADO'} : c));
  };

  const descargaPDFDia    = (fecha) => window.open(`${API}/api/comisiones/pdf-dia/${fecha}`, '_blank');
  const descargaPDFSemana = () => window.open(`${API}/api/comisiones/pdf-semana?fecha_inicio=${fi}&fecha_fin=${ff}`, '_blank');

  const eliminarComision = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta boleta? Esta acción no se puede deshacer.')) return;
    try {
      const res  = await fetch(`${API}/api/comisiones/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setComisiones(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const cierreAnual = async () => {
    if (!window.confirm(`¿Confirmar cierre anual ${anioCierre}?\nSe exportará CSV y se eliminarán los registros de ese año.`)) return;
    const r = await fetch(`${API}/api/admin/cierre-anual`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ anio: Number(anioCierre) })
    });
    if (r.ok) {
      const blob = await r.blob();
      const a = Object.assign(document.createElement('a'),{
        href: URL.createObjectURL(blob), download:`Respaldo_Bitacora_${anioCierre}.csv`
      });
      a.click(); cargar(); alert('Cierre anual completado ✅');
    } else {
      const d = await r.json(); alert('Error: '+d.message);
    }
  };

  const pendientes  = comisiones.filter(c=>c.estado!=='DESCARGADO').length;
  const descargados = comisiones.filter(c=>c.estado==='DESCARGADO').length;
  const totalKm     = comisiones.reduce((s,c)=>s+(Number(c.total_kilometros)||0),0).toFixed(0);

  const isAdminOrAnalista = userRol==='admin' || userRol==='analista';

  // Render de botones de acción para cada fila
  const AccionesBoleta = ({ item }) => (
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      <button className="btn btn-success btn-sm" title="Descargar PDF" onClick={()=>descargarPDF(item.id)}>📄</button>
      {userRol==='admin' && (
        <>
          <button className="btn btn-primary btn-sm" title="Editar boleta" onClick={()=>setEditItem(item)}>✏️</button>
          <button className="btn btn-danger btn-sm" title="Eliminar boleta" onClick={()=>eliminarComision(item.id)}>🗑️</button>
        </>
      )}
    </div>
  );

  return (
    <div>
      {/* Modal de edición */}
      {editItem && (
        <EditModal
          item={editItem}
          usuarios={usuarios}
          vehiculos={vehiculos}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); cargar(); }}
        />
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total semana</span>
          <span className="stat-value accent">{comisiones.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pendientes</span>
          <span className="stat-value warning">{pendientes}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Descargados</span>
          <span className="stat-value success">{descargados}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Km totales semana</span>
          <span className="stat-value accent">{totalKm}</span>
        </div>
      </div>

      <div className="card">
        {/* Header: nav semana + botones descarga */}
        <div className="card-header" style={{ flexWrap:'wrap', gap:10 }}>
          <div className="week-nav">
            <button className="btn btn-ghost btn-sm" onClick={prevWeek}>← Anterior</button>
            <span style={{fontWeight:600}}>Semana: {fmtDisp(fi)} — {fmtDisp(ff)}</span>
            <button className="btn btn-ghost btn-sm" onClick={nextWeek}>Siguiente →</button>
            <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>↺</button>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {isAdminOrAnalista && (
              <>
                <button className="btn btn-success btn-sm" onClick={descargaPDFSemana}>📄 PDF semana completa</button>
                {userRol==='admin' && (
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input type="number" value={anioCierre} onChange={e=>setAnioCierre(e.target.value)}
                      className="form-control" style={{width:75}} />
                    <button className="btn btn-danger btn-sm" onClick={cierreAnual}>📤 Cierre anual</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs vista */}
        <div style={{padding:'12px 20px 0',display:'flex',gap:6,borderBottom:'1px solid var(--border)'}}>
          {[['semana','📅 Vista semanal'],['dia','📆 Detalle por día']].map(([k,l])=>(
            <button key={k} onClick={()=>setVista(k)}
              className={`btn btn-sm ${vista===k?'btn-primary':'btn-ghost'}`}>{l}</button>
          ))}
        </div>

        {/* Vista: semana completa */}
        {vista==='semana' && (
          <div className="table-wrap" style={{borderRadius:0,border:'none'}}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Conductor</th><th>Vehículo</th>
                  <th>Descripción / Lugares</th><th>KM Salida</th><th>KM Ingreso</th>
                  <th>Total Km</th><th>Estado</th>
                  {isAdminOrAnalista && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="empty-row"><td colSpan={9}>⏳ Cargando...</td></tr>
                ) : comisiones.length===0 ? (
                  <tr className="empty-row"><td colSpan={9}>No hay registros para esta semana</td></tr>
                ) : comisiones.map(item => {
                  const fecha = typeof item.fecha_salida==='string' ? item.fecha_salida.split('T')[0]
                    : item.fecha_salida instanceof Date ? item.fecha_salida.toISOString().split('T')[0] : String(item.fecha_salida);
                  const esVerde = item.estado==='DESCARGADO';
                  return (
                    <tr key={item.id}>
                      <td style={{whiteSpace:'nowrap',fontSize:12}}>{fecha}</td>
                      <td>{item.nombre} {item.apellido}</td>
                      <td><div style={{fontWeight:600,fontSize:13}}>{item.marca}</div><div style={{fontSize:11,color:'var(--text-3)'}}>{item.placa}</div></td>
                      <td style={{maxWidth:200}}>
                        <div style={{fontSize:12.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={item.descripcion_comision}>{item.descripcion_comision}</div>
                        <div style={{fontSize:11,color:'var(--text-3)'}}>{item.lugares}</div>
                      </td>
                      <td>{item.kilometraje_salida}</td>
                      <td>{item.kilometraje_ingreso ?? '—'}</td>
                      <td><strong>{item.total_kilometros ?? '—'}</strong> km</td>
                      <td><span className={`badge ${esVerde?'badge-done':'badge-pending'}`}>{esVerde?'✅ OK':'🔴 Pendiente'}</span></td>
                      {isAdminOrAnalista && (
                        <td><AccionesBoleta item={item} /></td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Vista: detalle por día */}
        {vista==='dia' && (
          <div style={{padding:20}}>
            {diasSemana.map(fecha => {
              const registros = porDia[fecha] || [];
              const expanded  = diaSeleccionado===fecha;
              return (
                <div key={fecha} className="card" style={{marginBottom:12}}>
                  <div style={{padding:'14px 18px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}
                    onClick={()=>setDia(expanded ? null : fecha)}>
                    <span style={{fontSize:18}}>{expanded?'▼':'▶'}</span>
                    <div style={{flex:1}}>
                      <span style={{fontWeight:600,textTransform:'capitalize'}}>{dayName(fecha)}</span>
                      <span style={{marginLeft:12,fontSize:12,color:'var(--text-3)'}}>{registros.length} registro{registros.length!==1?'s':''}</span>
                      {registros.length>0 && <span style={{marginLeft:12,fontSize:12,color:'var(--accent-2)'}}>
                        {registros.reduce((s,c)=>s+(Number(c.total_kilometros)||0),0).toFixed(0)} km totales
                      </span>}
                    </div>
                    {registros.length>0 && isAdminOrAnalista && (
                      <button className="btn btn-success btn-sm" onClick={e=>{e.stopPropagation();descargaPDFDia(fecha);}}>
                        📄 PDF del día
                      </button>
                    )}
                    {registros.length===0 && <span className="badge badge-conductor">Sin registros</span>}
                  </div>

                  {expanded && registros.length>0 && (
                    <div style={{borderTop:'1px solid var(--border)'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                        <thead>
                          <tr style={{background:'var(--bg-panel)'}}>
                            <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600}}>Conductor</th>
                            <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600}}>Vehículo</th>
                            <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600}}>Descripción</th>
                            <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600}}>Hora S/E</th>
                            <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600}}>Km S/E</th>
                            <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600}}>Total</th>
                            <th style={{padding:'10px 16px',textAlign:'left',fontSize:11,color:'var(--text-3)',fontWeight:600}}>Estado</th>
                            {isAdminOrAnalista && <th style={{padding:'10px 16px'}}></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {registros.map(item=>{
                            const esVerde = item.estado==='DESCARGADO';
                            const fmtHora = v => v instanceof Date ? v.toISOString().substring(11,16) : (v??'—');
                            return (
                              <tr key={item.id} style={{borderTop:'1px solid var(--border)'}}>
                                <td style={{padding:'12px 16px'}}>{item.nombre} {item.apellido}</td>
                                <td style={{padding:'12px 16px'}}><strong>{item.marca}</strong><br/><span style={{fontSize:11,color:'var(--text-3)'}}>{item.placa}</span></td>
                                <td style={{padding:'12px 16px',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={item.descripcion_comision}>{item.descripcion_comision}</td>
                                <td style={{padding:'12px 16px',fontSize:12}}>{fmtHora(item.hora_salida)} / {fmtHora(item.hora_entrada)}</td>
                                <td style={{padding:'12px 16px',fontSize:12}}>{item.kilometraje_salida} / {item.kilometraje_ingreso??'—'}</td>
                                <td style={{padding:'12px 16px'}}><strong>{item.total_kilometros??'—'}</strong> km</td>
                                <td style={{padding:'12px 16px'}}><span className={`badge ${esVerde?'badge-done':'badge-pending'}`}>{esVerde?'✅ OK':'🔴 Pendiente'}</span></td>
                                {isAdminOrAnalista && (
                                  <td style={{padding:'12px 16px'}}><AccionesBoleta item={item} /></td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
