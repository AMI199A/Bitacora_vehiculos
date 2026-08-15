import { useState, useEffect } from 'react';

export default function RegistrarComision({ currentUser }) {
  const [usuarios,  setUsuarios]  = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [ok,        setOk]        = useState(false);
  const [error,     setError]     = useState('');

  const today = new Date().toISOString().split('T')[0];

  const blank = {
    usuario_id: currentUser?.id || '',
    vehiculo_id: '', fecha_salida: today,
    hora_salida: '', hora_entrada: '',
    descripcion_comision: '', lugares: '', acompanantes: '',
    con_nombramiento: false, no_nombramiento: '',
    departamento: '', seccion: '',
    kilometraje_salida: '', kilometraje_ingreso: '',
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    Promise.all([
      fetch('/api/usuarios').then(r=>r.json()),
      fetch('/api/vehiculos').then(r=>r.json()),
    ]).then(([u,v]) => {
      if (u.success) setUsuarios(u.data);
      if (v.success) setVehiculos(v.data);
    });
  }, []);

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type==='checkbox' ? checked : value }));
  };

  const totalEstimado = form.kilometraje_salida && form.kilometraje_ingreso
    ? Number(form.kilometraje_ingreso) - Number(form.kilometraje_salida) : null;

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true); setOk(false);
    try {
      const payload = {
        ...form,
        kilometraje_salida:  form.kilometraje_salida  ? Number(form.kilometraje_salida)  : null,
        kilometraje_ingreso: form.kilometraje_ingreso ? Number(form.kilometraje_ingreso) : null,
      };
      const res  = await fetch('/api/comisiones', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setOk(true);
      setForm(p => ({ ...blank, usuario_id: p.usuario_id, fecha_salida: p.fecha_salida }));
      window.scrollTo({top:0,behavior:'smooth'});
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally { setLoading(false); }
  };

  const isAdmin = currentUser?.rol === 'admin';

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h3>📋 Nueva comisión / Salida de vehículo</h3>
            <p className="text-sm text-muted" style={{marginTop:3}}>Todos los campos marcados con * son obligatorios</p>
          </div>
        </div>
        <div className="card-body">
          {ok && (
            <div style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',
              color:'#22c55e',padding:'12px 16px',borderRadius:8,marginBottom:18,fontSize:13}}>
              ✅ Registro guardado exitosamente. Puedes ingresar otro.
            </div>
          )}
          {error && <div className="error-msg" style={{marginBottom:16}}>⚠️ {error}</div>}

          <form onSubmit={submit}>
            {/* SECCIÓN 1: Conductor y vehículo */}
            <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
              Datos del conductor y vehículo
            </p>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label>Conductor responsable *</label>
                <select name="usuario_id" className="form-control" value={form.usuario_id} onChange={handle} required
                  disabled={!isAdmin && currentUser?.id}>
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

            {/* SECCIÓN 2: Fecha y horas */}
            <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
              Fecha y horario
            </p>
            <div className="form-grid cols-3 mb-4">
              <div className="form-group">
                <label>Fecha de salida *</label>
                <input name="fecha_salida" type="date" className="form-control"
                  value={form.fecha_salida} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Hora de salida *</label>
                <input name="hora_salida" type="time" className="form-control"
                  value={form.hora_salida} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Hora de entrada</label>
                <input name="hora_entrada" type="time" className="form-control"
                  value={form.hora_entrada} onChange={handle} />
              </div>
            </div>

            {/* SECCIÓN 3: Comisión */}
            <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
              Descripción de la comisión
            </p>
            <div className="form-grid mb-4">
              <div className="form-group full">
                <label>Descripción de la comisión / actividad a realizar *</label>
                <input name="descripcion_comision" className="form-control"
                  placeholder="Describe el motivo o actividad de la comisión"
                  value={form.descripcion_comision} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Lugares a visitar *</label>
                <input name="lugares" className="form-control"
                  placeholder="Municipios, comunidades o instituciones"
                  value={form.lugares} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Acompañantes</label>
                <input name="acompanantes" className="form-control"
                  placeholder="Nombres de personas que acompañan"
                  value={form.acompanantes} onChange={handle} />
              </div>
            </div>

            {/* SECCIÓN 4: Observaciones / Nombramiento */}
            <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
              Observaciones
            </p>
            <div style={{background:'var(--bg-panel)',borderRadius:8,padding:'14px 16px',marginBottom:16}}>
              <label className="form-check" style={{marginBottom:10}}>
                <input type="checkbox" name="con_nombramiento"
                  checked={form.con_nombramiento} onChange={handle} />
                <span>Con nombramiento (marcar si aplica)</span>
              </label>
              {form.con_nombramiento && (
                <div className="form-group">
                  <label>No. de nombramiento *</label>
                  <input name="no_nombramiento" className="form-control"
                    placeholder="Número del documento de nombramiento"
                    value={form.no_nombramiento} onChange={handle}
                    required={form.con_nombramiento} />
                </div>
              )}
              {!form.con_nombramiento && (
                <p style={{fontSize:12,color:'var(--text-3)',margin:0}}>
                  ✗ Sin nombramiento — no se registrará número de documento
                </p>
              )}
            </div>

            {/* SECCIÓN 5: Departamento / Sección */}
            <div className="form-grid mb-4">
              <div className="form-group">
                <label>Departamento *</label>
                <input name="departamento" className="form-control"
                  placeholder="Ej. Operaciones"
                  value={form.departamento} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Sección *</label>
                <input name="seccion" className="form-control"
                  placeholder="Ej. Fiscalización"
                  value={form.seccion} onChange={handle} required />
              </div>
            </div>

            {/* SECCIÓN 6: Kilometraje */}
            <p style={{fontSize:11,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>
              Kilometraje
            </p>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label>Kilometraje de salida *</label>
                <input name="kilometraje_salida" type="number" min="0" className="form-control"
                  placeholder="Km al momento de salir"
                  value={form.kilometraje_salida} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Kilometraje de ingreso</label>
                <input name="kilometraje_ingreso" type="number" min="0" className="form-control"
                  placeholder="Km al momento de regresar"
                  value={form.kilometraje_ingreso} onChange={handle} />
              </div>
            </div>

            {/* Total automático */}
            <div style={{
              padding:'14px 18px', marginBottom:20,
              background: totalEstimado !== null ? 'rgba(99,102,241,0.1)' : 'var(--bg-panel)',
              border: `1px solid ${totalEstimado !== null ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
              borderRadius:10, display:'flex', alignItems:'center', gap:12
            }}>
              <span style={{fontSize:22}}>📏</span>
              <div>
                <p style={{fontSize:11,color:'var(--text-3)',margin:0}}>Total de kilómetros recorridos (automático)</p>
                <p style={{fontSize:22,fontWeight:700,color:'var(--accent-2)',margin:0}}>
                  {totalEstimado !== null ? `${totalEstimado} km` : '— km'}
                </p>
              </div>
            </div>

            <hr className="divider" />
            <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
              <button type="button" className="btn btn-ghost" onClick={()=>setForm(blank)}>
                🗑 Limpiar
              </button>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? '⏳ Guardando...' : '💾 Guardar registro'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
