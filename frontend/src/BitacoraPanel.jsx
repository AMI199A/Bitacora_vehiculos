import React, { useState, useEffect } from 'react';

export const BitacoraPanel = () => {
    const [comisiones, setComisiones] = useState([]);
    const [anioCierre, setAnioCierre] = useState('2026');

    const cargarSemana = async () => {
        const res = await fetch('https://bitacora-vehiculos-6o20.onrender.com/api/comisiones/semanal?fecha_inicio=2026-08-10&fecha_fin=2026-08-14');
        const data = await res.json();
        if (data.success) setComisiones(data.data);
    };

    useEffect(() => {
        cargarSemana();
    }, []);

    const descargarPDF = (id) => {
        window.open(`https://bitacora-vehiculos-6o20.onrender.com/api/comisiones/${id}/pdf`, '_blank');
        // Cambiar inmediatamente a verde en la vista local
        setComisiones(prev =>
            prev.map(c => c.id === id ? { ...c, estado: 'DESCARGADO' } : c)
        );
    };

    const ejecutarCierreAnual = async () => {
        if (!window.confirm(`¿Confirmas realizar el cierre anual del año ${anioCierre}? Se descargará el respaldo y se limpiará la base de datos.`)) return;

        const response = await fetch('https://bitacora-vehiculos-6o20.onrender.com/api/admin/cierre-anual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anio: anioCierre })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Respaldo_Bitacora_${anioCierre}.csv`;
            a.click();
            cargarSemana();
            alert('Cierre anual completado exitosamente.');
        } else {
            alert('Error al procesar el cierre anual.');
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2>Control de Bitácora de Vehículos</h2>

            {/* Sección de Cierre Anual */}
            <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#eef2f5', borderRadius: '5px' }}>
                <strong>Cierre Anual: </strong>
                <input
                    type="number"
                    value={anioCierre}
                    onChange={(e) => setAnioCierre(e.target.value)}
                    style={{ width: '80px', padding: '4px', marginRight: '10px' }}
                />
                <button onClick={ejecutarCierreAnual} style={{ padding: '6px 12px', backgroundColor: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Exportar Excel y Limpiar BD
                </button>
            </div>

            {/* Tabla Principal */}
            <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th>Fecha</th>
                        <th>Conductor</th>
                        <th>Vehículo</th>
                        <th>Km Salida / Entrada</th>
                        <th>Total Km</th>
                        <th>Estado</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {comisiones.map((item) => {
                        const esVerde = item.estado === 'DESCARGADO';
                        return (
                            <tr key={item.id}>
                                <td>{item.fecha_salida}</td>
                                <td>{item.nombre} {item.apellido}</td>
                                <td>{item.marca} ({item.placa})</td>
                                <td>{item.kilometraje_salida} / {item.kilometraje_ingreso || 'Pendiente'}</td>
                                <td>{item.total_kilometros} km</td>
                                <td style={{ textAlign: 'center' }}>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        backgroundColor: esVerde ? '#16a34a' : '#dc2626' // VERDE o ROJO
                                    }}>
                                        {esVerde ? 'DESCARGADO' : 'PENDIENTE'}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <button onClick={() => descargarPDF(item.id)} style={{ padding: '5px 10px', cursor: 'pointer' }}>
                                        Descargar PDF
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};