#!/usr/bin/env node
/**
 * import-guests.js — Importa invitados a Cloudflare D1
 *
 * Uso:
 *   node scripts/import-guests.js                  → importa guests.csv
 *   node scripts/import-guests.js mis-invitados.csv → importa archivo específico
 *
 * Formato del CSV (sin encabezado requerido, pero si lo hay se ignora la 1ª fila):
 *   Nombre Completo, boletos, telefono (opcional), notas (opcional)
 *
 * Ejemplo:
 *   Michelle García, 2, 5512345678, Mesa 1
 *   Andres Porta, 1
 *   Juan Pérez, 3, , VIP
 *
 * Requiere: npx wrangler debe estar instalado
 * Ejecutar desde la raíz del proyecto MAP
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Generador de códigos únicos ──
function generateCode(length = 7) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // sin caracteres confusos
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Leer CSV ──
const csvFile = process.argv[2] || 'guests.csv';
const csvPath = path.resolve(process.cwd(), csvFile);

if (!fs.existsSync(csvPath)) {
  console.error(`\n❌  No se encontró: ${csvPath}`);
  console.log('\nCrea un archivo guests.csv con este formato:');
  console.log('  Nombre, boletos, telefono, notas');
  console.log('  Michelle García, 2, 5512345678, Mesa 1');
  process.exit(1);
}

const lines = fs.readFileSync(csvPath, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('#'));

// Detectar si la primera fila es encabezado
const firstLower = lines[0].toLowerCase();
const hasHeader  = firstLower.includes('nombre') || firstLower.includes('name') || firstLower.includes('boleto');
const dataLines  = hasHeader ? lines.slice(1) : lines;

const guests = dataLines.map(line => {
  const parts = line.split(',').map(p => p.trim());
  return {
    code:    generateCode(),
    name:    parts[0] || '',
    tickets: parseInt(parts[1]) || 1,
    phone:   parts[2] || '',
    notes:   parts[3] || '',
  };
}).filter(g => g.name);

if (!guests.length) {
  console.error('❌  No se encontraron invitados válidos en el CSV.');
  process.exit(1);
}

console.log(`\n📋  ${guests.length} invitados encontrados. Generando SQL...\n`);

// ── Generar SQL de inserción ──
const sqlLines = guests.map(g =>
  `INSERT INTO guests (code, name, tickets, phone, notes) VALUES ('${g.code}', '${g.name.replace(/'/g,"''")}', ${g.tickets}, '${g.phone.replace(/'/g,"''")}', '${g.notes.replace(/'/g,"''")}');`
);

const sqlFile = path.resolve(process.cwd(), 'migrations/import-guests.sql');
fs.writeFileSync(sqlFile, sqlLines.join('\n') + '\n');

console.log(`✅  SQL generado: migrations/import-guests.sql`);
console.log('\n📎  Links de invitación:');
console.log('─'.repeat(60));

const baseUrl = process.env.SITE_URL || 'https://TU_SITIO.pages.dev';
guests.forEach(g => {
  const padding = ' '.repeat(Math.max(0, 28 - g.name.length));
  console.log(`${g.name}${padding} → ${baseUrl}/?code=${g.code}  (${g.tickets} boleto${g.tickets > 1 ? 's' : ''})`);
});

console.log('─'.repeat(60));
console.log('\n▶  Para importar a D1, ejecuta:');
console.log(`   npx wrangler d1 execute map-wedding-db --file=migrations/import-guests.sql --remote\n`);

// ── Guardar CSV con códigos para referencia ──
const outputCsv = guests.map(g =>
  `"${g.name}","${g.code}",${g.tickets},"${baseUrl}/?code=${g.code}","${g.phone}","${g.notes}"`
).join('\n');

const csvOut = path.resolve(process.cwd(), 'guests-with-codes.csv');
fs.writeFileSync(csvOut, `"Nombre","Código","Boletos","Link","Teléfono","Notas"\n${outputCsv}\n`);
console.log(`💾  Códigos guardados en: guests-with-codes.csv`);
console.log('    (Guárdalo bien — contiene todos los links personalizados)\n');
