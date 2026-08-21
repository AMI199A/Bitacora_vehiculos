import { useState, useEffect } from 'react';

const API = 'https://bitacora-vehiculos-6o20.onrender.com';

// ── Editor de movimientos ──────────────────────────────────────
export function MovimientosEditor({ movimientos, onChange, variosAias = false, fechaSalida = '' }) {
  const agregar = () =>
    onChange([...movimientos, { lugar: '', actividad: '', hora_llegada: '', hora_salida_lugar: '', kilometraje: '', fecha_movimiento: '' }]);

  const eliminar = (idx) => onChange(movimientos.filter((_, i) => i !== idx));

  const editar = (idx, campo, valor) =>
    onChange(movimientos.map((m, i) => i === idx ? { ...m, [campo]: valor } : m));

  return (
    <div>
      {movimientos.map((m, idx) => (
        <div key={idx} style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 10,
        }}>
          {/* Encabezado del movimiento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{
              background: 'var(--accent)', color: '#fff', borderRadius: '50%',
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0
            }}>{idx + 1}</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Parada {idx + 1}</span>
            <button type="button" onClick={() => eliminar(idx)}
              className="btn btn-danger btn-sm"
              style={{ marginLeft: 'auto', padding: '2px 8px' }}>✕</button>
          </div>

          <div className="form-grid" style={{ gap: 8 }}>
            {/* Lugar */}
            <div className="form-group full" style={{ marginBottom: 6 }}>
              <label>Lugar *</label>
              <input className="form-control"
                placeholder="Municipio, comunidad o institución"
                value={m.lugar}
                onChange={e => editar(idx, 'lugar', e.target.value)} />
            </div>

            {/* Actividad */}
            <div className="form-group full" style={{ marginBottom: 6 }}>
              <label>Actividad realizada</label>
              <input className="form-control"
                placeholder="Describe la actividad en este lugar"
                value={m.actividad}
                onChange={e => editar(idx, 'actividad', e.target.value)} />
            </div>

            {/* Fecha del movimiento (solo si es varios días) */}
            {variosAias && (
              <div className="form-group" style={{ marginBottom: 6 }}>
                <label>📅 Fecha de este movimiento</label>
                <input type="date" className="form-control"
                  value={m.fecha_movimiento}
                  min={fechaSalida}
                  onChange={e => editar(idx, 'fecha_movimiento', e.target.value)} />
              </div>
            )}

            {/* Kilometraje */}
            <div className="form-group" style={{ marginBottom: 6 }}>
              <label>📏 Odómetro en este lugar</label>
              <input type="number" min="0" className="form-control"
                placeholder="Lectura del odómetro (km)"
                value={m.kilometraje}
                onChange={e => editar(idx, 'kilometraje', e.target.value)} />
            </div>

            {/* Horas */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora de llegada</label>
              <input type="time" className="form-control"
                value={m.hora_llegada}
                onChange={e => editar(idx, 'hora_llegada', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Hora de salida del lugar</label>
              <input type="time" className="form-control"
                value={m.hora_salida_lugar}
                onChange={e => editar(idx, 'hora_salida_lugar', e.target.value)} />
            </div>
          </div>
        </div>
      ))}

      <button type="button" className="btn btn-ghost" onClick={agregar}
        style={{
          width: '100%', border: '1.5px dashed var(--border)',
          borderRadius: 10, padding: '10px', fontSize: 13, marginTop: 4
        }}>
        ＋ Agregar parada / movimiento
      </button>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export default function RegistrarComision({ currentUser }) {
  const [usuarios,  setUsuarios]  = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [ok,        setOk]        = useState(false);
  const [error,     setError]     = useState('');

  const today = new Date().toISOString().split('T')[0];

  const blankMov = { lugar: '', actividad: '', hora_llegada: '', hora_salida_lugar: '', kilometraje: '', fecha_movimiento: '' };

  const blank = {
    usuario_id: currentUser?.id || '',
    vehiculo_id: '', fecha_salida: today,
    varios_dias: false, fecha_entrada: '',
    hora_salida: '', hora_entrada: '',
    descripcion_comision: '', acompanantes: '',
    con_nombramiento: false, no_nombramiento: '',
    seccion: '',
    kilometraje_salida: '', kilometraje_ingreso: '',
    movimientos: [{ ...blankMov }],
  };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/usuarios`).then(r=>r.json()),
      fetch(`${API}/api/vehiculos`).then(r=>r.json()),
    ]).then(([u,v]) => {
      if (u.success) setUsuarios(u.data);
      if (v.success) setVehiculos(v.data);
    });
  }, []);

  const handleVehiculo = async (e) => {
    const vid = e.target.value;
    setForm(p => ({ ...p, vehiculo_id: vid, kilometraje_salida: '', descripcion_comision: '' }));
    if (!vid) return;
    try {
      const res  = await fetch(`${API}/api/comisiones/ultima/${vid}`);
      const data = await res.json();
      if (data.success && data.data) {
        setForm(p => ({
          ...p,
          vehiculo_id: vid,
          kilometraje_salida: data.data.kilometraje_ingreso ?? '',
          descripcion_comision: data.data.descripcion_comision ?? '',
        }));
      }
    } catch {/* sin última comisión */}
  };

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(p => ({ ...p, [name]: type==='checkbox' ? checked : value }));
  };

  const totalEstimado = form.kilometraje_salida && form.kilometraje_ingreso
    ? Number(form.kilometraje_ingreso) - Number(form.kilometraje_salida) : null;

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true); setOk(false);

    const movsValidos = form.movimientos.filter(m => m.lugar.trim());
    if (movsValidos.length === 0) {
      setError('Debes agregar al menos una parada con lugar.');
      setLoading(false);
      return;
    }
    if (form.varios_dias && !form.fecha_entrada) {
      setError('Indica la fecha de entrada/regreso para comisiones de varios días.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        usuario_id:           form.usuario_id,
        vehiculo_id:          form.vehiculo_id,
        fecha_salida:         form.fecha_salida,
        fecha_entrada:        form.varios_dias ? (form.fecha_entrada || null) : null,
        descripcion_comision: form.descripcion_comision,
        lugares:              movsValidos.map(m => m.lugar).join(' → '),
        acompanantes:         form.acompanantes || null,
        con_nombramiento:     form.con_nombramiento,
        no_nombramiento:      form.con_nombramiento ? form.no_nombramiento : null,
        seccion:              form.seccion,
        kilometraje_salida:   form.kilometraje_salida  ? Number(form.kilometraje_salida)  : null,
        kilometraje_ingreso:  form.kilometraje_ingreso ? Number(form.kilometraje_ingreso) : null,
        hora_salida:          form.hora_salida,
        hora_entrada:         form.hora_entrada || null,
        movimientos:          movsValidos,
      };
      const res  = await fetch(`${API}/api/comisiones`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setOk(true);
      setForm(p => ({ ...blank, usuario_id: p.usuario_id, fecha_salida: p.fecha_salida }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <p className="text-sm text-muted" style={{ marginTop: 3 }}>Todos los campos marcados con * son obligatorios</p>
          </div>
        </div>
        <div className="card-body">
          {ok && (
            <div style={{
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
              color: '#22c55e', padding: '12px 16px', borderRadius: 8, marginBottom: 18, fontSize: 13
            }}>
              ✅ Registro guardado exitosamente. Puedes ingresar otro.
            </div>
          )}
          {error && <div className="error-msg" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

          <form onSubmit={submit}>
            {/* SECCIÓN 1: Conductor y vehículo */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
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
                <select name="vehiculo_id" className="form-control" value={form.vehiculo_id} onChange={handleVehiculo} required>
                  <option value="">— Seleccionar —</option>
                  {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} — {v.placa}</option>)}
                </select>
              </div>
            </div>

            {/* SECCIÓN 2: Fecha y horas */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Fecha y horario
            </p>

            {/* Toggle varios días */}
            <div style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
              <label className="form-check">
                <input type="checkbox" name="varios_dias" checked={form.varios_dias} onChange={handle} />
                <span style={{ fontWeight: 600 }}>📅 Comisión de varios días</span>
              </label>
              {form.varios_dias && (
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '4px 0 0 28px' }}>
                  Indica el rango completo de fechas. Podrás asignar fecha específica a cada parada.
                </p>
              )}
            </div>

            <div className="form-grid cols-3 mb-4">
              <div className="form-group">
                <label>{form.varios_dias ? 'Fecha de salida *' : 'Fecha *'}</label>
                <input name="fecha_salida" type="date" className="form-control"
                  value={form.fecha_salida} onChange={handle} required />
              </div>
              {form.varios_dias && (
                <div className="form-group">
                  <label>Fecha de entrada / regreso *</label>
                  <input name="fecha_entrada" type="date" className="form-control"
                    value={form.fecha_entrada} onChange={handle}
                    min={form.fecha_salida} required={form.varios_dias} />
                </div>
              )}
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

            {/* SECCIÓN 3: Descripción */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Descripción de la comisión
            </p>
            <div className="form-grid mb-4">
              <div className="form-group full">
                <label>
                  Descripción / actividad a realizar *
                  {form.vehiculo_id && (
                    <span style={{ fontSize: 10, color: 'var(--accent-2)', marginLeft: 8, fontWeight: 400 }}>
                      💡 Autocompletado — puedes modificarlo
                    </span>
                  )}
                </label>
                <input name="descripcion_comision" className="form-control"
                  placeholder="Describe el motivo o actividad de la comisión"
                  value={form.descripcion_comision} onChange={handle} required />
              </div>
              <div className="form-group full">
                <label>Acompañantes</label>
                <input name="acompanantes" className="form-control"
                  placeholder="Nombres de personas que acompañan"
                  value={form.acompanantes} onChange={handle} />
              </div>
            </div>

            {/* SECCIÓN 4: Movimientos */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              📍 Paradas / Movimientos *
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
              Registra cada lugar visitado con su odómetro{form.varios_dias ? ', fecha' : ''} y horarios. Se usarán para el Reporte de Kilometraje.
            </p>
            <div className="mb-4">
              <MovimientosEditor
                movimientos={form.movimientos}
                onChange={movs => setForm(p => ({ ...p, movimientos: movs }))}
                variosAias={form.varios_dias}
                fechaSalida={form.fecha_salida}
              />
            </div>

            {/* SECCIÓN 5: Nombramiento */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Nombramiento
            </p>
            <div style={{ background: 'var(--bg-panel)', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
              <label className="form-check" style={{ marginBottom: 10 }}>
                <input type="checkbox" name="con_nombramiento"
                  checked={form.con_nombramiento} onChange={handle} />
                <span>✅ Con nombramiento (marcar si aplica)</span>
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
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                  ✗ Sin nombramiento
                </p>
              )}
            </div>

            {/* SECCIÓN 6: Sección */}
            <div className="form-grid mb-4">
              <div className="form-group full">
                <label>Sección *</label>
                <input name="seccion" className="form-control"
                  placeholder="Ej. Fiscalización"
                  value={form.seccion} onChange={handle} required />
              </div>
            </div>

            {/* SECCIÓN 7: Kilometraje */}
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Kilometraje general
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
              Kilometraje total de salida e ingreso del vehículo (inicio y fin del recorrido completo).
            </p>
            <div className="form-grid mb-4">
              <div className="form-group">
                <label>
                  Km de salida *
                  {form.kilometraje_salida && (
                    <span style={{ fontSize: 10, color: 'var(--accent-2)', marginLeft: 8, fontWeight: 400 }}>
                      🔄 Desde última comisión
                    </span>
                  )}
                </label>
                <input name="kilometraje_salida" type="number" min="0" className="form-control"
                  placeholder="Km al momento de salir"
                  value={form.kilometraje_salida} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Km de ingreso</label>
                <input name="kilometraje_ingreso" type="number" min="0" className="form-control"
                  placeholder="Km al momento de regresar"
                  value={form.kilometraje_ingreso} onChange={handle} />
              </div>
            </div>

            {/* Total automático */}
            <div style={{
              padding: '14px 18px', marginBottom: 20,
              background: totalEstimado !== null ? 'rgba(99,102,241,0.1)' : 'var(--bg-panel)',
              border: `1px solid ${totalEstimado !== null ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12
            }}>
              <span style={{ fontSize: 22 }}>📏</span>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Total de kilómetros recorridos (automático)</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-2)', margin: 0 }}>
                  {totalEstimado !== null ? `${totalEstimado} km` : '— km'}
                </p>
              </div>
            </div>

            <hr className="divider" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setForm(blank)}>
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
