/**
 * MAP Wedding — Cloudflare Worker
 * Estados de confirmed: 0 = pendiente, 1 = confirmó, -1 = canceló
 */
import { adminPageHTML, loginPageHTML } from './admin-page.js';

// La clave del admin vive en el secreto ADMIN_KEY de Cloudflare (wrangler secret put ADMIN_KEY).
// La cookie de sesión no guarda la clave: guarda una fecha de expiración firmada con ella
// (HMAC). Cambiar la clave cierra todas las sesiones.
const SESSION_COOKIE = 'map_admin';
const SESSION_HOURS  = 8;
const CODE_CHARS     = 'abcdefghijkmnpqrstuvwxyz23456789';
const STATUS         = { pending: 0, confirmed: 1, cancelled: -1 };
const STATUS_NAME    = { 0: 'pending', 1: 'confirmed', '-1': 'cancelled' };
const enc = new TextEncoder();

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
        'SELECT name, tickets, confirmed FROM guests WHERE code = ?'
      ).bind(code.trim().toLowerCase()).first();

      if (!guest) return json({ error: 'Invitado no encontrado' }, 404);
      return json({
        ok:        true,
        name:      guest.name,
        tickets:   guest.tickets,
        confirmed: guest.confirmed === 1,
        cancelled: guest.confirmed === -1,
      });
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
      if (guest.confirmed === 1) return json({ ok: true, alreadyConfirmed: true, name: guest.name });

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

      // confirmed = -1 → canceló (sin tocar confirmed_at)
      await env.MAP_DB.prepare(
        'UPDATE guests SET confirmed = -1 WHERE code = ?'
      ).bind(code).run();

      return json({ ok: true, name: guest.name });
    }

    // ── POST /admin/login ──
    if (path === '/admin/login' && method === 'POST') {
      const form = await request.formData();
      const key  = String(form.get('key') || '');
      if (!env.ADMIN_KEY || !(await sameText(key, env.ADMIN_KEY))) {
        return html(loginPageHTML('Contraseña incorrecta.'), 401);
      }
      const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
      return new Response(null, {
        status: 303,
        headers: {
          'Location':   '/admin',
          'Set-Cookie': `${SESSION_COOKIE}=${exp}.${await sign(env.ADMIN_KEY, exp)}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}`,
        },
      });
    }

    // ── POST /admin/logout ──
    if (path === '/admin/logout' && method === 'POST') {
      return new Response(null, {
        status: 303,
        headers: {
          'Location':   '/admin',
          'Set-Cookie': `${SESSION_COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        },
      });
    }

    // ── GET /admin → login o panel (el panel pide la lista a /admin/guests) ──
    if ((path === '/admin' || path === '/admin/') && method === 'GET') {
      return (await isAdminAuthed(request, env)) ? html(adminPageHTML()) : html(loginPageHTML(), 401);
    }

    if (path.startsWith('/admin/')) {
      if (!(await isAdminAuthed(request, env))) return json({ error: 'No autorizado' }, 401);

      // ── GET /admin/guests ──
      if (path === '/admin/guests' && method === 'GET') {
        const { results } = await env.MAP_DB.prepare(
          'SELECT code, name, tickets, confirmed, confirmed_at, phone, notes FROM guests ORDER BY name COLLATE NOCASE'
        ).all();
        return json({
          ok: true,
          guests: results.map(({ confirmed, ...g }) => ({ ...g, status: STATUS_NAME[confirmed] ?? 'pending' })),
        });
      }

      // ── POST /admin/guests/save → alta (sin code) o edición (con code) ──
      if (path === '/admin/guests/save' && method === 'POST') {
        const body    = await readJson(request);
        const name    = body?.name?.trim();
        const tickets = parseInt(body?.tickets, 10);
        const phone   = body?.phone?.trim() || null;
        const notes   = body?.notes?.trim() || null;
        if (!name) return json({ error: 'El nombre es obligatorio' }, 400);
        if (!(tickets >= 1 && tickets <= 20)) return json({ error: 'Los boletos van de 1 a 20' }, 400);

        if (body.code) {
          const code = body.code.trim().toLowerCase();
          const { meta } = await env.MAP_DB.prepare(
            'UPDATE guests SET name = ?, tickets = ?, phone = ?, notes = ? WHERE code = ?'
          ).bind(name, tickets, phone, notes, code).run();
          if (!meta.changes) return json({ error: 'Invitado no encontrado' }, 404);
          return json({ ok: true, code });
        }

        // Código nuevo al azar; si choca con uno existente (casi imposible) se intenta otro
        for (let i = 0; i < 5; i++) {
          const code = randomCode();
          const { meta } = await env.MAP_DB.prepare(
            'INSERT OR IGNORE INTO guests (name, code, tickets, phone, notes, confirmed, confirmed_at) VALUES (?, ?, ?, ?, ?, 0, NULL)'
          ).bind(name, code, tickets, phone, notes).run();
          if (meta.changes) return json({ ok: true, code });
        }
        return json({ error: 'No se pudo generar el código, intenta de nuevo' }, 500);
      }

      // ── POST /admin/guests/status ──
      if (path === '/admin/guests/status' && method === 'POST') {
        const body   = await readJson(request);
        const code   = body?.code?.trim()?.toLowerCase();
        const status = body?.status;
        if (!code || !Object.hasOwn(STATUS, status)) return json({ error: 'Parámetros inválidos' }, 400);

        const atSql = status === 'confirmed' ? "datetime('now')" : 'NULL';
        const { meta } = await env.MAP_DB.prepare(
          `UPDATE guests SET confirmed = ?, confirmed_at = ${atSql} WHERE code = ?`
        ).bind(STATUS[status], code).run();
        if (!meta.changes) return json({ error: 'Invitado no encontrado' }, 404);
        return json({ ok: true });
      }

      // ── POST /admin/guests/delete ──
      if (path === '/admin/guests/delete' && method === 'POST') {
        const code = (await readJson(request))?.code?.trim()?.toLowerCase();
        if (!code) return json({ error: 'Código requerido' }, 400);
        await env.MAP_DB.prepare('DELETE FROM guests WHERE code = ?').bind(code).run();
        return json({ ok: true });
      }

      return json({ error: 'No encontrado' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

// ── Sesión del admin ──
async function isAdminAuthed(request, env) {
  if (!env.ADMIN_KEY) return false;
  const cookie = (request.headers.get('Cookie') || '')
    .split(';').map(c => c.trim())
    .find(c => c.startsWith(SESSION_COOKIE + '='));
  const [exp, sig] = (cookie?.slice(SESSION_COOKIE.length + 1) || '').split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;

  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(env.ADMIN_KEY), fromBase64Url(sig), enc.encode(`map-admin.${exp}`));
  } catch {
    return false;
  }
}

async function sign(secret, exp) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`map-admin.${exp}`));
  return toBase64Url(new Uint8Array(sig));
}

function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Compara la clave sin filtrar por tiempo cuántos caracteres coinciden. */
async function sameText(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

// ── Utilidades ──
function randomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
      'X-Frame-Options': 'DENY',
    },
  });
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
