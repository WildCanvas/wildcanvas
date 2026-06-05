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

    // Base image is 3602x3870px
    // Font sizes scaled for full resolution
    const svgOverlay = `<svg width="3602" height="3870" xmlns="http://www.w3.org/2000/svg">
      <text x="2280" y="3370" font-family="serif" font-size="140" fill="black">${escapeXml(code)}</text>
      <text x="2321" y="3530" font-family="serif" font-size="115" fill="black">${escapeXml(expiry)}</text>
    </svg>`;

    const outputBuffer = await sharp(imageBuffer)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
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
