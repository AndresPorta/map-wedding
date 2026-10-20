// HTML del panel de confirmaciones MAP. El panel no trae datos incrustados:
// los pide a /admin/guests y los pinta con textContent (sin innerHTML con datos).
// Ojo: el script del panel vive dentro de un template literal, así que ahí los "\n"
// se escriben "\\n" y no se usan backticks ni ${…}.

const STYLES = `
  :root{
    --bg:#fdfaf6;--card:#ffffff;--card-2:#f7f1e8;--line:rgba(31,31,31,.1);
    --text:#1f1f1f;--soft:#6b6b6b;--gold:#c9a96e;--gold-dark:#b28f55;
    --ok:#15803d;--ok-bg:#dcfce7;--wait:#a16207;--wait-bg:#fef3c7;--no:#b91c1c;--no-bg:#fee2e2;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{background:var(--bg)}
  body{font-family:Lato,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding:1.5rem 1rem 4rem}
  .wrap{max-width:960px;margin:0 auto}
  h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:600;font-size:2rem;line-height:1.1}
  h1 small{display:block;font-family:Lato,sans-serif;font-size:.72rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-dark);margin-bottom:.35rem}
  button,input,select,textarea{font:inherit;color:inherit}
  .btn{display:inline-flex;align-items:center;gap:.4rem;padding:.6rem 1.1rem;border-radius:999px;border:1px solid var(--line);background:var(--card-2);color:var(--text);text-decoration:none;cursor:pointer;font-size:.86rem;font-weight:700;white-space:nowrap}
  .btn:hover{border-color:var(--gold)}
  .btn-gold{background:#1f1f1f;color:#fdfaf6;border-color:#1f1f1f}
  .btn-gold:hover{background:var(--gold-dark);border-color:var(--gold-dark)}
  .btn-sm{padding:.4rem .8rem;font-size:.78rem}
  .btn-danger{color:var(--no)}
  .btn.done{background:var(--ok-bg);color:var(--ok);border-color:#bbf7d0}
  .top{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
  .top-actions{display:flex;gap:.5rem;flex-wrap:wrap}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:.6rem;margin-bottom:1.5rem}
  .stat{background:var(--card);border:1px solid var(--line);box-shadow:0 2px 10px rgba(31,31,31,.04);border-radius:14px;padding:.8rem .5rem;text-align:center}
  .stat b{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-variant-numeric:lining-nums;font-size:2rem;line-height:1.1}
  .stat span{font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:var(--soft)}
  .stat.ok b{color:var(--ok)}.stat.wait b{color:var(--wait)}.stat.no b{color:var(--no)}
  .toolbar{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
  .toolbar input{flex:1 1 220px;min-width:0;padding:.65rem 1rem;border-radius:999px;border:1px solid var(--line);background:var(--card)}
  .chip{padding:.5rem .9rem;border-radius:999px;border:1px solid var(--line);background:transparent;cursor:pointer;font-size:.8rem;color:var(--soft)}
  .chip.active{background:#1f1f1f;color:#fdfaf6;border-color:#1f1f1f}
  .list{list-style:none;display:flex;flex-direction:column;gap:.6rem}
  .guest{background:var(--card);box-shadow:0 2px 10px rgba(31,31,31,.04);border:1px solid var(--line);border-left:4px solid var(--wait);border-radius:14px;padding:.9rem 1rem;display:grid;grid-template-columns:1fr auto;gap:.6rem 1rem;align-items:center}
  .guest[data-status=confirmed]{border-left-color:var(--ok)}
  .guest[data-status=cancelled]{border-left-color:var(--no);opacity:.85}
  .g-name{font-weight:700;font-size:1rem}
  .g-meta{color:var(--soft);font-size:.8rem;margin-top:.15rem}
  .g-status{padding:.4rem .7rem;border-radius:999px;border:1px solid var(--line);font-size:.8rem;font-weight:700;cursor:pointer}
  .g-status.pending{background:var(--wait-bg);color:var(--wait)}
  .g-status.confirmed{background:var(--ok-bg);color:var(--ok)}
  .g-status.cancelled{background:var(--no-bg);color:var(--no)}
  .g-status option{background:#fff;color:#1f1f1f}
  .g-actions{grid-column:1/-1;display:flex;gap:.4rem;flex-wrap:wrap}
  .empty{color:var(--soft);text-align:center;padding:2rem 0}
  dialog{margin:auto;border:1px solid var(--line);border-radius:18px;background:var(--card);color:var(--text);padding:1.5rem;width:min(440px,calc(100% - 2rem))}
  dialog::backdrop{background:rgba(31,31,31,.45)}
  dialog h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.6rem;margin-bottom:1rem}
  .field{margin-bottom:.85rem}
  .field label{display:block;font-size:.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin-bottom:.3rem}
  .field input,.field textarea{width:100%;padding:.65rem .85rem;border-radius:10px;border:1px solid var(--line);background:var(--bg)}
  .field input:focus,.field textarea:focus,.toolbar input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px rgba(201,169,110,.2)}
  .field textarea{min-height:180px;resize:vertical;font-size:.85rem}
  .hint{color:var(--soft);font-size:.78rem;margin-top:.3rem}
  .error{color:var(--no);font-size:.85rem;min-height:1.2em;margin-top:.25rem}
  .dialog-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem}
  .toast{position:fixed;left:50%;bottom:1.5rem;transform:translate(-50%,150%);opacity:0;pointer-events:none;background:#1f1f1f;color:#fdfaf6;border:1px solid var(--line);padding:.7rem 1.2rem;border-radius:999px;font-size:.85rem;transition:transform .3s ease,opacity .3s ease}
  .toast.show{transform:translate(-50%,0);opacity:1}
  @media (max-width:520px){.top-actions .btn{flex:1;justify-content:center}}
`;

