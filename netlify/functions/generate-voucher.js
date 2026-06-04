const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

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
      1: 'base_kowhai.jpg',
      2: 'base_ultimate.jpg',
      3: 'base_pohutukawa.jpg',
    };

    const baseName = baseMap[voucherType];
    if (!baseName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid voucher type' }) };
    }

    // In Netlify functions, the repo root is at /var/task
    const basePath = path.join(__dirname, baseName);
    if (!fs.existsSync(basePath)) {
      return { statusCode: 500, body: JSON.stringify({ error: `Base image not found: ${basePath}` }) };
    }

    // Full resolution is 3602x3870 — text positions tuned to match
    // Code at (2280, 3230), Expiry at (2321, 3415)
    // SVG overlay lets us place text precisely at any position
    const fontSize = 90;
    const expirySize = 76;

    const svgOverlay = `<svg width="3602" height="3870" xmlns="http://www.w3.org/2000/svg">
      <style>
        .code { font-family: serif; font-size: ${fontSize}px; fill: black; }
        .expiry { font-family: serif; font-size: ${expirySize}px; fill: black; }
      </style>
      <text x="2280" y="${3230 + fontSize}" class="code">${escapeXml(code)}</text>
      <text x="2321" y="${3415 + expirySize}" class="expiry">${escapeXml(expiry)}</text>
    </svg>`;

    const outputBuffer = await sharp(basePath)
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      }])
      .jpeg({ quality: 95 })
      .toBuffer();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: outputBuffer.toString('base64'),
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
