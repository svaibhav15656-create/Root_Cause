(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const selector = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
  const svgNS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(svgNS, 'svg');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
  Object.assign(overlay.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', overflow: 'visible', pointerEvents: 'none', zIndex: '45' });
  document.body.appendChild(overlay);

  const resize = () => overlay.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
  addEventListener('resize', resize, { passive: true });

  function attract(element, event) {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return;
    const rect = element.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(rect.width / 2, 1);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / Math.max(rect.height / 2, 1);
    element.classList.add('cursor-magnetic');
    element.style.setProperty('--magnet-x', `${Math.max(-1, Math.min(1, dx)) * 4}px`);
    element.style.setProperty('--magnet-y', `${Math.max(-1, Math.min(1, dy)) * 4}px`);
  }

  function release(element) {
    element.style.setProperty('--magnet-x', '0px');
    element.style.setProperty('--magnet-y', '0px');
    setTimeout(() => element.classList.remove('cursor-magnetic'), 180);
  }

  function spark(event, element) {
    if (element.disabled || element.getAttribute('aria-disabled') === 'true') return;
    const rect = element.getBoundingClientRect();
    const x = Number.isFinite(event.clientX) && (event.clientX || event.clientY)
      ? event.clientX
      : rect.left + rect.width / 2;
    const y = Number.isFinite(event.clientY) && (event.clientX || event.clientY)
      ? event.clientY
      : rect.top + rect.height / 2;
    const w = rect.width;
    const h = rect.height;
    for (let i = 0; i < 7; i++) {
      const angle = (Math.PI * 2 * i / 7) + (Math.random() - .5) * .28;
      const length = Math.max(18, Math.min(55, Math.max(w, h) * (.3 + Math.random() * .3)));
      const endX = Math.max(rect.left - 9, Math.min(rect.right + 9, x + Math.cos(angle) * length));
      const endY = Math.max(rect.top - 9, Math.min(rect.bottom + 9, y + Math.sin(angle) * length));
      const bendX = (x + endX) / 2 + (Math.random() - .5) * 14;
      const bendY = (y + endY) / 2 + (Math.random() - .5) * 14;
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', `M ${x} ${y} Q ${bendX} ${bendY} ${endX} ${endY}`);
      path.setAttribute('class', i === 0 ? 'button-spark button-spark-core' : 'button-spark');
      path.style.setProperty('--spark-delay', `${i * 10}ms`);
      overlay.appendChild(path);
      setTimeout(() => path.remove(), 360);
    }
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const element = event.target.closest?.(selector);
    if (element) attract(element, event);
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    const element = event.target.closest?.(selector);
    if (element && !element.contains(event.relatedTarget)) release(element);
  }, { passive: true });

  document.addEventListener('click', event => {
    const element = event.target.closest?.(selector);
    if (element) spark(event, element);
  });
})();
