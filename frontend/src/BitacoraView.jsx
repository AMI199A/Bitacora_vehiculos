import { useState, useEffect } from 'react';

const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day===0?-6:1); return new Date(dt.setDate(diff)); };
const addDays   = (d,n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const fmtDate   = (d) => d.toISOString().split('T')[0];
const fmtDisp   = (d) => new Date(d+'T12:00:00').toLocaleDateString('es-GT',{weekday:'short',month:'short',day:'numeric'});
const dayName   = (d) => new Date(d+'T12:00:00').toLocaleDateString('es-GT',{weekday:'long',day:'numeric',month:'long'});

const DAYS_ES   = ['Lunes','Martes','Miércoles','Jueves','Viernes'];

export default function BitacoraView({ userRol }) {
  const [comisiones, setComisiones] = useState([]);
  const [monday, setMonday]         = useState(getMonday(new Date()));
  const [loading, setLoading]       = useState(false);
  const [anioCierre, setAnioCierre] = useState(String(new Date().getFullYear()));
  const [vista, setVista]           = useState('semana'); // 'semana' | 'dia'
  const [diaSeleccionado, setDia]   = useState(null);

  const fi = fmtDate(monday);
  const ff = fmtDate(addDays(monday, 4));

  const cargar = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`https://bitacora-vehiculos-6o20.onrender.com/api/comisiones/semanal?fecha_inicio=${fi}&fecha_fin=${ff}`);
      const data = await res.json();
      if (data.success) setComisiones(data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [monday]);

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
    window.open(`https://bitacora-vehiculos-6o20.onrender.com/api/comisiones/${id}/pdf`, '_blank');
    setComisiones(prev => prev.map(c => c.id===id ? {...c, estado:'DESCARGADO'} : c));
  };

  const descargaPDFDia = (fecha) => window.open(`https://bitacora-vehiculos-6o20.onrender.com/api/comisiones/pdf-dia/${fecha}`, '_blank');
  const descargaPDFSemana = () => window.open(`https://bitacora-vehiculos-6o20.onrender.com/api/comisiones/pdf-semana?fecha_inicio=${fi}&fecha_fin=${ff}`, '_blank');

  const cierreAnual = async () => {
    if (!window.confirm(`¿Confirmar cierre anual ${anioCierre}?\nSe exportará CSV y se eliminarán los registros de ese año.`)) return;
    const r = await fetch('https://bitacora-vehiculos-6o20.onrender.com/api/admin/cierre-anual', {
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

  return (
    <div>
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
            {(userRol==='admin'||userRol==='analista') && (
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
                  {(userRol==='admin'||userRol==='analista') && <th>Boleta</th>}
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
                      {(userRol==='admin'||userRol==='analista') && (
                        <td><button className="btn btn-success btn-sm" onClick={()=>descargarPDF(item.id)}>📄</button></td>
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
                    {registros.length>0 && (userRol==='admin'||userRol==='analista') && (
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
                            {(userRol==='admin'||userRol==='analista') && <th style={{padding:'10px 16px'}}></th>}
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
                                {(userRol==='admin'||userRol==='analista') && (
                                  <td style={{padding:'12px 16px'}}><button className="btn btn-success btn-sm" onClick={()=>descargarPDF(item.id)}>📄 Boleta</button></td>
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
