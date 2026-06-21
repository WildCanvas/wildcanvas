const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { tent, checkin, checkout, nights, adults, kids, name, email, phone, country, notes, extras, ref, total, voucher, voucherValue,
            isGiftVoucher, giftVoucherName, giftVoucherAmount, giftVoucherType, giftRecipient, giftMessage, gclid } = data;

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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: isGiftVoucher
                ? 'Wild Canvas Gift Voucher — ' + giftVoucherName
                : tent + ' — ' + nights + ' night' + (nights !== 1 ? 's' : ''),
              description: description,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      customer_email: email,
      metadata: sharedMetadata,
      // Copy metadata to the PaymentIntent — this is what the Apps Script webhook receives
      payment_intent_data: {
        metadata: sharedMetadata,
      },
      success_url: isGiftVoucher
        ? 'https://wildcanvas.nz/gift.html?success=1&ref=' + encodeURIComponent(ref)
        : 'https://wildcanvas.nz/booking.html?success=1&ref=' + encodeURIComponent(ref) + '&email=' + encodeURIComponent(email),
      cancel_url: isGiftVoucher
        ? 'https://wildcanvas.nz/gift.html?cancelled=1'
        : 'https://wildcanvas.nz/booking.html?cancelled=1',
    });

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
