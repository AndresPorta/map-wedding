/* ============================================================
   main.js — Michelle & Andres · Wedding Invitation
   Sistema de animaciones por elemento + pétalos + contador
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initPetalCanvas();
  initElementReveal();
  initCountdown();
  initSmoothScroll();
  initStickyHeader();
  initRippleButtons();
  initCursorGlow();
});


/* ─────────────────────────────────────────
   1. PÉTALOS FLOTANTES
   ───────────────────────────────────────── */
function initPetalCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = 'petal-canvas';
  Object.assign(canvas.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none',
    zIndex:        '1',
    opacity:       '0.5'
  });
  document.body.prepend(canvas);

  // header y contenido por encima del canvas
  const base = document.createElement('style');
  base.textContent = `
    .site-header { z-index: 30; }
    main         { position: relative; z-index: 2; }
    .site-footer { position: relative; z-index: 2; }
  `;
  document.head.appendChild(base);

  const ctx = canvas.getContext('2d');
  let W, H, petals = [];

  const COLORS = [
    'rgba(255,200,175,0.72)', 'rgba(255,220,200,0.60)',
    'rgba(250,225,210,0.65)', 'rgba(240,190,165,0.55)',
    'rgba(255,210,190,0.68)'
  ];

  const resize = () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };

  const newPetal = (fromTop = false) => ({
    x:     Math.random() * (W || window.innerWidth),
    y:     fromTop ? -16 : Math.random() * (H || window.innerHeight),
    r:     3.5 + Math.random() * 8,
    vy:    0.3  + Math.random() * 0.5,
    vx:    (Math.random() - 0.5) * 0.5,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.035,
    sway:  Math.random() * Math.PI * 2,
    swayS: 0.007 + Math.random() * 0.007,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 0.45 + Math.random() * 0.45
  });

  const drawPetal = p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth   = 0.6;
    ctx.beginPath();
    ctx.moveTo(-p.r * 0.6, 0);
    ctx.lineTo( p.r * 0.6, 0);
    ctx.stroke();
    ctx.restore();
  };

  const tick = () => {
    ctx.clearRect(0, 0, W, H);
    petals.forEach((p, i) => {
      p.sway  += p.swayS;
      p.x     += p.vx + Math.sin(p.sway) * 0.4;
      p.y     += p.vy;
      p.angle += p.spin;
      if (p.y > H + 20) petals[i] = newPetal(true);
      drawPetal(p);
    });
    requestAnimationFrame(tick);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  const COUNT = Math.min(42, Math.floor((window.innerWidth * window.innerHeight) / 16000));
  for (let i = 0; i < COUNT; i++) petals.push(newPetal());
  tick();
}


/* ─────────────────────────────────────────
   2. SISTEMA DE ANIMACIONES POR ELEMENTO
   ─────────────────────────────────────────

   Filosofía:
   - Cada sección se marca con .anim-ready al iniciar
   - Cuando entra al viewport se marca con .anim-done
   - El CSS define qué animación tiene cada tipo de elemento
   - El JS asigna --d (delay en ms) a cada hijo para el stagger
   - El itinerario tiene tratamiento especial: items uno a uno

   Selectores animados (en orden de prioridad visual):
     .section-kicker / .eyebrow  → kickerIn
     h1 / h2 / h3                → textRise (cortina)
     p / time                    → textFade
     .ornament                   → lineGrow
     .btn                        → textFade
     .image-frame                → imgReveal
     .info-card / .soft-card     → cardReveal
     .icon-badge                 → iconBounce
     .timeline-item              → tlFromLeft / tlFromRight
     .timeline-dot               → dotPop
   ───────────────────────────────────────── */

function initElementReveal() {
  // Selectores hijos que reciben animación individual
  const CHILD_SELECTORS = [
    '.section-kicker', '.eyebrow', '.countdown-label', '.location-label',
    'h1', 'h2', 'h3',
    'p', 'time',
    '.ornament',
    '.btn',
    '.image-frame', '.location-image-wrapper',
    '.info-card', '.soft-card', '.countdown-card',
    '.icon-badge'
  ].join(',');

  // Secciones que participan (todas excepto el hero que ya está visible)
  const sections = document.querySelectorAll('section, .cta-panel');

  sections.forEach(section => {
    const isHero = section.id === 'hero' || section.classList.contains('hero');

    // Marcar como lista para animar
    section.classList.add('anim-ready');

    if (isHero) {
      // Hero: animar de inmediato con pequeño delay inicial
      assignDelays(section, CHILD_SELECTORS, 80, 120);
      // Pequeño timeout para que el CSS ya esté aplicado
      setTimeout(() => activateSection(section), 80);
      return;
    }

    // El resto: observar con IntersectionObserver
    const io = new IntersectionObserver(([entry], obs) => {
      if (!entry.isIntersecting) return;
      assignDelays(section, CHILD_SELECTORS, 60, 100);
      activateSection(section);
      obs.unobserve(entry.target);
    }, {
      threshold:  0.08,
      rootMargin: '0px 0px -40px 0px'
    });

    io.observe(section);
  });

  // Timeline: tratamiento especial con stagger por ítem
  initTimelineReveal();
}

