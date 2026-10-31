wheel(() => {
  const SKIP = [
    '.ihb-skip',
    '.modal-x',
    '.sun-moon-toggle',
    '.sidebar-feature',
    '.sidebar-new',
    '.sidebar-account',
    '.account-trigger',
    '.text-button',
    '.inline-link',
    '.upload-button',
    '.forgot-link',
    '#auth-switch',
    '.account-nav button',
    '.review-tabs button',
    '.guide-tabs button',
    'dialog .close button',
    '[data-close-dialog]',
    '.preview-subscribe',
  ].join(',');

  const ARROW =
    '<svg class="ihb-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

  function shouldEnhance(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.matches(SKIP)) return false;
    if (el.closest(SKIP)) return false;
    if (!(el.classList.contains('btn') || el.classList.contains('button'))) return false;
    if (el.getAttribute('aria-label') && !el.textContent.trim() && !el.dataset.ihbLabel) return false;
    return true;
  }

  function readLabel(el) {
    const idle = el.querySelector(':scope > .ihb-idle');
    if (idle) return idle.textContent.replace(/\s+/g, ' ').trim();
    if (el.dataset.ihbLabel) return el.dataset.ihbLabel;
    return el.textContent.replace(/\s+/g, ' ').trim();
  }

  function enhance(el) {
    if (!shouldEnhance(el)) return;
    if (el.querySelector(':scope > .ihb-idle') && el.querySelector(':scope > .ihb-blob')) return;

    const text = readLabel(el) || 'Button';
    el.classList.add('ihb');
    el.dataset.ihbLabel = text;

    const idle = document.createElement('span');
    idle.className = 'ihb-idle';
    idle.textContent = text;

    const active = document.createElement('span');
    active.className = 'ihb-active';
    active.setAttribute('aria-hidden', 'true');
    const activeText = document.createElement('span');
    activeText.className = 'ihb-active-text';
    activeText.textContent = text;
    active.append(activeText);
    active.insertAdjacentHTML('beforeend', ARROW);

    const blob = document.createElement('span');
    blob.className = 'ihb-blob';
    blob.setAttribute('aria-hidden', 'true');

    el.replaceChildren(idle, active, blob);
  }

  function setLabel(el, text) {
    const value = String(text ?? '');
    el.dataset.ihbLabel = value;
    const idle = el.querySelector(':scope > .ihb-idle');
    const active = el.querySelector('.ihb-active-text');
    if (idle && active) {
      idle.textContent = value;
      active.textContent = value;
      return;
    }
    el.textContent = value;
    enhance(el);
  }

  function enhanceAll(root = document) {
    root.querySelectorAll('button.btn, a.btn, button.button, a.button').forEach(enhance);
  }

  function patchTextContent(Proto) {
    const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    if (!desc?.get || !desc?.set) return;
    Object.defineProperty(Proto.prototype, 'textContent', {
      configurable: true,
      enumerable: desc.enumerable,
      get() {
        if (this.classList?.contains('ihb')) {
          return this.dataset.ihbLabel || this.querySelector(':scope > .ihb-idle')?.textContent || '';
        }
        return desc.get.call(this);
      },
      set(value) {
        if (
          this.classList &&
          (this.classList.contains('ihb') ||
            ((this.classList.contains('btn') || this.classList.contains('button')) && shouldEnhance(this)))
        ) {
          setLabel(this, value);
          return;
        }
        desc.set.call(this, value);
      },
    });
  }

  patchTextContent(HTMLButtonElement);
  patchTextContent(HTMLAnchorElement);

  const boot = () => {
    enhanceAll();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList') {
          record.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches?.('button.btn, a.btn, button.button, a.button')) enhance(node);
            else enhanceAll(node);
          });
          if (
            record.target instanceof HTMLElement &&
            (record.target.classList.contains('btn') || record.target.classList.contains('button'))
          ) {
            enhance(record.target);
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.ihbEnhance = enhanceAll;
  window.ihbSetLabel = setLabel;
})();
