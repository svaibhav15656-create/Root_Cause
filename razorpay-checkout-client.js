'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const button = $('#plus-checkout-button');
  if (!button) return;
  const cancelButton = $('#cancel-subscription-button');
  const status = $('#billing-status');
  const preview = $('.checkout-preview');
  const tag = $('#plus-plan-tag');
  let billingState = null;
  let refreshTimer = null;
  let refreshChecks = 0;

  async function request(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The billing request could not be completed.');
    return data;
  }

  function show(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error-message', isError);
  }

  function render(data) {
    billingState = data;
    const hasEntitlement = data.entitlement === 'team';
    const canCancel = hasEntitlement && ['active', 'authenticated', 'pending'].includes(data.status);
    const waiting = data.status === 'authenticated' || (data.status === 'created' && data.checkoutVerified);
    clearTimeout(refreshTimer);
    if (waiting && refreshChecks < 8) refreshTimer = setTimeout(() => { refreshChecks += 1; refresh(); }, 3000);
    else if (!waiting) refreshChecks = 0;
    button.disabled = true;
    button.hidden = hasEntitlement;
    cancelButton.hidden = !canCancel || data.cancelAtCycleEnd;
    if (tag) tag.hidden = !!data.enabled;
    if (preview) preview.hidden = !!data.enabled;

    if (!data.enabled) {
      show('Free during early access. Billing is not available yet.');
      button.textContent = 'Upgrade · Coming soon';
      return;
    }
    if (!data.configured) {
      show('Checkout is not configured yet.');
      button.textContent = 'Checkout unavailable';
      return;
    }
    if (hasEntitlement && data.cancelAtCycleEnd) {
      const end = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString() : 'the end of your paid period';
      show(`Plus is active until ${end}; cancellation is scheduled.`);
      return;
    }
    if (hasEntitlement && data.status === 'active') {
      const end = data.currentPeriodEnd ? new Date(data.currentPeriodEnd).toLocaleDateString() : 'not yet available';
      show(`Plus is active. Next billing date: ${end}.`);
      return;
    }
    if (data.status === 'pending' || data.status === 'halted') {
      show(data.status === 'pending' ? 'Payment failed or needs attention. Razorpay may retry the charge; your current plan stays in place until payment is confirmed.' : 'The previous subscription has stopped after failed payment. Your plan is Free; you can start a new Plus checkout.', true);
      if (data.status === 'halted') { button.hidden = false; button.disabled = false; button.textContent = 'Try Plus checkout again'; }
      else button.textContent = 'Payment needs attention';
      return;
    }
    if (data.status === 'created' && !data.checkoutVerified) {
      show('A checkout is ready to continue. Your plan changes only after Razorpay confirms payment.');
      button.hidden = false;
      button.disabled = false;
      button.textContent = 'Continue checkout';
      return;
    }
    if (waiting) {
      show('Checkout is awaiting confirmation from Razorpay. Your plan changes only after the server receives confirmation.');
      button.textContent = 'Payment awaiting confirmation';
      return;
    }
    show('Plus checkout is available. Billing repeats monthly at ₹199 until cancelled.');
    button.hidden = false;
    button.disabled = false;
    button.textContent = 'Subscribe · ₹199/month';
  }

  async function refresh() {
    try { render(await request('/api/billing')); }
    catch (error) { show(error.message, true); }
  }

  function loadCheckout() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Razorpay Checkout could not be loaded. Check your connection and try again.'));
      document.head.append(script);
    });
  }

  button.addEventListener('click', async () => {
    if (!billingState?.enabled || !billingState?.configured || button.disabled) return;
    button.disabled = true;
    try {
      await loadCheckout();
      const created = await request('/api/billing/subscribe', {
        method: 'POST', body: JSON.stringify({ plan: 'team' })
      });
      const checkout = new window.Razorpay({
        key: created.keyId,
        subscription_id: created.subscriptionId,
        name: 'RootCause',
        description: 'Plus · ₹199 per month',
        prefill: { email: $('#profile-email')?.value || '' },
        theme: { color: '#27382d' },
        handler: async response => {
          show('Verifying the payment response…');
          try {
            const verified = await request('/api/billing/verify', {
              method: 'POST', body: JSON.stringify(response)
            });
            refreshChecks = 0;
            show(verified.message || 'Payment verified. Waiting for subscription activation.');
            await refresh();
          } catch (error) { show(error.message, true); }
        },
        modal: { ondismiss: () => { show('Checkout closed. Your plan stays unchanged until Razorpay confirms payment.'); refresh(); } }
      });
      checkout.on('payment.failed', () => show('Payment failed. Your account remains on its current plan. Please try again.', true));
      checkout.open();
    } catch (error) {
      show(error.message, true);
      button.disabled = false;
    }
  });

  cancelButton.addEventListener('click', async () => {
    if (!confirm('Cancel Plus at the end of the current paid period?')) return;
    cancelButton.disabled = true;
    try { const result = await request('/api/billing/cancel', { method: 'POST', body: '{}' }); show(result.message); await refresh(); }
    catch (error) { show(error.message, true); }
    finally { cancelButton.disabled = false; }
  });

  window.initializeBilling = refresh;
})();
