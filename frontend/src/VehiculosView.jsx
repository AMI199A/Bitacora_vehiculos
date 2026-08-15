import { useState, useEffect } from 'react';

export default function VehiculosView() {
  const [vehiculos,  setVehiculos]  = useState([]);
  const [showModal,  setShowModal]  = useState(false);
  const [form,  setForm]    = useState({ placa:'', marca:'', ultimo_kilometraje:'' });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const cargar = () =>
    fetch('/api/vehiculos').then(r => r.json()).then(d => { if (d.success) setVehiculos(d.data); });

  useEffect(() => { cargar(); }, []);

  const handle = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const crear = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/vehiculos', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...form, ultimo_kilometraje: Number(form.ultimo_kilometraje) || 0 })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setShowModal(false);
      setForm({ placa:'', marca:'', ultimo_kilometraje:'' });
      cargar();
    } catch(err){ setError(err.message); }
    finally { setLoading(false); }
  };

  const eliminar = async (id, placa) => {
    if (!window.confirm(`¿Eliminar el vehículo ${placa}?`)) return;
    await fetch(`/api/vehiculos/${id}`, { method:'DELETE' });
    cargar();
  };

  return (
    <div>
      <div className="flex items-center mb-4">
        <div>
          <p className="section-title">Gestión de Vehículos</p>
          <p className="section-sub">{vehiculos.length} vehículo{vehiculos.length !== 1 ? 's' : ''} registrado{vehiculos.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary ml-auto" onClick={() => setShowModal(true)}>
          + Nuevo vehículo
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Placa</th>
              <th>Marca / Modelo</th>
              <th>Último Kilometraje</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehiculos.length === 0 ? (
              <tr className="empty-row"><td colSpan={5}>No hay vehículos registrados</td></tr>
            ) : vehiculos.map((v, i) => (
              <tr key={v.id}>
                <td className="text-muted">{i + 1}</td>
                <td>
                  <span style={{ fontFamily:'monospace', background:'rgba(99,102,241,0.1)', padding:'3px 8px', borderRadius:6, fontSize:13, color:'var(--accent-2)' }}>
                    {v.placa}
                  </span>
                </td>
                <td>
                  <strong>{v.marca}</strong>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span>📍</span>
                    <span>{Number(v.ultimo_kilometraje).toLocaleString('es-GT')} km</span>
                  </div>
                </td>
                <td>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => eliminar(v.id, v.placa)}>
                    🗑 Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nuevo vehículo</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={crear}>
              <div className="modal-body">
                {error && <p className="error-msg">{error}</p>}
                <div className="form-group">
                  <label>Placa *</label>
                  <input name="placa" className="form-control" value={form.placa}
                    onChange={handle} required autoFocus
                    placeholder="Ej. P-123ABC" />
                </div>
                <div className="form-group">
                  <label>Marca / Modelo *</label>
                  <input name="marca" className="form-control" value={form.marca}
                    onChange={handle} required
                    placeholder="Ej. Toyota Hilux 2022" />
                </div>
                <div className="form-group">
                  <label>Kilometraje actual</label>
                  <input name="ultimo_kilometraje" type="number" className="form-control"
                    value={form.ultimo_kilometraje} onChange={handle}
                    placeholder="0" min="0" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Guardando...' : 'Registrar vehículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