/**
 * Asigna --d (delay ms) a cada hijo animable dentro de una sección.
 * Los hijos se ordenan por su posición vertical en la página.
 */
function assignDelays(section, selectors, baseDelay, step) {
  const children = Array.from(section.querySelectorAll(selectors))
    // Excluir los que están dentro del timeline (lo maneja initTimelineReveal)
    .filter(el => !el.closest('.timeline'));

  // Ordenar por posición Y para que el stagger vaya de arriba a abajo
  children.sort((a, b) => {
    const ay = a.getBoundingClientRect().top;
    const by = b.getBoundingClientRect().top;
    return ay - by;
  });

  // Agrupar elementos que están en la misma "fila" (misma Y aproximada)
  // para que entren simultáneamente en grids de 2 columnas
  let currentRow = -1;
  let rowDelay   = baseDelay;
  let prevY      = -9999;

  children.forEach(el => {
    const y = Math.round(el.getBoundingClientRect().top / 12) * 12; // snap a 12px
    if (y > prevY + 20) {
      rowDelay = currentRow === -1 ? baseDelay : rowDelay + step;
      currentRow++;
      prevY = y;
    }
    el.style.setProperty('--d', rowDelay);
  });
}

/**
 * Activa las animaciones en una sección
 */
function activateSection(section) {
  // Quitar anim-ready y añadir anim-done activa las animaciones CSS
  section.classList.remove('anim-ready');
  section.classList.add('anim-done');
}

/**
 * Timeline: cada ítem entra en cascada con su dirección correcta
 */
function initTimelineReveal() {
  const timeline = document.querySelector('.timeline');
  const items    = document.querySelectorAll('.timeline-item');
  if (!timeline || !items.length) return;

  // Marcar la dirección de cada ítem para el CSS
  items.forEach((item, i) => {
    const isDesktop = window.innerWidth >= 900;
    if (isDesktop) {
      item.classList.add(i % 2 === 0 ? 'tl-left' : 'tl-right');
    } else {
      item.classList.add('tl-left'); // en móvil todos desde la izquierda
    }
  });

  // Re-marcar en resize
  window.addEventListener('resize', () => {
    items.forEach((item, i) => {
      item.classList.remove('tl-left', 'tl-right');
      const isDesktop = window.innerWidth >= 900;
      item.classList.add(
        isDesktop ? (i % 2 === 0 ? 'tl-left' : 'tl-right') : 'tl-left'
      );
    });
  }, { passive: true });

  const io = new IntersectionObserver(([entry], obs) => {
    if (!entry.isIntersecting) return;

    const section = timeline.closest('section');
    if (section) {
      section.classList.remove('anim-ready');
      section.classList.add('anim-done');
    }

    // Stagger de items: cada 160ms
    items.forEach((item, i) => {
      const delay = 100 + i * 160;
      item.style.setProperty('--d', delay);

      // El dot aparece 80ms después del card
      const dot = item.querySelector('.timeline-dot');
      if (dot) dot.style.setProperty('--d', delay + 80);

      const card = item.querySelector('.timeline-card');
      if (card) card.style.setProperty('--d', delay + 40);
    });

    obs.unobserve(entry.target);
  }, { threshold: 0.08 });

  io.observe(timeline);
}


/* ─────────────────────────────────────────
   3. CONTADOR — anima solo el número al cambiar
   ───────────────────────────────────────── */
