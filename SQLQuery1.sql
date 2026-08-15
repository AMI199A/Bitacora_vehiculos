-- 1. Extensión para UUIDs
-- En SQL Server no se necesitan extensiones para UUIDs. Se usa la función nativa NEWID() y el tipo de dato UNIQUEIDENTIFIER.

-- 2. Enumeraciones de Rol y Estado
-- SQL Server no soporta el tipo ENUM. En su lugar, se utilizan restricciones CHECK directamente en la definición de la tabla.

-- 3. Tabla de Usuarios
CREATE TABLE usuarios (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    password_hash VARCHAR(MAX) NOT NULL, -- TEXT está depreciado en SQL Server, se usa VARCHAR(MAX)
    rol VARCHAR(20) DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario', 'analista')),
    codigo_aceptacion VARCHAR(50) UNIQUE,
    primer_ingreso BIT DEFAULT 1, -- BOOLEAN se reemplaza por BIT (1 = TRUE, 0 = FALSE)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Vehículos (Guarda el último kilometraje conocido)
CREATE TABLE vehiculos (
    id INT IDENTITY(1,1) PRIMARY KEY, -- SERIAL se reemplaza por IDENTITY(1,1)
    placa VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50) NOT NULL,
    ultimo_kilometraje NUMERIC(10, 2) DEFAULT 0.00
);

-- 5. Tabla Principal de Bitácoras
CREATE TABLE bitacora_comisiones (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    usuario_id UNIQUEIDENTIFIER REFERENCES usuarios(id) ON DELETE SET NULL,
    vehiculo_id INT REFERENCES vehiculos(id) ON DELETE CASCADE,
    fecha_salida DATE NOT NULL,
    descripcion_comision VARCHAR(MAX) NOT NULL,
    lugares VARCHAR(MAX) NOT NULL,
    acompanantes VARCHAR(MAX),
    con_nombramiento BIT DEFAULT 0,
    no_nombramiento VARCHAR(50),
    departamento VARCHAR(100),
    seccion VARCHAR(100),
    kilometraje_salida NUMERIC(10, 2) NOT NULL,
    kilometraje_ingreso NUMERIC(10, 2),
    hora_salida TIME NOT NULL,
    hora_entrada TIME,
    
    -- Columna calculada (Computed Column)
    total_kilometros AS (
        CASE 
            WHEN kilometraje_ingreso IS NOT NULL THEN kilometraje_ingreso - kilometraje_salida 
            ELSE 0 
        END
    ) PERSISTED, -- 'STORED' en Postgres equivale a 'PERSISTED' en SQL Server
    
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'DESCARGADO')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);