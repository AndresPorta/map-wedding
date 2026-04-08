document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initScrollReveal();
  initSmoothScroll();
  initStickyHeader();
});

function initCountdown() {
  const weddingDate = new Date('2026-06-20T17:00:00');
  const countdownRoot = document.getElementById('countdown');

  if (!countdownRoot) return;

  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  const titleEl = document.getElementById('countdown-title');

  const updateCountdown = () => {
    const now = new Date();
    const diff = weddingDate.getTime() - now.getTime();

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      if (titleEl) {
        titleEl.textContent = '¡Hoy es el gran día!';
      }
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    daysEl.textContent = formatNumber(days);
    hoursEl.textContent = formatNumber(hours);
    minutesEl.textContent = formatNumber(minutes);
    secondsEl.textContent = formatNumber(seconds);
  };

  updateCountdown();
  window.setInterval(updateCountdown, 1000);
}

function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const observer = new IntersectionObserver(
    (entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -60px 0px'
    }
  );

  items.forEach((item) => observer.observe(item));
}

function initSmoothScroll() {
  const anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();

      const headerOffset = document.querySelector('.site-header')?.offsetHeight || 0;
      const elementPosition = target.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - headerOffset + 4;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    });
  });
}

function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const updateHeader = () => {
    if (window.scrollY > 24) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
}

function formatNumber(value) {
  return String(value).padStart(2, '0');
}