const SCRIPT = `
// ── Mensaje que se copia para cada invitado ({nombre}, {link}) ──
const MENSAJE = [
  '✨ ¡Ya falta poco! {nombre} ✨',
  '🖤Michelle & Andrés🖤',
  '',
  'Queremos asegurarnos de contar contigo en este día tan especial 🤍💍',
  '¿Nos ayudas confirmando tu asistencia aquí?',
  '👉 {link}',
  '',
  '✨ ¡Recuerda estos puntos clave! ✨',
  '',
  '🖤 El dress code es TOTAL BLACK 🖤',
  '👗 Mujeres: vestido de noche negro, mate o satinado, sin brillos',
  '🤵 Hombres: traje negro, corbata negra y camisa blanca o negra',
  '',
  '⛪ La misa es a las 16:15 h, aquí te dejamos la ubicación:',
  '📍 https://maps.app.goo.gl/5tSV7MmnhGaYuH4H7',
  '',
  '¡Nos hace muchísima ilusión celebrar contigo! 🥂'
].join('\\n');

const LABEL = { pending: 'Pendiente', confirmed: 'Confirmó', cancelled: 'Canceló' };
let guests = [];
let filter = 'all';

const $ = sel => document.querySelector(sel);
const list = $('#list');

async function api(path, body) {
  const res = await fetch('/admin/' + path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { location.reload(); throw new Error('Sesión expirada'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || 'Error ' + res.status);
  return data;
}

async function load() {
  try {
    guests = (await api('guests')).guests;
    render();
  } catch (e) {
    list.innerHTML = '';
    list.append(el('li', 'empty', 'No se pudo cargar la lista: ' + e.message));
  }
}

// ── Pintar ──
function render() {
  const count = s => guests.filter(g => g.status === s).length;
  const seats = s => guests.filter(g => !s || g.status === s).reduce((n, g) => n + g.tickets, 0);
  $('#s-total').textContent = guests.length;
  $('#s-confirmed').textContent = count('confirmed');
  $('#s-pending').textContent = count('pending');
  $('#s-cancelled').textContent = count('cancelled');
  $('#s-seats').textContent = seats('confirmed') + ' / ' + seats();

  const q = $('#search').value.trim().toLowerCase();
  const shown = guests.filter(g =>
    (filter === 'all' || g.status === filter) &&
    (!q || [g.name, g.phone, g.notes].some(v => v && v.toLowerCase().includes(q)))
  );

  list.innerHTML = '';
  if (!shown.length) {
    list.append(el('li', 'empty', guests.length ? 'Nadie coincide con el filtro.' : 'Aún no hay invitados. Agrega el primero 🤍'));
    return;
  }
  shown.forEach(g => list.append(row(g)));
}

function row(g) {
  const li = el('li', 'guest');
  li.dataset.status = g.status;

  const main = el('div');
  main.append(el('div', 'g-name', g.name));
  const meta = [plural(g.tickets)];
  if (g.phone) meta.push(g.phone);
  if (g.notes) meta.push(g.notes);
  if (g.confirmed_at) meta.push('confirmó ' + g.confirmed_at.slice(0, 16));
  main.append(el('div', 'g-meta', meta.join(' · ')));

  const sel = el('select', 'g-status ' + g.status);
  sel.setAttribute('aria-label', 'Estado de ' + g.name);
  Object.keys(LABEL).forEach(s => {
    const o = el('option', '', LABEL[s]);
    o.value = s;
    o.selected = s === g.status;
    sel.append(o);
  });
  sel.addEventListener('change', async () => {
    const prev = g.status;
    try {
      await api('guests/status', { code: g.code, status: sel.value });
      g.status = sel.value;
      g.confirmed_at = sel.value === 'confirmed' ? new Date().toISOString().replace('T', ' ') : null;
      render();
    } catch (e) { sel.value = prev; toast(e.message); }
  });

  const actions = el('div', 'g-actions');
  const copy = button('🔗 Copiar mensaje', async () => {
    await copyText(mensaje(g));
    copy.textContent = '✓ Copiado';
    copy.classList.add('done');
    setTimeout(() => { copy.textContent = '🔗 Copiar mensaje'; copy.classList.remove('done'); }, 2000);
  });
  actions.append(copy);
  actions.append(button('Solo link', async () => { await copyText(link(g)); toast('Link copiado'); }));
  if (g.phone) {
    const wa = el('a', 'btn btn-sm', '💬 WhatsApp');
    wa.href = 'https://wa.me/' + waNumber(g.phone) + '?text=' + encodeURIComponent(mensaje(g));
    wa.target = '_blank';
    wa.rel = 'noopener';
    actions.append(wa);
  }
  actions.append(button('✏️ Editar', () => openForm(g)));
  const del = button('Eliminar', async () => {
    if (!confirm('¿Eliminar a ' + g.name + '? No se puede deshacer.')) return;
    try {
      await api('guests/delete', { code: g.code });
      guests = guests.filter(x => x.code !== g.code);
      render();
    } catch (e) { toast(e.message); }
  });
  del.classList.add('btn-danger');
  actions.append(del);

  li.append(main, sel, actions);
  return li;
}

// ── Mensaje y link ──
function link(g) { return 'https://map-wedding.com/?code=' + g.code; }

function mensaje(g) {
  // "Familia López" va completo, "Tío Juan Pérez" → "Tío Juan", "Ana Pérez" → "Ana"
  const words = g.name.trim().split(/\\s+/);
  const nombre = /^fam(ilia|\\.)?$/i.test(words[0]) ? words.join(' ')
    : /^(t[ií][oa]s?|sra?\\.?|srta\\.?|dra?\\.?|abuel[oa]s?|padrinos?|madrinas?|primos?|primas?)$/i.test(words[0]) ? words.slice(0, 2).join(' ')
    : words[0];
  return MENSAJE.replace('{nombre}', nombre).replace('{link}', link(g));
}

function plural(n) { return n + (n === 1 ? ' boleto' : ' boletos'); }

function waNumber(phone) {
  const digits = phone.replace(/\\D/g, '');
  return digits.length === 10 ? '52' + digits : digits;   // 10 dígitos = celular de México sin lada de país
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = el('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// ── Alta / edición ──
const form = $('#guest-form');
const f = form.elements;
function openForm(g) {
  form.reset();
  $('#form-title').textContent = g ? 'Editar invitado' : 'Agregar invitado';
  f.code.value = g ? g.code : '';
  f.name.value = g ? g.name : '';
  f.tickets.value = g ? g.tickets : 1;
  f.phone.value = g ? g.phone || '' : '';
  f.notes.value = g ? g.notes || '' : '';
  $('#form-error').textContent = '';
  $('#guest-dialog').showModal();
  f.name.focus();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const body = {
    code: f.code.value || undefined,
    name: f.name.value,
    tickets: f.tickets.value,
    phone: f.phone.value,
    notes: f.notes.value,
  };
  try {
    await api('guests/save', body);
    $('#guest-dialog').close();
    toast(body.code ? 'Cambios guardados' : 'Invitado agregado');
    load();
  } catch (err) { $('#form-error').textContent = err.message; }
});

// ── Importar lista (una línea por invitado: Nombre, boletos, teléfono, notas) ──
const importForm = $('#import-form');
importForm.addEventListener('submit', async e => {
  e.preventDefault();
  const lines = importForm.elements.lines.value.split('\\n').map(l => l.trim()).filter(Boolean);
  const errEl = $('#import-error');
  let added = 0;
  const failed = [];
  for (const line of lines) {
    const [name, tickets, phone, ...notes] = line.split(/[,\\t]/).map(s => s.trim());
    try {
      await api('guests/save', { name, tickets: tickets || 1, phone, notes: notes.join(', ') });
      added++;
      errEl.textContent = 'Agregando… ' + added + ' / ' + lines.length;
    } catch (err) { failed.push(line + ' → ' + err.message); }
  }
  errEl.textContent = failed.length ? 'No se agregaron:\\n' + failed.join('\\n') : '';
  if (!failed.length) { $('#import-dialog').close(); importForm.reset(); }
  toast(added + ' invitado' + (added === 1 ? '' : 's') + ' agregado' + (added === 1 ? '' : 's'));
  load();
});

// ── CSV (con BOM para que Excel respete los acentos) ──
function exportCSV() {
  const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['Nombre', 'Boletos', 'Estado', 'Confirmó el', 'Teléfono', 'Notas', 'Link']]
    .concat(guests.map(g => [g.name, g.tickets, LABEL[g.status], g.confirmed_at, g.phone, g.notes, link(g)]));
  const blob = new Blob(['\\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\\r\\n')], { type: 'text/csv;charset=utf-8' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'confirmaciones.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Utilidades ──
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function button(text, onClick) {
  const b = el('button', 'btn btn-sm', text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

$('#add-btn').addEventListener('click', () => openForm(null));
$('#import-btn').addEventListener('click', () => { $('#import-error').textContent = ''; $('#import-dialog').showModal(); });
$('#csv-btn').addEventListener('click', exportCSV);
$('#search').addEventListener('input', render);
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c));
  filter = c.dataset.filter;
  render();
}));

load();
`;

