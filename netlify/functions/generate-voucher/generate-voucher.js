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

    // Get actual image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const W = metadata.width;
    const H = metadata.height;

    // sharp renders SVG at 72dpi into the image pixel space
    // Scale font size proportionally to image width
    // At 3602px wide, we want roughly the same visual size as PIL's 90pt
    // PIL 90pt at 72dpi = 90px, but at full res this needs to be ~300px SVG
    const codeSize   = Math.round(W * 0.083);  // ~300px at 3602px wide
    const expirySize = Math.round(W * 0.069);  // ~250px at 3602px wide
    const codeY      = Math.round(H * 0.850);  // ~3290px
    const expiryY    = Math.round(H * 0.895);  // ~3465px

    const svgOverlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <text x="${Math.round(W * 0.633)}" y="${codeY}"   font-family="serif" font-size="${codeSize}"   fill="black">${escapeXml(code)}</text>
      <text x="${Math.round(W * 0.644)}" y="${expiryY}" font-family="serif" font-size="${expirySize}" fill="black">${escapeXml(expiry)}</text>
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
