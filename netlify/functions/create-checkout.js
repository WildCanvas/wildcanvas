const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ── DEPOSITS (Pōhutukawa only) ─────────────────────────────────────────────
const DEPOSIT_PCT = 0.30;
const BALANCE_DAYS_BEFORE = 30;

function todayNZ() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date());
}
function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
function prettyDate(ymd) {
  return new Date(ymd + 'T00:00:00Z').toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { tent, checkin, checkout, nights, adults, kids, name, email, phone, country, notes, extras, ref, total, voucher, voucherValue,
            isGiftVoucher, giftVoucherName, giftVoucherAmount, giftVoucherType, giftRecipient, giftMessage, gclid, payPlan } = data;

    if (!total || total <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid total amount.' }) };
    }
// ── EXPERIENCE / ADD-ONS CHECKOUT ───────────────────────────────────────
if (data.type === 'experience') {
  const description = data.extrasDetail
    ? data.extrasDetail.substring(0, 490)
    : data.extras || 'Wild Canvas Experiences';

  const experienceMetadata = {
    type:          'experience',
    guest_name:    data.name          || '',
    guest_email:   data.email         || '',
    guest_phone:   data.phone         || '',
    booking_ref:   data.ref           || '',
    checkin:       data.checkin       || '',
    extras:        (data.extras       || '').substring(0, 490),
    extras_detail: (data.extrasDetail || '').substring(0, 490),
    notes:         (data.notes        || '').substring(0, 490),
    gclid:         data.gclid         || '',
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'nzd',
        product_data: {
          name: 'Wild Canvas Experiences & Add-ons',
          description: description,
        },
        unit_amount: Math.round(total * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    customer_email: data.email,
    metadata: experienceMetadata,
    payment_intent_data: {
      metadata: experienceMetadata,
    },
    success_url: 'https://wildcanvas.nz/experiences?payment=success',
    cancel_url:  'https://wildcanvas.nz/experiences?payment=cancelled',
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: session.url }),
  };
}
    const kidsStr = kids > 0 ? ' + ' + kids + ' child' + (kids !== 1 ? 'ren' : '') : '';
    const voucherStr = voucherValue > 0 ? ' (after NZD $' + voucherValue + ' voucher credit)' : '';
    const extrasStr = extras && extras !== 'None' ? ' | Extras: ' + extras : '';
    const description = isGiftVoucher
      ? 'Gift Voucher — ' + giftVoucherName + (giftRecipient ? ' · For: ' + giftRecipient : '')
      : 'Check-in: ' + checkin + '  ·  Check-out: ' + checkout +
        '  ·  ' + adults + ' adult' + (adults !== 1 ? 's' : '') + kidsStr +
        voucherStr + extrasStr;

    // Metadata shared across both the Checkout Session and the PaymentIntent
    // (PaymentIntent metadata is what the Apps Script webhook reads)
    const sharedMetadata = isGiftVoucher ? {
      ref:               ref,
      name:              name,
      phone:             phone || '',
      isGiftVoucher:     'true',
      giftVoucherType:   String(giftVoucherType   || ''),
      giftVoucherName:   giftVoucherName           || '',
      giftVoucherAmount: String(giftVoucherAmount  || ''),
      giftRecipient:     giftRecipient             || '',
      giftMessage:       (giftMessage              || '').slice(0, 500),
      buyerName:         name                      || '',
      buyerEmail:        email                     || '',
      buyerPhone:        phone                     || '',
      gclid:             gclid                     || '',
    } : {
      ref:          ref,
      tent:         tent,
      checkin:      checkin,
      checkout:     checkout,
      nights:       String(nights),
      adults:       String(adults),
      kids:         String(kids),
      name:         name,
      phone:        phone || '',
      country:      country || '',
      notes:        notes || '',
      extras:       extras || 'None',
      voucher:      voucher || '',
      voucherValue: String(voucherValue || 0),
      isGiftVoucher: 'false',
      gclid:        gclid || '',
    };

    // ── Deposit option: only Pōhutukawa, only when check-in is more than 30 days away ──
    const isDeposit = !isGiftVoucher &&
      payPlan === 'deposit' &&
      /hutukawa/i.test(tent || '') &&
      checkin && daysBetween(todayNZ(), checkin) > BALANCE_DAYS_BEFORE;

    const totalCents   = Math.round(total * 100);
    const depositCents = isDeposit ? Math.round(totalCents * DEPOSIT_PCT) : totalCents;
    const balanceCents = totalCents - depositCents;
    const balanceDue   = isDeposit ? addDays(checkin, -BALANCE_DAYS_BEFORE) : '';

    if (isDeposit) {
      Object.assign(sharedMetadata, {
        paymentPlan:    'deposit',
        bookingTotal:   (totalCents / 100).toFixed(2),
        depositAmount:  (depositCents / 100).toFixed(2),
        balanceAmount:  (balanceCents / 100).toFixed(2),
        balanceDueDate: balanceDue,
        balanceStatus:  'pending',
        email:          email || '',
      });
    }

    const lineName = isGiftVoucher
      ? 'Wild Canvas Gift Voucher — ' + giftVoucherName
      : tent + ' — ' + nights + ' night' + (nights !== 1 ? 's' : '') + (isDeposit ? ' (30% deposit)' : '');
    const lineDescription = isDeposit
      ? (description + '  ·  Total NZD $' + (totalCents / 100).toFixed(2) +
         '  ·  Balance NZD $' + (balanceCents / 100).toFixed(2) + ' charged ' + prettyDate(balanceDue)).slice(0, 490)
      : description;

    const paymentIntentData = { metadata: sharedMetadata };
    if (isDeposit) paymentIntentData.setup_future_usage = 'off_session';

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: lineName,
              description: lineDescription,
            },
            unit_amount: depositCents,
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      customer_email: email,
      metadata: sharedMetadata,
      // Copy metadata to the PaymentIntent — this is what the Apps Script webhook receives
      payment_intent_data: paymentIntentData,
      success_url: isGiftVoucher
        ? 'https://wildcanvas.nz/gift.html?success=1&ref=' + encodeURIComponent(ref)
        : 'https://wildcanvas.nz/booking.html?success=1&ref=' + encodeURIComponent(ref) + '&email=' + encodeURIComponent(email),
      cancel_url: isGiftVoucher
        ? 'https://wildcanvas.nz/gift.html?cancelled=1'
        : 'https://wildcanvas.nz/booking.html?cancelled=1',
    };

    if (isDeposit) {
      // Save the card to a Stripe customer so the balance can be charged later
      sessionParams.customer_creation = 'always';
      sessionParams.custom_text = {
        submit: {
          message: 'By paying, you authorise Wild Canvas to charge the remaining balance of NZD $' +
            (balanceCents / 100).toFixed(2) + ' to this card on ' + prettyDate(balanceDue) +
            ', 30 days before check-in.',
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Stripe error:', err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