function head(title) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<meta name="theme-color" content="#fdfaf6"/>
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Lato:wght@400;700&display=swap"/>
<style>${STYLES}</style>
</head>`;
}

export function adminPageHTML() {
  return `${head('MAP · Panel de Confirmaciones')}
<body>
<div class="wrap">
  <div class="top">
    <h1><small>Michelle &amp; Andrés · 21 nov 2026</small>Confirmaciones</h1>
    <div class="top-actions">
      <button class="btn btn-gold" id="add-btn" type="button">＋ Invitado</button>
      <button class="btn" id="import-btn" type="button">Importar lista</button>
      <button class="btn" id="csv-btn" type="button">⬇ CSV</button>
      <form method="POST" action="/admin/logout"><button class="btn">Salir</button></form>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><b id="s-total">–</b><span>Invitaciones</span></div>
    <div class="stat ok"><b id="s-confirmed">–</b><span>Confirmaron</span></div>
    <div class="stat wait"><b id="s-pending">–</b><span>Pendientes</span></div>
    <div class="stat no"><b id="s-cancelled">–</b><span>Cancelaron</span></div>
    <div class="stat ok"><b id="s-seats">–</b><span>Boletos confirmados</span></div>
  </div>

  <div class="toolbar">
    <input id="search" type="search" placeholder="Buscar por nombre, teléfono o nota" aria-label="Buscar"/>
    <button class="chip active" data-filter="all" type="button">Todos</button>
    <button class="chip" data-filter="pending" type="button">Pendientes</button>
    <button class="chip" data-filter="confirmed" type="button">Confirmaron</button>
    <button class="chip" data-filter="cancelled" type="button">Cancelaron</button>
  </div>

  <ul class="list" id="list"><li class="empty">Cargando…</li></ul>
