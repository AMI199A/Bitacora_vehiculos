-- 1. Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabla de Usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario', 'analista', 'conductor')),
    codigo_aceptacion VARCHAR(50) UNIQUE,
    primer_ingreso BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Vehículos
CREATE TABLE vehiculos (
    id SERIAL PRIMARY KEY,
    placa VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50) NOT NULL,
    ultimo_kilometraje NUMERIC(10, 2) DEFAULT 0.00
);

-- 4. Tabla Principal de Bitácoras
CREATE TABLE bitacora_comisiones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    vehiculo_id INT REFERENCES vehiculos(id) ON DELETE CASCADE,
    fecha_salida DATE NOT NULL,
    descripcion_comision TEXT NOT NULL,
    lugares TEXT NOT NULL,
    acompanantes TEXT,
    con_nombramiento BOOLEAN DEFAULT FALSE,
    no_nombramiento VARCHAR(50),
    departamento VARCHAR(100),
    seccion VARCHAR(100),
    kilometraje_salida NUMERIC(10, 2) NOT NULL,
    kilometraje_ingreso NUMERIC(10, 2),
    hora_salida TIME NOT NULL,
    hora_entrada TIME,
    
    -- Columna calculada en PostgreSQL (GENERATED ALWAYS AS)
    total_kilometros NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN kilometraje_ingreso IS NOT NULL THEN kilometraje_ingreso - kilometraje_salida 
            ELSE 0 
        END
    ) STORED,
    
    fecha_entrada DATE,                          -- NULL = comisión de un solo día
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'DESCARGADO')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabla de Movimientos por Comisión
CREATE TABLE comision_movimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comision_id UUID NOT NULL REFERENCES bitacora_comisiones(id) ON DELETE CASCADE,
    orden INT NOT NULL DEFAULT 1,
    lugar TEXT NOT NULL,
    actividad TEXT,
    hora_llegada TIME,
    hora_salida_lugar TIME,
    kilometraje NUMERIC(10, 2),        -- Odómetro en este lugar
    fecha_movimiento DATE,              -- Fecha específica (para comisiones de varios días)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── MIGRACIÓN (ejecutar en BD existente) ────────────────────────
-- ALTER TABLE bitacora_comisiones ADD COLUMN IF NOT EXISTS fecha_entrada DATE;
-- CREATE TABLE IF NOT EXISTS comision_movimientos (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     comision_id UUID NOT NULL REFERENCES bitacora_comisiones(id) ON DELETE CASCADE,
--     orden INT NOT NULL DEFAULT 1,
--     lugar TEXT NOT NULL,
--     actividad TEXT,
--     hora_llegada TIME,
--     hora_salida_lugar TIME,
--     kilometraje NUMERIC(10, 2),
--     fecha_movimiento DATE,
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
-- -- Para BD existente con tabla ya creada:
-- ALTER TABLE comision_movimientos ADD COLUMN IF NOT EXISTS kilometraje NUMERIC(10,2);
-- ALTER TABLE comision_movimientos ADD COLUMN IF NOT EXISTS fecha_movimiento DATE;
