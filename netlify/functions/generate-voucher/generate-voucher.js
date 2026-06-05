const sharp = require('sharp');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const voucherType = parseInt(body.voucherType || 1);
    const code        = String(body.code   || '').trim();
    const expiry      = String(body.expiry || '').trim();

    if (!code || !expiry) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or expiry' }) };
    }

    const baseMap = {
      1: 'https://raw.githubusercontent.com/WildCanvas/wildcanvas/main/netlify/functions/generate-voucher/base_kowhai.jpg',
      2: 'https://raw.githubusercontent.com/WildCanvas/wildcanvas/main/netlify/functions/generate-voucher/base_ultimate.jpg',
      3: 'https://raw.githubusercontent.com/WildCanvas/wildcanvas/main/netlify/functions/generate-voucher/base_pohutukawa.jpg',
    };

    const imageUrl = baseMap[voucherType];
    if (!imageUrl) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid voucher type' }) };
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch base image: ' + imageResponse.status }) };
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Resize to 1200px wide
    const resizedBuffer = await sharp(imageBuffer)
      .resize(1200)
      .jpeg({ quality: 95 })
      .toBuffer();

    // Use sharp's native text rendering — no fonts needed
    // This uses Pango text layout built into libvips
    const codeImg = await sharp({
      text: {
        text: code,
        font: 'Sans Bold',
        fontfile: undefined,
        width: 400,
        height: 50,
        rgba: true,
        dpi: 300,
      }
    }).png().toBuffer();

    const expiryImg = await sharp({
      text: {
        text: expiry,
        font: 'Sans',
        fontfile: undefined,
        width: 400,
        height: 40,
        rgba: true,
        dpi: 300,
      }
    }).png().toBuffer();

    const outputBuffer = await sharp(resizedBuffer)
      .composite([
        { input: codeImg,   top: 1063, left: 759 },
        { input: expiryImg, top: 1130, left: 773 },
      ])
      .jpeg({ quality: 95 })
      .toBuffer();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image:    outputBuffer.toString('base64'),
        mimeType: 'image/jpeg',
      }),
    };

  } catch (err) {
    console.error('generate-voucher error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
