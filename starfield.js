(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const field = document.createElement('div');
  field.className = 'site-starfield';
  field.setAttribute('aria-hidden', 'true');

  function populate() {
    const width = document.documentElement.clientWidth;
    const height = innerHeight;
    const count = Math.max(130, Math.min(480, Math.round(width * height / 4500)));
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const star = document.createElement('i');
      star.className = 'site-star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.setProperty('--star-size', `${Math.random() < .08 ? 1.6 : .6 + Math.random() * .8}px`);
      star.style.setProperty('--star-opacity', `${.22 + Math.random() * .58}`);
      star.style.setProperty('--twinkle-duration', `${3 + Math.random() * 7}s`);
      star.style.setProperty('--twinkle-delay', `${-Math.random() * 7}s`);
      fragment.appendChild(star);
    }
    field.replaceChildren(fragment);
  }

  document.body.appendChild(field);
  populate();
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(populate, 150);
  }, { passive: true });
  if (reducedMotion) field.classList.add('site-starfield-static');
})();
