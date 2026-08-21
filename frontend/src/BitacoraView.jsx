import { useState, useEffect } from 'react';
import { MovimientosEditor } from './RegistrarComision';

const API = 'https://bitacora-vehiculos-6o20.onrender.com';

const getMonday = (d) => { const dt = new Date(d); const day = dt.getDay(); const diff = dt.getDate() - day + (day===0?-6:1); return new Date(dt.setDate(diff)); };
const addDays   = (d,n) => { const r = new Date(d); r.setDate(r.getDate()+n); return r; };
const fmtDate   = (d) => d.toISOString().split('T')[0];
const fmtDisp   = (d) => new Date(d+'T12:00:00').toLocaleDateString('es-GT',{weekday:'short',month:'short',day:'numeric'});
const dayName   = (d) => new Date(d+'T12:00:00').toLocaleDateString('es-GT',{weekday:'long',day:'numeric',month:'long'});
const fmtHora   = (v) => { if (!v) return '—'; if (typeof v==='string') return v.substring(0,5); if (v instanceof Date) return v.toISOString().substring(11,16); return String(v).substring(0,5); };
const toDateStr = (v) => { if (!v) return ''; if (typeof v==='string') return v.split('T')[0]; if (v instanceof Date) return v.toISOString().split('T')[0]; return String(v).split('T')[0]; };
const toTimeStr = (v) => { if (!v) return ''; if (typeof v==='string') return v.substring(0,5); if (v instanceof Date) return v.toISOString().substring(11,16); return String(v).substring(0,5); };

