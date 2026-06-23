-- Tabla de invitados para la invitación personalizada
-- Ejecutar: npx wrangler d1 execute MAP_DB --file=migrations/0001_create_guests.sql

CREATE TABLE IF NOT EXISTS guests (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  code         TEXT    UNIQUE NOT NULL,        -- código único del invitado (ej: xK9mP2)
  name         TEXT    NOT NULL,               -- nombre del invitado
  tickets      INTEGER NOT NULL DEFAULT 1,     -- número de boletos/lugares
  confirmed    INTEGER NOT NULL DEFAULT 0,     -- 0 = pendiente, 1 = confirmó
  confirmed_at TEXT,                           -- fecha/hora de confirmación
  phone        TEXT,                           -- teléfono opcional
  notes        TEXT,                           -- notas internas
  created_at   TEXT    DEFAULT (datetime('now'))
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_guests_code ON guests(code);
CREATE INDEX IF NOT EXISTS idx_guests_confirmed ON guests(confirmed);