</div>

<dialog id="guest-dialog">
  <form id="guest-form">
    <h2 id="form-title">Agregar invitado</h2>
    <input type="hidden" name="code"/>
    <div class="field"><label for="f-name">Nombre *</label><input id="f-name" name="name" required placeholder="Ej. Ana López"/></div>
    <div class="field"><label for="f-tickets">Boletos *</label><input id="f-tickets" name="tickets" type="number" min="1" max="20" required style="max-width:110px"/></div>
    <div class="field"><label for="f-phone">WhatsApp</label><input id="f-phone" name="phone" type="tel" placeholder="55 1234 5678"/></div>
    <div class="field"><label for="f-notes">Notas</label><input id="f-notes" name="notes" placeholder="Ej. Mesa 3, vegetariano…"/></div>
    <p class="error" id="form-error"></p>
    <div class="dialog-actions">
      <button class="btn" type="button" data-close>Cancelar</button>
      <button class="btn btn-gold">Guardar</button>
    </div>
  </form>
</dialog>

<dialog id="import-dialog">
  <form id="import-form">
    <h2>Importar lista</h2>
    <div class="field">
      <label for="f-lines">Un invitado por línea</label>
      <textarea id="f-lines" name="lines" required placeholder="Familia López, 4, 5512345678&#10;Ana Pérez, 2&#10;Tío Juan, 3, , mesa 5"></textarea>
      <p class="hint">Nombre, boletos, teléfono, notas (separados por coma o pegados de Excel). Solo el nombre es obligatorio.</p>
    </div>
    <p class="error" id="import-error" style="white-space:pre-line"></p>
    <div class="dialog-actions">
      <button class="btn" type="button" data-close>Cerrar</button>
      <button class="btn btn-gold">Importar</button>
    </div>
  </form>
</dialog>

<div class="toast" id="toast" role="status"></div>
<script>${SCRIPT}</script>
</body></html>`;
}

export function loginPageHTML(error = '') {
  return `${head('Admin · MAP')}
<body style="display:flex;align-items:center;justify-content:center">
<form method="POST" action="/admin/login" style="background:var(--card);border:1px solid var(--line);border-radius:18px;padding:2rem;width:min(340px,100%);text-align:center">
  <h1 style="margin-bottom:1.25rem"><small>Michelle &amp; Andrés</small>Panel MAP</h1>
  ${error ? `<p class="error" style="margin-bottom:.75rem">${error}</p>` : ''}
  <div class="field"><input type="password" name="key" placeholder="Contraseña" aria-label="Contraseña" autofocus required/></div>
  <button class="btn btn-gold" style="width:100%;justify-content:center">Entrar</button>
</form>
</body></html>`;
}
