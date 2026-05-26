const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { tent, checkin, checkout, nights, adults, kids, name, email, phone, country, notes, extras, ref, total, voucher, voucherValue } = data;

    if (!total || total <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid total amount.' }) };
    }

    const kidsStr = kids > 0 ? ' + ' + kids + ' child' + (kids !== 1 ? 'ren' : '') : '';
    const voucherStr = voucherValue > 0 ? ' (after NZD $' + voucherValue + ' voucher credit)' : '';
    const extrasStr = extras && extras !== 'None' ? ' | Extras: ' + extras : '';
    const description =
      'Check-in: ' + checkin + '  ·  Check-out: ' + checkout +
      '  ·  ' + adults + ' adult' + (adults !== 1 ? 's' : '') + kidsStr +
      voucherStr + extrasStr;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'nzd',
            product_data: {
              name: tent + ' — ' + nights + ' night' + (nights !== 1 ? 's' : ''),
              description: description,
            },
            unit_amount: Math.round(total * 100),
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
      customer_email: email,
      metadata: {
        ref: ref,
        tent: tent,
        checkin: checkin,
        checkout: checkout,
        nights: String(nights),
        adults: String(adults),
        kids: String(kids),
        name: name,
        phone: phone || '',
        country: country || '',
        notes: notes || '',
        extras: extras || 'None',
        voucher: voucher || '',
        voucherValue: String(voucherValue || 0),
      },
      success_url: 'https://wildcanvas.nz/booking.html?success=1&ref=' + encodeURIComponent(ref) + '&email=' + encodeURIComponent(email),
cancel_url: 'https://wildcanvas.nz/booking.html?cancelled=1',
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
