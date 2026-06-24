/* ============================================================
   invite.js — Invitaciones personalizadas MAP
   ============================================================ */

(function () {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;

  fetch(`/api/guest?code=${encodeURIComponent(code)}`)
    .then(r => r.json())
    .then(data => {
      if (!data.ok) return;

      const { name, tickets } = data;
      let isConfirmed  = !!data.confirmed;
      let wasCancelled = !!data.cancelled;

      // ── Referencias al DOM ──
      const cardEl        = document.getElementById('rsvp-card');
      const kickerEl      = document.getElementById('rsvp-kicker');
      const titleEl       = document.getElementById('rsvp-title');
      const subtitleEl    = document.getElementById('rsvp-subtitle');
      const defaultEl     = document.getElementById('rsvp-default');
      const personalEl    = document.getElementById('rsvp-personal');
      const ticketCountEl = document.getElementById('rsvp-ticket-count');
      const actionLabelEl = document.getElementById('rsvp-action-label');
      const waBtn         = document.getElementById('rsvp-wa-personal');
      const cancelSection = document.getElementById('rsvp-cancel-section');
      const cancelBtn     = document.getElementById('rsvp-cancel-btn');

      // ── Activar tarjeta personal ──
      if (kickerEl)       kickerEl.textContent     = 'Invitación personal';
      if (titleEl)        titleEl.textContent       = name;
      if (ticketCountEl)  ticketCountEl.textContent = tickets;
      if (defaultEl)      defaultEl.style.display   = 'none';
      if (personalEl)     personalEl.style.display  = 'block';

      // ── Botón WhatsApp ──
      if (waBtn) {
        const msg = encodeURIComponent(
          `Hola, confirmo mi asistencia a la boda de Michelle & Andres.\nSoy ${name} y asistiré con ${tickets} lugar${tickets > 1 ? 'es' : ''}.`
        );
        waBtn.href = `https://wa.me/5215526714343?text=${msg}`;
        waBtn.addEventListener('click', () => {
          fetch('/api/confirm', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ code }),
          })
          .then(r => r.json())
          .then(() => applyConfirmedState())
          .catch(() => {});
        });
      }

      // ─────────────────────────────────────────
      //  POPUP FLOTANTE — se crea ANTES de aplicar estados
      // ─────────────────────────────────────────
      const popup      = document.createElement('div');
      const popupInner = document.createElement('div');
      popup.id      = 'invite-popup';
      popupInner.id = 'invite-popup-inner';

      Object.assign(popup.style, {
        position:     'fixed',
        bottom:       '1.5rem',
        left:         '1.5rem',
        zIndex:       '9999',
        background:   '#fff',
        borderRadius: '16px',
        boxShadow:    '0 8px 32px rgba(0,0,0,.16)',
        padding:      '1.25rem 1.5rem',
        maxWidth:     '310px',
        width:        'calc(100vw - 3rem)',
        transition:   'opacity .3s ease, transform .3s ease',
      });

      popup.appendChild(popupInner);
      document.body.appendChild(popup);

      // ── Renderiza el contenido del popup ──
      function renderPopupContent(cancelled) {
        if (cancelled) {
          popupInner.innerHTML = `
            <button id="popup-close-btn" aria-label="Cerrar" style="position:absolute;top:.75rem;right:.9rem;background:none;border:none;cursor:pointer;font-size:1.1rem;color:#aaa;line-height:1;padding:0;">✕</button>
            <div style="padding:.25rem 0;text-align:center;">
              <p style="font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-bottom:.6rem;">Cancelación registrada</p>
              <p style="color:#555;font-size:.95rem;line-height:1.55;">¡Gracias! lamentamos que no puedas acompañarnos.</p>
            </div>
          `;
        } else {
          const confirmedBlock = isConfirmed ? `
            <p style="color:#16a34a;font-size:.88rem;margin-top:.65rem;display:flex;align-items:center;gap:.4rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ¡Listo! Tu asistencia fue confirmada 🎉
            </p>
            <button id="popup-cancel-btn" style="display:block;margin-top:.75rem;background:none;border:1.5px solid #e8b4b0;border-radius:999px;cursor:pointer;font-size:.8rem;color:#c0392b;padding:.45rem 1.1rem;font-weight:500;">
              Cancelar asistencia
            </button>
          ` : '';

          popupInner.innerHTML = `
            <button id="popup-close-btn" aria-label="Cerrar" style="position:absolute;top:.75rem;right:.9rem;background:none;border:none;cursor:pointer;font-size:1.1rem;color:#aaa;line-height:1;padding:0;">✕</button>
            <p style="font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c9a96e;margin-bottom:.35rem;">Invitación personal</p>
            <h3 style="font-family:'Cormorant Garamond',Georgia,serif;font-size:1.25rem;font-weight:600;color:#1a1a1a;margin:0 0 .5rem;">Hola, ${name}</h3>
            <span style="display:inline-flex;align-items:center;gap:.4rem;background:#fdf6e3;border-radius:999px;padding:.28rem .75rem;font-size:.8rem;color:#8a6900;border:1px solid #f0dca0;">
              🎫 Tu invitación es para ${tickets} persona${tickets > 1 ? 's' : ''}
            </span>
            ${confirmedBlock}
          `;
        }

        // Eventos del popup
        const closeBtn = document.getElementById('popup-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', closePopup);
        const popupCancelBtn = document.getElementById('popup-cancel-btn');
        if (popupCancelBtn) popupCancelBtn.addEventListener('click', handleCancel);
      }

      function closePopup() {
        popup.style.opacity   = '0';
        popup.style.transform = 'translateY(12px)';
        setTimeout(() => popup.remove(), 300);
      }

      // ── Estado: confirmado ──
      function applyConfirmedState() {
        isConfirmed = true;
        if (subtitleEl)    subtitleEl.textContent   = '¡Listo! Tu asistencia fue confirmada 🎉';
        if (actionLabelEl) actionLabelEl.textContent = '¡Confirmado!';
        if (cardEl)        cardEl.classList.add('is-confirmed');
        if (cancelSection) cancelSection.style.display = 'block';
        renderPopupContent(false);
      }

      // ── Estado: cancelado ──
      function applyCancelledState() {
        isConfirmed = false;
        if (subtitleEl)    subtitleEl.textContent   = 'Lamentamos que no puedas acompañarnos';
        if (cardEl)        cardEl.classList.remove('is-confirmed');
        if (cardEl)        cardEl.classList.add('is-cancelled');
        if (cancelSection) cancelSection.style.display = 'none';
        if (actionLabelEl) actionLabelEl.textContent   = '';
        if (waBtn)         waBtn.style.display          = 'none';
        if (personalEl) {
          personalEl.innerHTML = `
            <div class="dress-rule" style="text-align:center;padding:1.25rem 0;">
              <p style="font-size:1.6rem;margin-bottom:.5rem;">💔</p>
              <p style="color:#888;line-height:1.6;">¡Gracias!<br>Lamentamos que no puedas acompañarnos.</p>
            </div>
          `;
        }
        renderPopupContent(true);
      }

      // ── Botón cancelar (en la tarjeta) ──
      function handleCancel() {
        fetch('/api/cancel', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ code }),
        })
        .then(r => r.json())
        .then(() => applyCancelledState())
        .catch(() => {});
      }

      if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);

      // ── Aplicar estado inicial (popup ya existe) ──
      if (isConfirmed) {
        applyConfirmedState();
      } else if (wasCancelled) {
        applyCancelledState();
      } else {
        if (subtitleEl)    subtitleEl.textContent   = `Tu invitación es para ${tickets} persona${tickets > 1 ? 's' : ''}`;
        if (actionLabelEl) actionLabelEl.textContent = 'Confirma tu asistencia';
        renderPopupContent(false);
      }

      // ── Scroll suave a la tarjeta RSVP ──
      setTimeout(() => {
        if (cardEl) {
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          cardEl.style.transition = 'box-shadow 0.5s ease';
          cardEl.style.boxShadow  = '0 0 0 3px rgba(201,169,110,0.55), 0 12px 40px rgba(201,169,110,0.20)';
          setTimeout(() => { cardEl.style.boxShadow = ''; }, 2200);
        }
      }, 800);
    })
    .catch(() => {});
})();
