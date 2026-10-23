(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const selector = 'button, a, [role="button"], input[type="button"], input[type="submit"]';
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

  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const element = event.target.closest?.(selector);
    if (element) attract(element, event);
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    const element = event.target.closest?.(selector);
    if (element && !element.contains(event.relatedTarget)) release(element);
  }, { passive: true });

})();