// ══════════════════════════════════════════════════════════
//  MODAL DE EDICIÓN
// ══════════════════════════════════════════════════════════
function EditModal({ item, usuarios, vehiculos, onClose, onSaved }) {
  const fechaEntradaOrig = toDateStr(item.fecha_entrada);

  const [form, setForm] = useState({
    usuario_id:           item.usuario_id   || '',
    vehiculo_id:          item.vehiculo_id  || '',
    fecha_salida:         toDateStr(item.fecha_salida),
    varios_dias:          !!item.fecha_entrada,
    fecha_entrada:        fechaEntradaOrig,
    hora_salida:          toTimeStr(item.hora_salida),
    hora_entrada:         toTimeStr(item.hora_entrada),
    descripcion_comision: item.descripcion_comision || '',
    acompanantes:         item.acompanantes || '',
    con_nombramiento:     item.con_nombramiento || false,
    no_nombramiento:      item.no_nombramiento  || '',
    seccion:              item.seccion      || '',
    kilometraje_salida:   item.kilometraje_salida  ?? '',
    kilometraje_ingreso:  item.kilometraje_ingreso ?? '',
    movimientos: item.movimientos?.length
      ? item.movimientos.map(m => ({
          lugar:             m.lugar || '',
          actividad:         m.actividad || '',
          hora_llegada:      toTimeStr(m.hora_llegada),
          hora_salida_lugar: toTimeStr(m.hora_salida_lugar),
          kilometraje:       m.kilometraje ?? '',
          fecha_movimiento:  toDateStr(m.fecha_movimiento),
        }))
      : [{ lugar: item.lugares || '', actividad: '', hora_llegada: '', hora_salida_lugar: '', kilometraje: '', fecha_movimiento: '' }],
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type==='checkbox' ? checked : value }));
  };

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setErr('');
    const movsValidos = form.movimientos.filter(m => m.lugar.trim());
    if (movsValidos.length === 0) { setErr('Debes agregar al menos una parada con lugar.'); setSaving(false); return; }
    try {
      const payload = {
        ...form,
        fecha_entrada:       form.varios_dias ? (form.fecha_entrada || null) : null,
        lugares:             movsValidos.map(m => m.lugar).join(' → '),
        kilometraje_salida:  form.kilometraje_salida  ? Number(form.kilometraje_salida)  : null,
        kilometraje_ingreso: form.kilometraje_ingreso ? Number(form.kilometraje_ingreso) : null,
        movimientos:         movsValidos,
      };
      const res  = await fetch(`${API}/api/comisiones/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
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
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        border: '1px solid var(--border)'
      }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>✏️ Editar boleta</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={save} style={{ padding: 24 }}>
          {err && <div className="error-msg" style={{ marginBottom: 16 }}>⚠️ {err}</div>}

          {/* Conductor y vehículo */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Conductor y vehículo</p>
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
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Fecha y horario</p>
          <div style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
            <label className="form-check">
              <input type="checkbox" name="varios_dias" checked={form.varios_dias} onChange={handle} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>📅 Comisión de varios días</span>
            </label>
          </div>
          <div className="form-grid cols-3 mb-4">
            <div className="form-group">
              <label>{form.varios_dias ? 'Fecha salida *' : 'Fecha *'}</label>
              <input name="fecha_salida" type="date" className="form-control" value={form.fecha_salida} onChange={handle} required />
            </div>
            {form.varios_dias && (
              <div className="form-group">
                <label>Fecha entrada *</label>
                <input name="fecha_entrada" type="date" className="form-control"
                  value={form.fecha_entrada} onChange={handle} min={form.fecha_salida} required={form.varios_dias} />
              </div>
            )}
            <div className="form-group">
              <label>Hora salida *</label>
              <input name="hora_salida" type="time" className="form-control" value={form.hora_salida} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Hora entrada</label>
              <input name="hora_entrada" type="time" className="form-control" value={form.hora_entrada} onChange={handle} />
            </div>
          </div>

          {/* Comisión */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Comisión</p>
          <div className="form-grid mb-4">
            <div className="form-group full">
              <label>Descripción *</label>
              <input name="descripcion_comision" className="form-control" value={form.descripcion_comision} onChange={handle} required />
            </div>
            <div className="form-group full">
              <label>Acompañantes</label>
              <input name="acompanantes" className="form-control" value={form.acompanantes} onChange={handle} />
            </div>
          </div>

          {/* Movimientos */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>📍 Paradas / Movimientos *</p>
          <div className="mb-4">
            <MovimientosEditor
              movimientos={form.movimientos}
              onChange={movs => setForm(p => ({ ...p, movimientos: movs }))}
              variosAias={form.varios_dias}
              fechaSalida={form.fecha_salida}
            />
          </div>

          {/* Nombramiento */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Nombramiento</p>
          <div style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
            <label className="form-check" style={{ marginBottom: 8 }}>
              <input type="checkbox" name="con_nombramiento" checked={form.con_nombramiento} onChange={handle} />
              <span>✅ Con nombramiento</span>
            </label>
            {form.con_nombramiento && (
              <div className="form-group">
                <label>No. de nombramiento *</label>
                <input name="no_nombramiento" className="form-control" value={form.no_nombramiento} onChange={handle} required={form.con_nombramiento} />
              </div>
            )}
            {!form.con_nombramiento && (
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>✗ Sin nombramiento</p>
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
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Kilometraje</p>
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
            <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, marginBottom: 16 }}>
              📏 <strong>Total estimado:</strong> {total} km
            </div>
          )}

          <hr className="divider" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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

// ══════════════════════════════════════════════════════════
//  TAB: REPORTE EXCEL DE KILOMETRAJE
// ══════════════════════════════════════════════════════════
function ReporteTab() {
  const today = new Date().toISOString().split('T')[0];
  const [fi,  setFi]  = useState(today);
  const [ff,  setFf]  = useState(today);
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error,   setError]   = useState('');

  // Firma 1 (Elaborado por)
  const [eNombre, setENombre] = useState('');
  const [eCargo,  setECargo]  = useState('');
  // Vo.Bo. 1
  const [v1Nombre, setV1Nombre] = useState('');
  const [v1Cargo,  setV1Cargo]  = useState('');
  // Encargada
  const [encNombre, setEncNombre] = useState('');
  const [encCargo,  setEncCargo]  = useState('');
  // Vo.Bo. 2
  const [v2Nombre, setV2Nombre] = useState('');
  const [v2Cargo,  setV2Cargo]  = useState('');

  const buildUrl = () => {
    const p = new URLSearchParams({
      fecha_inicio: fi, fecha_fin: ff,
      observaciones: obs,
      elaborado_nombre: eNombre, elaborado_cargo: eCargo,
      vobo1_nombre: v1Nombre, vobo1_cargo: v1Cargo,
      encargada_nombre: encNombre, encargada_cargo: encCargo,
      vobo2_nombre: v2Nombre, vobo2_cargo: v2Cargo,
    });
    return `${API}/api/reportes/kilometraje-excel?${p.toString()}`;
  };

  // Vista previa de datos
  const verPreview = async () => {
    setLoading(true); setError(''); setPreview(null);
    try {
      const res  = await fetch(`${API}/api/comisiones/semanal?fecha_inicio=${fi}&fecha_fin=${ff}`);
      const data = await res.json();
      if (data.success) setPreview(data.data);
      else throw new Error(data.message);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const descargar = () => {
    window.open(buildUrl(), '_blank');
  };

  const fmtFechaLegible = (v) => {
    if (!v) return '';
    const s = typeof v === 'string' ? v.split('T')[0] : v instanceof Date ? v.toISOString().split('T')[0] : String(v);
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  };

  // Calcular resumen del preview
  const totalKmPreview = preview?.reduce((s, c) => s + (Number(c.total_kilometros) || 0), 0) || 0;

  return (
    <div style={{ padding: 20 }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3>📊 Reporte de Kilometraje — ANEXO 5</h3>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            Selecciona el rango de fechas y genera el reporte en formato Excel exactamente como el ANEXO 5 de INGECOP.
          </p>

          {/* Rango de fechas */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Rango de fechas *
          </p>
          <div className="form-grid mb-4">
            <div className="form-group">
              <label>Fecha inicio</label>
              <input type="date" className="form-control" value={fi} onChange={e => setFi(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Fecha fin</label>
              <input type="date" className="form-control" value={ff} onChange={e => setFf(e.target.value)} min={fi} />
            </div>
          </div>

          {/* Observaciones */}
          <div className="form-group mb-4">
            <label>Observaciones (campo del reporte)</label>
            <input className="form-control" placeholder="Texto de observaciones para el reporte"
              value={obs} onChange={e => setObs(e.target.value)} />
          </div>

          {/* Firmas */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Firmas del reporte (opcional)
          </p>
          <div style={{ background: 'var(--bg-panel)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Elaborado por — Nombre</label>
                <input className="form-control" placeholder="Nombre completo"
                  value={eNombre} onChange={e => setENombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Elaborado por — Cargo</label>
                <input className="form-control" placeholder="Cargo / puesto"
                  value={eCargo} onChange={e => setECargo(e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Vo.Bo. 1 — Nombre</label>
                <input className="form-control" placeholder="Nombre completo"
                  value={v1Nombre} onChange={e => setV1Nombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Vo.Bo. 1 — Cargo</label>
                <input className="form-control" placeholder="Cargo / puesto"
                  value={v1Cargo} onChange={e => setV1Cargo(e.target.value)} />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Encargada — Nombre</label>
                <input className="form-control" placeholder="Nombre completo"
                  value={encNombre} onChange={e => setEncNombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Encargada — Cargo</label>
                <input className="form-control" placeholder="Cargo / puesto"
                  value={encCargo} onChange={e => setEncCargo(e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Vo.Bo. 2 — Nombre</label>
                <input className="form-control" placeholder="Nombre completo"
                  value={v2Nombre} onChange={e => setV2Nombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: 11 }}>Vo.Bo. 2 — Cargo</label>
                <input className="form-control" placeholder="Cargo / puesto"
                  value={v2Cargo} onChange={e => setV2Cargo(e.target.value)} />
              </div>
            </div>
          </div>

          {error && <div className="error-msg" style={{ marginBottom: 12 }}>⚠️ {error}</div>}

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={verPreview} disabled={loading}>
              {loading ? '⏳ Cargando...' : '👁 Vista previa de datos'}
            </button>
            <button className="btn btn-primary" onClick={descargar}
              style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
              📥 Descargar Excel (ANEXO 5)
            </button>
          </div>
        </div>
      </div>

      {/* Vista previa */}
      {preview !== null && (
        <div className="card">
          <div className="card-header">
            <span style={{ fontWeight: 600 }}>
              Vista previa — {preview.length} comisión{preview.length !== 1 ? 'es' : ''} del {fmtFechaLegible(fi)} al {fmtFechaLegible(ff)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--accent-2)', fontWeight: 700 }}>
              Total: {totalKmPreview.toFixed(0)} km
            </span>
          </div>
          {preview.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
              No hay comisiones en el rango seleccionado.
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Conductor</th>
                    <th>Vehículo</th>
                    <th>Paradas (movimientos)</th>
                    <th>KM Salida</th>
                    <th>KM Ingreso</th>
                    <th>Total KM</th>
                    <th>Nombramiento</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(item => {
                    const fS = toDateStr(item.fecha_salida);
                    const fE = item.fecha_entrada ? toDateStr(item.fecha_entrada) : null;
                    const fechaStr = fE && fE !== fS ? `${fmtFechaLegible(fS)} → ${fmtFechaLegible(fE)}` : fmtFechaLegible(fS);
                    const movs = item.movimientos || [];
                    return (
                      <tr key={item.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fechaStr}</td>
                        <td>{item.nombre} {item.apellido}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.marca}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.placa}</div>
                        </td>
                        <td style={{ maxWidth: 200, fontSize: 12 }}>
                          {movs.length > 0
                            ? movs.map((m, i) => (
                                <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <span style={{
                                    background: 'var(--accent)', color: '#fff', borderRadius: '50%',
                                    width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 8, fontWeight: 700, flexShrink: 0
                                  }}>{i + 1}</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.lugar}
                                    {m.kilometraje ? <span style={{ color: 'var(--accent-2)', marginLeft: 4, fontSize: 10 }}>({m.kilometraje} km)</span> : ''}
                                  </span>
                                </div>
                              ))
                            : <span style={{ color: 'var(--text-3)' }}>{item.lugares}</span>
                          }
                        </td>
                        <td>{item.kilometraje_salida ?? '—'}</td>
                        <td>{item.kilometraje_ingreso ?? '—'}</td>
                        <td><strong>{item.total_kilometros ?? '—'}</strong> km</td>
                        <td>
                          {item.con_nombramiento
                            ? <span className="badge badge-done" style={{ fontSize: 10 }}>✅ {item.no_nombramiento || 'Sí'}</span>
                            : <span className="badge badge-pending" style={{ fontSize: 10 }}>Sin nom.</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function BitacoraView({ userRol, userId }) {
  const [comisiones, setComisiones] = useState([]);
  const [monday, setMonday]         = useState(getMonday(new Date()));
  const [loading, setLoading]       = useState(false);
  const [anioCierre, setAnioCierre] = useState(String(new Date().getFullYear()));
  const [vista, setVista]           = useState('semana');
  const [diaSeleccionado, setDia]   = useState(null);
  const [expandMovs, setExpandMovs] = useState({});

  const [editItem,  setEditItem]  = useState(null);
  const [usuarios,  setUsuarios]  = useState([]);
  const [vehiculos, setVehiculos] = useState([]);

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

  useEffect(() => {
    if (userRol !== 'admin' && userRol !== 'analista' && userRol !== 'conductor') return;
    Promise.all([
      fetch(`${API}/api/usuarios`).then(r=>r.json()),
      fetch(`${API}/api/vehiculos`).then(r=>r.json()),
    ]).then(([u,v]) => {
      if (u.success) setUsuarios(u.data);
      if (v.success) setVehiculos(v.data);
    });
  }, [userRol]);

  const prevWeek = () => setMonday(p => addDays(p, -7));
  const nextWeek = () => setMonday(p => addDays(p, 7));

  // Agrupar por día (comisiones de varios días aparecen en cada día de su rango)
  const porDia = {};
  comisiones.forEach(c => {
    const fS = toDateStr(c.fecha_salida);
    const fE = c.fecha_entrada ? toDateStr(c.fecha_entrada) : fS;
    for (let i = 0; i < 5; i++) {
      const dia = fmtDate(addDays(monday, i));
      if (dia >= fS && dia <= fE) {
        if (!porDia[dia]) porDia[dia] = [];
        if (!porDia[dia].find(x => x.id === c.id)) porDia[dia].push(c);
      }
    }
  });

  const diasSemana = Array.from({ length: 5 }, (_, i) => fmtDate(addDays(monday, i)));

  const descargarPDF = async (id) => {
    window.open(`${API}/api/comisiones/${id}/pdf`, '_blank');
    setComisiones(prev => prev.map(c => c.id === id ? { ...c, estado: 'DESCARGADO' } : c));
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
    } catch (err) { alert('Error al eliminar: ' + err.message); }
  };

  const cierreAnual = async () => {
    if (!window.confirm(`¿Confirmar cierre anual ${anioCierre}?\nSe exportará CSV y se eliminarán los registros de ese año.`)) return;
    const r = await fetch(`${API}/api/admin/cierre-anual`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anio: Number(anioCierre) })
    });
    if (r.ok) {
      const blob = await r.blob();
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `Respaldo_Bitacora_${anioCierre}.csv`
      });
      a.click(); cargar(); alert('Cierre anual completado ✅');
    } else {
      const d = await r.json(); alert('Error: ' + d.message);
    }
  };

  const pendientes  = comisiones.filter(c => c.estado !== 'DESCARGADO').length;
  const descargados = comisiones.filter(c => c.estado === 'DESCARGADO').length;
  const totalKm     = comisiones.reduce((s, c) => s + (Number(c.total_kilometros) || 0), 0).toFixed(0);

  const isAdminOrAnalista = userRol === 'admin' || userRol === 'analista';

  const puedeModificar = (item) => {
    if (userRol === 'admin' || userRol === 'analista') return true;
    if (userRol === 'conductor') return item.usuario_id === userId;
    return false;
  };

  const AccionesBoleta = ({ item }) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <button className="btn btn-success btn-sm" title="Descargar PDF" onClick={() => descargarPDF(item.id)}>📄</button>
      {puedeModificar(item) && (
        <>
          <button className="btn btn-primary btn-sm" title="Editar boleta" onClick={() => setEditItem(item)}>✏️</button>
          <button className="btn btn-danger btn-sm" title="Eliminar boleta" onClick={() => eliminarComision(item.id)}>🗑️</button>
        </>
      )}
    </div>
  );

  const FechaBadge = ({ item }) => {
    const fS = toDateStr(item.fecha_salida);
    const fE = item.fecha_entrada ? toDateStr(item.fecha_entrada) : null;
    if (fE && fE !== fS) {
      return (
        <div>
          <div style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fS}</div>
          <div style={{ fontSize: 10, color: 'var(--accent-2)', whiteSpace: 'nowrap' }}>→ {fE} 📅</div>
        </div>
      );
    }
    return <span style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fS}</span>;
  };

  return (
    <div>
      {/* Modal edición */}
      {editItem && (
        <EditModal
          item={editItem} usuarios={usuarios} vehiculos={vehiculos}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); cargar(); }}
        />
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card"><span className="stat-label">Total semana</span><span className="stat-value accent">{comisiones.length}</span></div>
        <div className="stat-card"><span className="stat-label">Pendientes</span><span className="stat-value warning">{pendientes}</span></div>
        <div className="stat-card"><span className="stat-label">Descargados</span><span className="stat-value success">{descargados}</span></div>
        <div className="stat-card"><span className="stat-label">Km totales semana</span><span className="stat-value accent">{totalKm}</span></div>
      </div>

      <div className="card">
        {/* Header */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="week-nav">
            <button className="btn btn-ghost btn-sm" onClick={prevWeek}>← Anterior</button>
            <span style={{ fontWeight: 600 }}>Semana: {fmtDisp(fi)} — {fmtDisp(ff)}</span>
            <button className="btn btn-ghost btn-sm" onClick={nextWeek}>Siguiente →</button>
            <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>↺</button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdminOrAnalista && (
              <>
                <button className="btn btn-success btn-sm" onClick={descargaPDFSemana}>📄 PDF semana</button>
                {userRol === 'admin' && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" value={anioCierre} onChange={e => setAnioCierre(e.target.value)}
                      className="form-control" style={{ width: 75 }} />
                    <button className="btn btn-danger btn-sm" onClick={cierreAnual}>📤 Cierre anual</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {[
            ['semana',  '📅 Vista semanal'],
            ['dia',     '📆 Detalle por día'],
            ['reporte', '📊 Reporte Excel'],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setVista(k)}
              className={`btn btn-sm ${vista === k ? 'btn-primary' : 'btn-ghost'}`}>{l}</button>
          ))}
        </div>

        {/* ── Vista: semana completa ────────────────────────── */}
        {vista === 'semana' && (
          <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th><th>Conductor</th><th>Vehículo</th>
                  <th>Descripción / Paradas</th><th>KM Sal.</th><th>KM Ing.</th>
                  <th>Total</th><th>Nom.</th><th>Estado</th>
                  {isAdminOrAnalista && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr className="empty-row"><td colSpan={10}>⏳ Cargando...</td></tr>
                ) : comisiones.length === 0 ? (
                  <tr className="empty-row"><td colSpan={10}>No hay registros para esta semana</td></tr>
                ) : comisiones.map(item => {
                  const esVerde = item.estado === 'DESCARGADO';
                  const movs    = item.movimientos || [];
                  return (
                    <tr key={item.id}>
                      <td><FechaBadge item={item} /></td>
                      <td>{item.nombre} {item.apellido}</td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{item.marca}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.placa}</div>
                      </td>
                      <td style={{ maxWidth: 180 }}>
                        <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={item.descripcion_comision}>{item.descripcion_comision}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {movs.length > 0 ? movs.map(m => m.lugar).join(' → ') : item.lugares}
                        </div>
                      </td>
                      <td>{item.kilometraje_salida}</td>
                      <td>{item.kilometraje_ingreso ?? '—'}</td>
                      <td><strong>{item.total_kilometros ?? '—'}</strong> km</td>
                      <td>
                        {item.con_nombramiento
                          ? <span className="badge badge-done" style={{ fontSize: 9 }}>✅ Nom.</span>
                          : <span className="badge" style={{ fontSize: 9, opacity: 0.5 }}>Sin</span>
                        }
                      </td>
                      <td><span className={`badge ${esVerde ? 'badge-done' : 'badge-pending'}`}>{esVerde ? '✅ OK' : '🔴 Pend.'}</span></td>
                      {isAdminOrAnalista && <td><AccionesBoleta item={item} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Vista: detalle por día ────────────────────────── */}
        {vista === 'dia' && (
          <div style={{ padding: 20 }}>
            {diasSemana.map(fecha => {
              const registros = porDia[fecha] || [];
              const expanded  = diaSeleccionado === fecha;
              return (
                <div key={fecha} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onClick={() => setDia(expanded ? null : fecha)}>
                    <span style={{ fontSize: 18 }}>{expanded ? '▼' : '▶'}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{dayName(fecha)}</span>
                      <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-3)' }}>
                        {registros.length} registro{registros.length !== 1 ? 's' : ''}
                      </span>
                      {registros.length > 0 && (
                        <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--accent-2)' }}>
                          {registros.reduce((s, c) => s + (Number(c.total_kilometros) || 0), 0).toFixed(0)} km totales
                        </span>
                      )}
                    </div>
                    {registros.length > 0 && isAdminOrAnalista && (
                      <button className="btn btn-success btn-sm"
                        onClick={e => { e.stopPropagation(); descargaPDFDia(fecha); }}>
                        📄 PDF del día
                      </button>
                    )}
                    {registros.length === 0 && <span className="badge badge-conductor">Sin registros</span>}
                  </div>

                  {expanded && registros.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {registros.map(item => {
                        const esVerde  = item.estado === 'DESCARGADO';
                        const movs     = item.movimientos || [];
                        const movsOpen = !!expandMovs[item.id];
                        return (
                          <div key={item.id} style={{ borderBottom: '1px solid var(--border)', padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
                              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{item.nombre} {item.apellido}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.marca} · {item.placa}</div>
                                <div style={{ fontSize: 12, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.descripcion_comision}
                                </div>
                                {item.con_nombramiento && (
                                  <div style={{ fontSize: 11, color: 'var(--accent-2)', marginTop: 3 }}>
                                    📄 Nom. {item.no_nombramiento}
                                  </div>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
                                <div>🕐 {fmtHora(item.hora_salida)} → {fmtHora(item.hora_entrada)}</div>
                                <div>📏 {item.kilometraje_salida} / {item.kilometraje_ingreso ?? '—'} km</div>
                                <div style={{ fontWeight: 700, color: 'var(--accent-2)' }}>
                                  Total: {item.total_kilometros ?? '—'} km
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                                <span className={`badge ${esVerde ? 'badge-done' : 'badge-pending'}`}>
                                  {esVerde ? '✅ OK' : '🔴 Pendiente'}
                                </span>
                                {item.fecha_entrada && toDateStr(item.fecha_entrada) !== toDateStr(item.fecha_salida) && (
                                  <span style={{ fontSize: 10, color: 'var(--accent-2)', fontWeight: 600 }}>📅 Varios días</span>
                                )}
                                {isAdminOrAnalista && <AccionesBoleta item={item} />}
                              </div>
                            </div>

                            {/* Movimientos expandibles */}
                            {movs.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <button type="button" className="btn btn-ghost btn-sm"
                                  onClick={() => setExpandMovs(p => ({ ...p, [item.id]: !p[item.id] }))}
                                  style={{ fontSize: 11, padding: '3px 10px' }}>
                                  {movsOpen ? '▲' : '▶'} {movs.length} parada{movs.length !== 1 ? 's' : ''} — ver detalle
                                </button>
                                {movsOpen && (
                                  <div style={{ marginTop: 8, paddingLeft: 8, borderLeft: '2px solid var(--accent)' }}>
                                    {movs.map((m, i) => (
                                      <div key={i} style={{
                                        marginBottom: 6, paddingBottom: 6,
                                        borderBottom: i < movs.length - 1 ? '1px dashed var(--border)' : 'none'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{
                                            background: 'var(--accent)', color: '#fff', borderRadius: '50%',
                                            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 9, fontWeight: 700, flexShrink: 0
                                          }}>{i + 1}</span>
                                          <strong style={{ fontSize: 12 }}>{m.lugar}</strong>
                                          {m.kilometraje && (
                                            <span style={{ fontSize: 11, color: 'var(--accent-2)', fontWeight: 600 }}>
                                              📏 {m.kilometraje} km
                                            </span>
                                          )}
                                          {(m.hora_llegada || m.hora_salida_lugar) && (
                                            <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                                              {m.hora_llegada ? fmtHora(m.hora_llegada) : '—'} → {m.hora_salida_lugar ? fmtHora(m.hora_salida_lugar) : '—'}
                                            </span>
                                          )}
                                        </div>
                                        {m.actividad && (
                                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 22, marginTop: 2 }}>{m.actividad}</div>
                                        )}
                                        {m.fecha_movimiento && (
                                          <div style={{ fontSize: 10, color: 'var(--accent-2)', marginLeft: 22, marginTop: 1 }}>
                                            📅 {toDateStr(m.fecha_movimiento)}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Vista: Reporte Excel ─────────────────────────── */}
        {vista === 'reporte' && <ReporteTab />}
      </div>
    </div>
  );
}