function initCountdown() {
  const WEDDING = new Date('2026-11-21T17:00:00');

  const els = {
    days:    document.getElementById('days'),
    hours:   document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds')
  };
  if (!els.days) return;

  // Inyectar animación de número
  const style = document.createElement('style');
  style.textContent = `
    #days, #hours, #minutes, #seconds { display: inline-block; }

    @keyframes numDrop {
      0%   { opacity: 0; transform: translateY(-32%) scale(0.82); }
      60%  { opacity: 1; transform: translateY(5%)   scale(1.06); }
      100% { opacity: 1; transform: translateY(0)    scale(1);    }
    }
    .num-flip {
      animation: numDrop 0.44s cubic-bezier(0.16,1,0.3,1) forwards;
    }
    @media (prefers-reduced-motion: reduce) {
      .num-flip { animation: none; }
    }
  `;
  document.head.appendChild(style);

  const prev = {};
  const flip = (el, str) => {
    el.classList.remove('num-flip');
    void el.offsetWidth;
    el.textContent = str;
    el.classList.add('num-flip');
  };

  const update = () => {
    const diff = WEDDING - Date.now();
    if (diff <= 0) {
      Object.values(els).forEach(el => { if (el) el.textContent = '00'; });
      return;
    }
    const vals = {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff / 3600000) % 24),
      minutes: Math.floor((diff / 60000) % 60),
      seconds: Math.floor((diff / 1000) % 60)
    };
    Object.entries(vals).forEach(([k, v]) => {
      const s = String(v).padStart(2, '0');
      if (prev[k] !== s) { prev[k] = s; flip(els[k], s); }
    });
  };

  update();
  setInterval(update, 1000);
}


/* ─────────────────────────────────────────
   4. SMOOTH SCROLL con easing cúbico propio
   ───────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const headerH = document.querySelector('.site-header')?.offsetHeight || 0;
      const top     = target.getBoundingClientRect().top + window.scrollY - headerH - 8;
      smoothTo(top, 920);
    });
  });
}

function smoothTo(targetY, ms) {
  const startY = window.scrollY;
  const dist   = targetY - startY;
  let   start  = null;
  const ease   = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
  const step   = ts => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / ms, 1);
    window.scrollTo(0, startY + dist * ease(p));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}


/* ─────────────────────────────────────────
   5. STICKY HEADER — ocultar al bajar, aparecer al subir
   ───────────────────────────────────────── */
function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const style = document.createElement('style');
  style.textContent = `
    .site-header {
      transition: background 0.35s ease, box-shadow 0.35s ease,
                  transform 0.4s cubic-bezier(0.4,0,0.2,1), padding 0.3s ease;
    }
    .site-header.header-hidden { transform: translateY(-110%); }
  `;
  document.head.appendChild(style);

  let last = window.scrollY;
  const update = () => {
    const cur = window.scrollY;
    header.classList.toggle('scrolled', cur > 40);
    header.classList.toggle('header-hidden', cur > last + 6 && cur > 180);
    last = cur;
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}


/* ─────────────────────────────────────────
   6. RIPPLE en botones
   ───────────────────────────────────────── */
function initRippleButtons() {
  const style = document.createElement('style');
  style.textContent = `
    .btn { position: relative; overflow: hidden; }
    .ripple-wave {
      position: absolute; border-radius: 50%;
      background: rgba(255,255,255,0.28);
      transform: scale(0); pointer-events: none;
      animation: rippleGo 0.55s cubic-bezier(0.4,0,0.2,1) forwards;
    }
    @keyframes rippleGo { to { transform: scale(1); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .ripple-wave { animation: none; } }
  `;
  document.head.appendChild(style);

  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    Object.assign(wave.style, {
      width:  size + 'px', height: size + 'px',
      left:   (e.clientX - rect.left - size / 2) + 'px',
      top:    (e.clientY - rect.top  - size / 2) + 'px'
    });
    btn.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove(), { once: true });
  });
}


/* ─────────────────────────────────────────
   7. CURSOR GLOW — halo dorado suave (desktop)
   ───────────────────────────────────────── */
function initCursorGlow() {
  if (window.matchMedia('(hover:none),(prefers-reduced-motion:reduce)').matches) return;

  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', width: '300px', height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(201,169,110,0.11) 0%, transparent 68%)',
    pointerEvents: 'none', zIndex: '1',
    transform: 'translate(-50%,-50%)',
    opacity: '0', transition: 'opacity 0.5s ease',
    top: '0', left: '0'
  });
  document.body.appendChild(el);

  let tx = 0, ty = 0, cx = 0, cy = 0;
  const lerp = (a, b, t) => a + (b - a) * t;

  document.addEventListener('mousemove', e => {
    tx = e.clientX; ty = e.clientY; el.style.opacity = '1';
  }, { passive: true });
  document.addEventListener('mouseleave', () => { el.style.opacity = '0'; });

  const tick = () => {
    cx = lerp(cx, tx, 0.09); cy = lerp(cy, ty, 0.09);
    el.style.left = cx + 'px'; el.style.top = cy + 'px';
    requestAnimationFrame(tick);
  };
  tick();
}
