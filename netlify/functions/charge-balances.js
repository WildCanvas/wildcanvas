// Runs once a day (see netlify.toml). Charges the balance on Pōhutukawa
// deposit bookings 30 days before check-in, using the card saved at booking.
//
// How it finds bookings: every deposit payment in Stripe carries metadata
//   paymentPlan = deposit, balanceStatus = pending, balanceDueDate = YYYY-MM-DD
//
// To STOP a balance being charged (cancellation): refund the deposit in Stripe,
// or edit the deposit payment's metadata in Stripe and set balanceStatus = cancelled.
// To MOVE the date (date change): edit balanceDueDate on the deposit payment.
//
// If the automatic charge fails, Stripe emails the guest an invoice with a
// pay-online link (due in 7 days) and the payment is marked balanceStatus = invoiced.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

function todayNZ() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date());
}

async function findPendingDeposits() {
  const found = [];
  let page = null;
  do {
    const res = await stripe.paymentIntents.search({
      query: "status:'succeeded' AND metadata['paymentPlan']:'deposit' AND metadata['balanceStatus']:'pending'",
      limit: 100,
      ...(page ? { page } : {}),
    });
    found.push(...res.data);
    page = res.has_more ? res.next_page : null;
  } while (page);
  return found;
}

async function markDeposit(id, fields) {
  await stripe.paymentIntents.update(id, { metadata: fields });
}

async function chargeBalance(pi) {
  const m = pi.metadata || {};
  const amount = Math.round(parseFloat(m.balanceAmount) * 100);
  const label = (m.tent || 'Pōhutukawa Tent') + ' — balance · Ref ' + (m.ref || '') +
    ' · Check-in ' + (m.checkin || '');

  // Skip anything already refunded (cancelled bookings)
  if (pi.latest_charge) {
    const charge = await stripe.charges.retrieve(pi.latest_charge);
    if (charge.refunded || charge.amount_refunded > 0) {
      await markDeposit(pi.id, { balanceStatus: 'cancelled', balanceNote: 'Deposit refunded — balance not charged' });
      return { ref: m.ref, result: 'skipped (refunded)' };
    }
  }

  if (!pi.customer || !pi.payment_method || !(amount > 0)) {
    await markDeposit(pi.id, { balanceStatus: 'failed', balanceNote: 'Missing saved card or amount — charge manually' });
    return { ref: m.ref, result: 'failed (no saved card)' };
  }

  try {
    const balance = await stripe.paymentIntents.create({
      amount,
      currency: 'nzd',
      customer: pi.customer,
      payment_method: pi.payment_method,
      off_session: true,
      confirm: true,
      description: label,
      receipt_email: m.email || undefined,
      metadata: { type: 'balance', ref: m.ref || '', depositPaymentIntent: pi.id, checkin: m.checkin || '' },
    }, { idempotencyKey: 'balance-' + pi.id });

    await markDeposit(pi.id, { balanceStatus: 'paid', balancePaymentIntent: balance.id });
    return { ref: m.ref, result: 'paid' };

  } catch (err) {
    // Card declined or needs authentication: email the guest an invoice to pay online
    try {
      await stripe.invoiceItems.create({
        customer: pi.customer,
        amount,
        currency: 'nzd',
        description: label,
      });
      const invoice = await stripe.invoices.create({
        customer: pi.customer,
        collection_method: 'send_invoice',
        days_until_due: 7,
        pending_invoice_items_behavior: 'include',
        description: 'Balance for your Wild Canvas stay (Ref ' + (m.ref || '') + '). ' +
          'We tried to charge the card used for your deposit but it did not go through. ' +
          'Please pay online using the link in this email.',
        metadata: { type: 'balance', ref: m.ref || '', depositPaymentIntent: pi.id },
      });
      await stripe.invoices.sendInvoice(invoice.id);
      await markDeposit(pi.id, { balanceStatus: 'invoiced', balanceInvoice: invoice.id, balanceNote: (err.message || '').slice(0, 400) });
      return { ref: m.ref, result: 'card failed — invoice emailed' };
    } catch (invErr) {
      await markDeposit(pi.id, { balanceStatus: 'failed', balanceNote: ('Charge: ' + err.message + ' | Invoice: ' + invErr.message).slice(0, 480) });
      return { ref: m.ref, result: 'failed — follow up manually' };
    }
  }
}

exports.handler = async function () {
  const today = todayNZ();
  const results = [];
  try {
    const deposits = await findPendingDeposits();
    for (const pi of deposits) {
      const due = (pi.metadata || {}).balanceDueDate;
      if (!due || due > today) continue;
      results.push(await chargeBalance(pi));
    }
  } catch (err) {
    console.error('charge-balances error:', err.message);
    return { statusCode: 500, body: err.message };
  }
  console.log('charge-balances', today, JSON.stringify(results));
  return { statusCode: 200, body: JSON.stringify({ today, results }) };
};
