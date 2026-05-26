const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const WEBHOOK_SECRET = 'whsec_YtheTyuKuOaQNCFy3BubTN0I8RbZ7MHK';
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzL78iWtDb2jUZ5yHhCO8wonBrmqO2lRGoRxjaVFvOtYBiDNTY_qPpBihWJfwm-WfWmUg/exec';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers['stripe-signature'],
      WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Webhook Error: ' + err.message };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const meta = session.metadata || {};

    // Only process if we have booking metadata
    if (!meta.ref) {
      return { statusCode: 200, body: 'No metadata, skipping' };
    }

    const bookingData = {
      action: 'booking',
      ref: meta.ref,
      tent: meta.tent,
      name: meta.name,
      email: session.customer_email || meta.email || '',
      phone: meta.phone || '',
      country: meta.country || '',
      checkin: meta.checkin,
      checkout: meta.checkout,
      nights: parseInt(meta.nights) || 1,
      adults: parseInt(meta.adults) || 1,
      kids: parseInt(meta.kids) || 0,
      extras: meta.extras || 'None',
      total: (session.amount_total / 100),
      voucher: meta.voucher || '',
      voucherValue: parseFloat(meta.voucherValue) || 0,
      notes: meta.notes || ''
    };

    try {
      const fetch = require('node-fetch');
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      const result = await response.json();
      console.log('Apps Script response:', JSON.stringify(result));
    } catch (err) {
      console.error('Apps Script error:', err.message);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
