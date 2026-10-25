(() => {
  const visuals = document.querySelectorAll('.visual-reveal');
  if (!visuals.length) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    visuals.forEach(visual => visual.classList.add('visual-is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('visual-is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.35 });

  visuals.forEach(visual => observer.observe(visual));
})();
