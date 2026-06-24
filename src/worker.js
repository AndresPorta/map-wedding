/**
 * MAP Wedding — Cloudflare Worker
 * Rutas:
 *   GET  /api/guest?code=xxx   → datos del invitado
 *   POST /api/confirm          → body {code} → confirma asistencia
 *   GET  /admin?key=xxx        → panel de confirmaciones (protegido)
 *   *                          → archivos estáticos (index.html, css, js, etc.)
 */

// ── Contraseña del panel admin ──
const ADMIN_KEY  = 'map2026admin';
const SESSION_COOKIE = 'map_admin_session';

// ── CORS headers para las rutas API ──
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ── Router principal ──
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Preflight CORS
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── API: obtener datos del invitado ──
    if (path === '/api/guest' && method === 'GET') {
      const code = url.searchParams.get('code');
      if (!code) return json({ error: 'Código requerido' }, 400);

      const guest = await env.MAP_DB.prepare(
        'SELECT name, tickets, confirmed FROM guests WHERE code = ?'
      ).bind(code.trim().toLowerCase()).first();

      if (!guest) return json({ error: 'Invitado no encontrado' }, 404);
      return json({ ok: true, name: guest.name, tickets: guest.tickets, confirmed: !!guest.confirmed });
    }

    // ── API: confirmar asistencia ──
    if (path === '/api/confirm' && method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'JSON inválido' }, 400); }

      const code = body?.code?.trim()?.toLowerCase();
      if (!code) return json({ error: 'Código requerido' }, 400);

      const guest = await env.MAP_DB.prepare(
        'SELECT id, name, confirmed FROM guests WHERE code = ?'
      ).bind(code).first();

      if (!guest) return json({ error: 'Invitado no encontrado' }, 404);
      if (guest.confirmed) return json({ ok: true, alreadyConfirmed: true, name: guest.name });

      await env.MAP_DB.prepare(
        "UPDATE guests SET confirmed = 1, confirmed_at = datetime('now') WHERE code = ?"
      ).bind(code).run();

      return json({ ok: true, name: guest.name });
    }

    // ── API: cancelar asistencia ──
    if (path === '/api/cancel' && method === 'POST') {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'JSON inválido' }, 400); }

      const code = body?.code?.trim()?.toLowerCase();
      if (!code) return json({ error: 'Código requerido' }, 400);

      const guest = await env.MAP_DB.prepare(
        'SELECT id, name FROM guests WHERE code = ?'
      ).bind(code).first();

      if (!guest) return json({ error: 'Invitado no encontrado' }, 404);

      // Pone confirmed = 0 pero NO toca los boletos
      await env.MAP_DB.prepare(
        "UPDATE guests SET confirmed = 0, confirmed_at = NULL WHERE code = ?"
      ).bind(code).run();

      return json({ ok: true, name: guest.name });
    }

    // ── ADMIN: login POST (recibe clave del formulario, emite cookie) ──
    if (path === '/admin/login' && method === 'POST') {
      const form = await request.formData();
      const key  = form.get('key');
      if (key !== ADMIN_KEY) {
        return new Response(adminLoginHTML('Contraseña incorrecta.'), {
          status: 401,
          headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/admin',
          'Set-Cookie': `${SESSION_COOKIE}=${ADMIN_KEY}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`,
        },
      });
    }

    // ── ADMIN: panel de confirmaciones ──
    if (path === '/admin') {
      // Soporte legacy: ?key=xxx en URL
      const urlKey    = url.searchParams.get('key');
      const cookieStr = request.headers.get('Cookie') || '';
      const cookieKey = cookieStr.split(';').find(c => c.trim().startsWith(SESSION_COOKIE + '='))?.split('=')[1]?.trim();
      const authed    = urlKey === ADMIN_KEY || cookieKey === ADMIN_KEY;

      if (!authed) {
        return new Response(adminLoginHTML(), {
          status: 401,
          headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
      }

      const { results } = await env.MAP_DB.prepare(
        'SELECT code, name, tickets, confirmed, confirmed_at, phone, notes FROM guests ORDER BY confirmed DESC, name ASC'
      ).all();

      const total     = results.length;
      const confirmed = results.filter(g => g.confirmed).length;
      const pending   = total - confirmed;
      const seats     = results.reduce((s, g) => s + g.tickets, 0);
      const seatsConf = results.filter(g => g.confirmed).reduce((s, g) => s + g.tickets, 0);

      return new Response(adminDashboardHTML(results, { total, confirmed, pending, seats, seatsConf }), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    // ── Todo lo demás: archivos estáticos ──
    return env.ASSETS.fetch(request);
  },
};


// ─────────────────────────────────────────────
//  HTML del panel admin
// ─────────────────────────────────────────────
function adminDashboardHTML(guests, stats) {
  const rows = guests.map(g => `
    <tr class="${g.confirmed ? 'confirmed' : 'pending'}">
      <td>${escHtml(g.name)}</td>
      <td class="center">${g.tickets}</td>
      <td class="center">
        <span class="badge ${g.confirmed ? 'badge-yes' : 'badge-no'}">
          ${g.confirmed ? '✓ Confirmó' : '— Pendiente'}
        </span>
      </td>
      <td class="soft">${g.confirmed_at ? g.confirmed_at.replace('T', ' ').substring(0, 16) : '—'}</td>
      <td class="soft">${g.phone ? escHtml(g.phone) : '—'}</td>
      <td class="soft">${g.notes ? escHtml(g.notes) : ''}</td>
      <td class="center">
        <button class="btn btn-copy" onclick="copyLink('${escHtml(g.code)}', this)" title="Copiar link personalizado">
          🔗 Copiar
        </button>
      </td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MAP · Panel de Confirmaciones</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#f5f5f5;color:#222;padding:2rem 1rem}
  h1{font-size:1.5rem;margin-bottom:1.5rem;color:#1a1a1a}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:1rem;margin-bottom:2rem}
  .stat{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.07);text-align:center}
  .stat-num{font-size:2rem;font-weight:700;color:#2563eb}
  .stat-label{font-size:.8rem;color:#666;margin-top:.25rem;text-transform:uppercase;letter-spacing:.08em}
  .stat.green .stat-num{color:#16a34a}
  .stat.orange .stat-num{color:#ea580c}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07)}
  th{background:#1e293b;color:#fff;padding:.75rem 1rem;text-align:left;font-size:.82rem;letter-spacing:.06em;text-transform:uppercase}
  td{padding:.7rem 1rem;border-bottom:1px solid #f0f0f0;font-size:.9rem;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr.confirmed td{background:#f0fdf4}
  .badge{display:inline-block;padding:.25rem .7rem;border-radius:999px;font-size:.78rem;font-weight:600}
  .badge-yes{background:#dcfce7;color:#166534}
  .badge-no{background:#fef3c7;color:#92400e}
  .center{text-align:center}
  .soft{color:#888;font-size:.82rem}
  .export{margin-top:1.5rem;display:flex;gap:1rem;flex-wrap:wrap}
  .btn{padding:.6rem 1.2rem;border-radius:8px;border:none;cursor:pointer;font-size:.88rem;font-weight:600;text-decoration:none;display:inline-block}
  .btn-blue{background:#2563eb;color:#fff}
  .btn-green{background:#16a34a;color:#fff}
  .btn-copy{background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;padding:.4rem .9rem;border-radius:8px;cursor:pointer;font-size:.82rem;transition:background .15s}
  .btn-copy:hover{background:#e2e8f0}
  .btn-copy.copied{background:#dcfce7;color:#166534;border-color:#bbf7d0}
</style>
</head>
<body>
<h1>MAP · Panel de Confirmaciones</h1>
<div class="stats">
  <div class="stat"><div class="stat-num">${stats.total}</div><div class="stat-label">Invitados</div></div>
  <div class="stat green"><div class="stat-num">${stats.confirmed}</div><div class="stat-label">Confirmaron</div></div>
  <div class="stat orange"><div class="stat-num">${stats.pending}</div><div class="stat-label">Pendientes</div></div>
  <div class="stat"><div class="stat-num">${stats.seats}</div><div class="stat-label">Lugares totales</div></div>
  <div class="stat green"><div class="stat-num">${stats.seatsConf}</div><div class="stat-label">Lugares confirmados</div></div>
</div>
<table>
  <thead><tr>
    <th>Nombre</th><th>Boletos</th><th>Estado</th><th>Confirmó el</th><th>Teléfono</th><th>Notas</th><th>Link</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="export">
  <button class="btn btn-green" onclick="exportCSV()">⬇ Exportar CSV</button>
</div>
<script>
function copyLink(code, btn) {
  const url = 'https://map-wedding.com/?code=' + code;
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✓ Copiado';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '🔗 Copiar'; btn.classList.remove('copied'); }, 2000);
  });
}
function exportCSV(){
  const rows=[['Nombre','Boletos','Confirmado','Fecha','Telefono','Notas']];
  document.querySelectorAll('tbody tr').forEach(tr=>{
    const cells=[...tr.querySelectorAll('td')].slice(0,6);
    rows.push(cells.map(td=>'"'+td.innerText.replace(/"/g,'""')+'"'));
  });
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\\n'));
  a.download='confirmaciones.csv'; a.click();
}
</script>
</body></html>`;
}

function adminLoginHTML(error = '') {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Admin · MAP</title>
<style>
  body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5}
  form{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);width:320px;text-align:center}
  h2{margin-bottom:1.5rem;font-size:1.2rem}
  input{width:100%;padding:.7rem 1rem;border:1px solid #ddd;border-radius:8px;font-size:1rem;margin-bottom:1rem}
  button{width:100%;padding:.75rem;background:#1e293b;color:#fff;border:none;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:600}
  .error{color:#dc2626;font-size:.85rem;margin-bottom:.75rem}
</style></head>
<body>
<form method="POST" action="/admin/login">
  <h2>Panel MAP</h2>
  ${error ? `<p class="error">${error}</p>` : ''}
  <input type="password" name="key" placeholder="Contraseña" autofocus/>
  <button>Entrar</button>
</form>
</body></html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
