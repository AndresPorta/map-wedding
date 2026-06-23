/* ============================================================
   invite.js — Invitaciones personalizadas MAP
   Si la URL tiene ?code=xxx:
     · Personaliza la tarjeta RSVP con nombre + boletos
     · El botón de WhatsApp incluye el nombre del invitado
     · Al hacer clic también registra la confirmación en D1
   Si no hay código: la tarjeta queda en su estado genérico.
   ============================================================ */

(function () {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;

  fetch(`/api/guest?code=${encodeURIComponent(code)}`)
    .then(r => r.json())
    .then(data => {
      if (!data.ok) return; // código inválido → sin cambios

      const { name, tickets, confirmed } = data;

      // ── 1. Actualizar título y subtítulo ──
      const title    = document.getElementById('rsvp-title');
      const subtitle = document.getElementById('rsvp-subtitle');
      const kicker   = document.getElementById('rsvp-kicker');

      if (title)    title.textContent    = `Hola, ${name}`;
      if (subtitle) subtitle.textContent = `Tu invitación es para ${tickets} persona${tickets > 1 ? 's' : ''}`;
      if (kicker)   kicker.textContent   = 'Tu invitación';

      // ── 2. Mostrar sección personalizada, ocultar genérica ──
      const defaultEl  = document.getElementById('rsvp-default');
      const personalEl = document.getElementById('rsvp-personal');
      if (defaultEl)  defaultEl.style.display  = 'none';
      if (personalEl) personalEl.style.display = 'block';

      // ── 3. Número de boletos ──
      const ticketCount = document.getElementById('rsvp-ticket-count');
      if (ticketCount) ticketCount.textContent = tickets;

      // ── 4. Botón WhatsApp personalizado ──
      const waBtn = document.getElementById('rsvp-wa-personal');
      if (waBtn) {
        const msg = encodeURIComponent(
          `Hola, confirmo mi asistencia a la boda de Michelle & Andres.\nSoy ${name} y asistiré con ${tickets} lugar${tickets > 1 ? 'es' : ''}.`
        );
        waBtn.href = `https://wa.me/5215526714343?text=${msg}`;

        waBtn.addEventListener('click', () => {
          // Registrar confirmación en D1 (sin bloquear el clic)
          fetch('/api/confirm', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ code }),
          })
          .then(r => r.json())
          .then(() => {
            const card = document.getElementById('rsvp-card');
            const label = document.getElementById('rsvp-action-label');
            if (card)  card.classList.add('is-confirmed');
            if (label) label.textContent = '¡Asistencia confirmada!';
          })
          .catch(() => {/* silencioso */});
        });
      }

      // ── 5. Si ya había confirmado antes ──
      if (confirmed) {
        const card  = document.getElementById('rsvp-card');
        const label = document.getElementById('rsvp-action-label');
        if (card)  card.classList.add('is-confirmed');
        if (label) label.textContent = '¡Ya confirmaste tu asistencia!';
        if (waBtn) waBtn.textContent = '✓ Asistencia confirmada';
      }

      // ── 6. Scroll suave a la tarjeta RSVP ──
      setTimeout(() => {
        const card = document.getElementById('rsvp-card');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Destacar la tarjeta brevemente
          card.style.transition = 'box-shadow 0.5s ease';
          card.style.boxShadow  = '0 0 0 3px rgba(201,169,110,0.55), 0 12px 40px rgba(201,169,110,0.20)';
          setTimeout(() => { card.style.boxShadow = ''; }, 2200);
        }
      }, 800);
    })
    .catch(() => {/* Sin conexión o sin código válido → sin cambios */});
})();
