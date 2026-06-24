/**
 * MAP Wedding — Cloudflare Worker
 */

const ADMIN_KEY      = 'map2026admin';
const SESSION_COOKIE = 'map_admin_session';

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

function isAdminAuthed(request, url) {
  const urlKey    = url.searchParams.get('key');
  const cookieStr = request.headers.get('Cookie') || '';
  const cookieKey = cookieStr.split(';')
    .find(c => c.trim().startsWith(SESSION_COOKIE + '='))
    ?.split('=')[1]?.trim();
  return urlKey === ADMIN_KEY || cookieKey === ADMIN_KEY;
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── GET /api/guest ──
    if (path === '/api/guest' && method === 'GET') {
      const code = url.searchParams.get('code');
      if (!code) return json({ error: 'Código requerido' }, 400);

      const guest = await env.MAP_DB.prepare(
        'SELECT name, tickets, confirmed, confirmed_at FROM guests WHERE code = ?'
      ).bind(code.trim().toLowerCase()).first();

      if (!guest) return json({ error: 'Invitado no encontrado' }, 404);
      const cancelled = !guest.confirmed && !!guest.confirmed_at;
      return json({ ok: true, name: guest.name, tickets: guest.tickets, confirmed: !!guest.confirmed, cancelled });
    }

    // ── POST /api/confirm ──
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

    // ── POST /api/cancel ──
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

      // confirmed=0 + confirmed_at presente = canceló (≠ "nunca respondió")
      await env.MAP_DB.prepare(
        "UPDATE guests SET confirmed = 0, confirmed_at = datetime('now') WHERE code = ?"
      ).bind(code).run();

      return json({ ok: true, name: guest.name });
    }

    // ── POST /admin/login ──
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

    // ── POST /admin/reset  → desbloquear invitado cancelado ──
    if (path === '/admin/reset' && method === 'POST') {
      if (!isAdminAuthed(request, url)) return json({ error: 'No autorizado' }, 401);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'JSON inválido' }, 400); }

      const code = body?.code?.trim()?.toLowerCase();
      if (!code) return json({ error: 'Código requerido' }, 400);

      await env.MAP_DB.prepare(
        'UPDATE guests SET confirmed = 0, confirmed_at = NULL WHERE code = ?'
      ).bind(code).run();

      return json({ ok: true });
    }

    // ── POST /admin/guests/add  → agregar nuevo invitado ──
    if (path === '/admin/guests/add' && method === 'POST') {
      if (!isAdminAuthed(request, url)) return json({ error: 'No autorizado' }, 401);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'JSON inválido' }, 400); }

      const name    = body?.name?.trim();
      const tickets = parseInt(body?.tickets) || 1;
      const phone   = body?.phone?.trim() || null;
      const notes   = body?.notes?.trim() || null;
      const code    = body?.code?.trim()?.toLowerCase();

      if (!name || !code) return json({ error: 'Nombre y código son requeridos' }, 400);

      // Verificar que el código no exista
      const existing = await env.MAP_DB.prepare(
        'SELECT id FROM guests WHERE code = ?'
      ).bind(code).first();
      if (existing) return json({ error: 'El código ya existe' }, 409);

      await env.MAP_DB.prepare(
        'INSERT INTO guests (name, code, tickets, phone, notes, confirmed) VALUES (?, ?, ?, ?, ?, 0)'
      ).bind(name, code, tickets, phone, notes).run();

      return json({ ok: true, code });
    }

    // ── GET /admin ──
    if (path === '/admin') {
      if (!isAdminAuthed(request, url)) {
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
      const cancelled = results.filter(g => !g.confirmed && g.confirmed_at).length;
      const pending   = total - confirmed - cancelled;
      const seats     = results.reduce((s, g) => s + g.tickets, 0);
      const seatsConf = results.filter(g => g.confirmed).reduce((s, g) => s + g.tickets, 0);

      return new Response(adminDashboardHTML(results, { total, confirmed, cancelled, pending, seats, seatsConf }), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};


// ─────────────────────────────────────────────
//  HTML del panel admin
// ─────────────────────────────────────────────
function adminDashboardHTML(guests, stats) {
  const rows = guests.map(g => {
    const isCancelled = !g.confirmed && !!g.confirmed_at;
    const badgeClass  = g.confirmed ? 'badge-yes' : isCancelled ? 'badge-cancel' : 'badge-no';
    const badgeText   = g.confirmed ? '✓ Confirmó' : isCancelled ? '✕ Canceló' : '— Pendiente';
    const rowClass    = g.confirmed ? 'confirmed' : isCancelled ? 'cancelled' : 'pending';

    const resetBtn = isCancelled ? `
      <button class="btn-action btn-reset" onclick="resetGuest('${escHtml(g.code)}', this)" title="Volver a pendiente">
        🔓 Desbloquear
      </button>` : '';

    return `
    <tr class="${rowClass}" data-code="${escHtml(g.code)}">
      <td>${escHtml(g.name)}</td>
      <td class="center">${g.tickets}</td>
      <td class="center">
        <span class="badge ${badgeClass}">${badgeText}</span>
      </td>
      <td class="soft">${g.confirmed_at ? g.confirmed_at.replace('T',' ').substring(0,16) : '—'}</td>
      <td class="soft">${g.phone ? escHtml(g.phone) : '—'}</td>
      <td class="soft">${g.notes ? escHtml(g.notes) : ''}</td>
      <td class="center actions-cell">
        <button class="btn-action btn-copy" onclick="copyLink('${escHtml(g.code)}', this)">🔗 Copiar</button>
        ${resetBtn}
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MAP · Panel de Confirmaciones</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;background:#f5f5f5;color:#222;padding:2rem 1rem}
  h1{font-size:1.5rem;margin-bottom:.5rem;color:#1a1a1a}
  .header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:.75rem}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin-bottom:2rem}
  .stat{background:#fff;border-radius:12px;padding:1.2rem;box-shadow:0 2px 8px rgba(0,0,0,.07);text-align:center}
  .stat-num{font-size:2rem;font-weight:700;color:#2563eb}
  .stat-label{font-size:.78rem;color:#666;margin-top:.25rem;text-transform:uppercase;letter-spacing:.08em}
  .stat.green .stat-num{color:#16a34a}
  .stat.orange .stat-num{color:#ea580c}
  .stat.red .stat-num{color:#dc2626}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07)}
  th{background:#1e293b;color:#fff;padding:.75rem 1rem;text-align:left;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase}
  td{padding:.65rem 1rem;border-bottom:1px solid #f0f0f0;font-size:.88rem;vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr.confirmed td{background:#f0fdf4}
  tr.cancelled td{background:#fff5f5}
  .badge{display:inline-block;padding:.22rem .65rem;border-radius:999px;font-size:.76rem;font-weight:600}
  .badge-yes{background:#dcfce7;color:#166534}
  .badge-no{background:#fef3c7;color:#92400e}
  .badge-cancel{background:#fee2e2;color:#991b1b}
  .center{text-align:center}
  .soft{color:#888;font-size:.81rem}
  .actions-cell{display:flex;gap:.4rem;justify-content:center;align-items:center;flex-wrap:wrap}
  .btn-action{padding:.35rem .8rem;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;font-size:.79rem;font-weight:500;background:#f8fafc;color:#334155;transition:all .15s;white-space:nowrap}
  .btn-action:hover{background:#e2e8f0}
  .btn-action.copied{background:#dcfce7;color:#166534;border-color:#bbf7d0}
  .btn-reset{border-color:#fecaca;color:#b91c1c;background:#fff5f5}
  .btn-reset:hover{background:#fee2e2}
  .btn-reset.done{background:#dcfce7;color:#166534;border-color:#bbf7d0}
  .bottom-row{margin-top:1.5rem;display:flex;gap:1rem;flex-wrap:wrap}
  .btn{padding:.65rem 1.4rem;border-radius:8px;border:none;cursor:pointer;font-size:.9rem;font-weight:600}
  .btn-green{background:#16a34a;color:#fff}
  .btn-primary{background:#1e293b;color:#fff}

  /* Modal */
  .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1000;align-items:center;justify-content:center}
  .modal-overlay.open{display:flex}
  .modal{background:#fff;border-radius:16px;padding:2rem;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.2)}
  .modal h2{font-size:1.15rem;margin-bottom:1.25rem;color:#1a1a1a}
  .field{margin-bottom:1rem}
  .field label{display:block;font-size:.8rem;font-weight:600;color:#555;margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.06em}
  .field input,.field select,.field textarea{width:100%;padding:.65rem .9rem;border:1px solid #ddd;border-radius:8px;font-size:.95rem;font-family:inherit}
  .field input:focus,.field select:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
  .modal-actions{display:flex;gap:.75rem;margin-top:1.5rem;justify-content:flex-end}
  .btn-cancel-modal{background:#f1f5f9;color:#334155;padding:.65rem 1.2rem;border-radius:8px;border:none;cursor:pointer;font-size:.9rem;font-weight:600}
  .msg-success{background:#dcfce7;color:#166534;padding:.75rem 1rem;border-radius:8px;font-size:.88rem;margin-top:.75rem;display:none}
  .msg-error{background:#fee2e2;color:#991b1b;padding:.75rem 1rem;border-radius:8px;font-size:.88rem;margin-top:.75rem;display:none}
</style>
</head>
<body>
<div class="header-row">
  <h1>MAP · Panel de Confirmaciones</h1>
  <button class="btn btn-primary" onclick="openModal()">＋ Agregar invitado</button>
</div>

<div class="stats">
  <div class="stat"><div class="stat-num">${stats.total}</div><div class="stat-label">Invitados</div></div>
  <div class="stat green"><div class="stat-num">${stats.confirmed}</div><div class="stat-label">Confirmaron</div></div>
  <div class="stat orange"><div class="stat-num">${stats.pending}</div><div class="stat-label">Pendientes</div></div>
  <div class="stat red"><div class="stat-num">${stats.cancelled}</div><div class="stat-label">Cancelaron</div></div>
  <div class="stat"><div class="stat-num">${stats.seats}</div><div class="stat-label">Lugares totales</div></div>
  <div class="stat green"><div class="stat-num">${stats.seatsConf}</div><div class="stat-label">Confirmados</div></div>
</div>

<table>
  <thead><tr>
    <th>Nombre</th><th>Boletos</th><th>Estado</th><th>Fecha</th><th>Teléfono</th><th>Notas</th><th>Acciones</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="bottom-row">
  <button class="btn btn-green" onclick="exportCSV()">⬇ Exportar CSV</button>
</div>

<!-- Modal: agregar invitado -->
<div class="modal-overlay" id="modal-overlay" onclick="closeModalOutside(event)">
  <div class="modal">
    <h2>Agregar invitado</h2>
    <div class="field">
      <label>Nombre completo *</label>
      <input type="text" id="f-name" placeholder="Ej: Ana López"/>
    </div>
    <div class="field">
      <label>Boletos *</label>
      <input type="number" id="f-tickets" value="1" min="1" max="20" style="max-width:120px"/>
    </div>
    <div class="field">
      <label>Teléfono</label>
      <input type="text" id="f-phone" placeholder="+52 55 1234 5678"/>
    </div>
    <div class="field">
      <label>Notas</label>
      <input type="text" id="f-notes" placeholder="Ej: Mesa 3, vegetariano…"/>
    </div>
    <div class="msg-success" id="modal-success">¡Invitado agregado! Recargando…</div>
    <div class="msg-error" id="modal-error"></div>
    <div class="modal-actions">
      <button class="btn-cancel-modal" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="submitGuest()">Guardar</button>
    </div>
  </div>
</div>

<script>
// ── Copy link ──
function copyLink(code, btn) {
  const url = 'https://map-wedding.com/?code=' + code;
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = '✓ Copiado';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '🔗 Copiar'; btn.classList.remove('copied'); }, 2000);
  });
}

// ── Desbloquear invitado cancelado ──
function resetGuest(code, btn) {
  if (!confirm('¿Volver a poner a este invitado como Pendiente?')) return;
  fetch('/admin/reset', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ code })
  })
  .then(r => r.json())
  .then(d => {
    if (!d.ok) { alert('Error al desbloquear'); return; }
    const row = btn.closest('tr');
    row.className = 'pending';
    row.querySelector('.badge').className = 'badge badge-no';
    row.querySelector('.badge').textContent = '— Pendiente';
    btn.textContent = '✓ Desbloqueado';
    btn.classList.add('done');
    btn.disabled = true;
  })
  .catch(() => alert('Error de red'));
}

// ── Modal ──
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('f-name').focus();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  ['f-name','f-phone','f-notes'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('f-tickets').value = 1;
  document.getElementById('modal-success').style.display = 'none';
  document.getElementById('modal-error').style.display = 'none';
}
function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}

function randomCode() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => chars[b % chars.length]).join('');
}

function submitGuest() {
  const name    = document.getElementById('f-name').value.trim();
  const tickets = parseInt(document.getElementById('f-tickets').value) || 1;
  const code    = randomCode();
  const phone   = document.getElementById('f-phone').value.trim() || null;
  const notes   = document.getElementById('f-notes').value.trim() || null;
  const errEl   = document.getElementById('modal-error');
  const okEl    = document.getElementById('modal-success');

  errEl.style.display = 'none';
  if (!name) { errEl.textContent = 'El nombre es obligatorio.'; errEl.style.display = 'block'; return; }

  fetch('/admin/guests/add', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ name, tickets, code, phone, notes })
  })
  .then(r => r.json())
  .then(d => {
    if (!d.ok) { errEl.textContent = d.error || 'Error al guardar.'; errEl.style.display = 'block'; return; }
    okEl.style.display = 'block';
    setTimeout(() => location.reload(), 1200);
  })
  .catch(() => { errEl.textContent = 'Error de red.'; errEl.style.display = 'block'; });
}

// ── Export CSV ──
function exportCSV() {
  const rows = [['Nombre','Boletos','Estado','Fecha','Telefono','Notas']];
  document.querySelectorAll('tbody tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('td')].slice(0,6);
    rows.push(cells.map(td => '"' + td.innerText.replace(/"/g,'""') + '"'));
  });
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map(r => r.join(',')).join('\\n'));
  a.download = 'confirmaciones.csv'; a.click();
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
