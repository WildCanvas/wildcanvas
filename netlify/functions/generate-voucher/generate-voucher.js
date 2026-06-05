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

    // Render each text string as its own PNG image using sharp
    // then composite onto the base at the correct position
    // Code position: x=2280, y=3230 — Expiry: x=2321, y=3415
    // Font size 300px visually matches the original PSD at full resolution

    const codeText = await sharp({
      text: {
        text: `<span foreground="black" font="300">${escapeXml(code)}</span>`,
        rgba: true,
        dpi: 72,
      }
    }).png().toBuffer();

    const expiryText = await sharp({
      text: {
        text: `<span foreground="black" font="250">${escapeXml(expiry)}</span>`,
        rgba: true,
        dpi: 72,
      }
    }).png().toBuffer();

    const outputBuffer = await sharp(imageBuffer)
      .composite([
        { input: codeText,   top: 3230, left: 2280 },
        { input: expiryText, top: 3415, left: 2321 },
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

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
