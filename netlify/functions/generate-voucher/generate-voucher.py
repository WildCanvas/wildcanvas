import json
import base64
import os
from io import BytesIO

def handler(event, context):
    # Only allow POST
    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'body': 'Method Not Allowed'}

    try:
        body = json.loads(event.get('body', '{}'))
        voucher_type = int(body.get('voucherType', 1))  # 1, 2, or 3
        code         = str(body.get('code', '')).strip()
        expiry       = str(body.get('expiry', '')).strip()

        if not code or not expiry:
            return {'statusCode': 400, 'body': json.dumps({'error': 'Missing code or expiry'})}

        # PSD files live in the repo root (same level as netlify/)
        # Netlify mounts the repo at /var/task
        psd_map = {
            1: '/var/task/vouchers/Voucher_Code.psd',   # Kōwhai One Night
            2: '/var/task/vouchers/Ultimate.psd',        # Ultimate
            3: '/var/task/vouchers/Voucher_Date.psd',   # Pōhutukawa
        }

        psd_path = psd_map.get(voucher_type)
        if not psd_path or not os.path.exists(psd_path):
            return {'statusCode': 400, 'body': json.dumps({'error': f'PSD not found for type {voucher_type}'})}

        # Generate the image
        img_bytes = generate_voucher_image(psd_path, code, expiry)

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'image': base64.b64encode(img_bytes).decode('utf-8'),
                'mimeType': 'image/jpeg',
            }),
        }

    except Exception as e:
        print(f'Error: {e}')
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}


def generate_voucher_image(psd_path, code, expiry):
    from psd_tools import PSDImage
    from PIL import Image, ImageDraw, ImageFont
    import os

    psd = PSDImage.open(psd_path)
    full = psd.composite().convert('RGBA')
    bg = Image.new('RGB', (psd.width, psd.height), (255, 255, 255))
    bg.paste(full, (0, 0), full)

    # Sample background colour and paint over original text layers
    sample_colour = bg.getpixel((2280, 3250))
    draw = ImageDraw.Draw(bg)
    draw.rectangle([2270, 3230, 2500, 3330], fill=sample_colour)
    draw.rectangle([2310, 3410, 2700, 3510], fill=sample_colour)

    # Load font — bundled alongside the function
    font_dir    = os.path.dirname(__file__)
    font_path   = os.path.join(font_dir, 'PlayfairDisplay.ttf')
    font_code   = ImageFont.truetype(font_path, 90)
    font_expiry = ImageFont.truetype(font_path, 76)

    draw.text((2280, 3230), code,   font=font_code,   fill=(0, 0, 0))
    draw.text((2321, 3415), expiry, font=font_expiry, fill=(0, 0, 0))

    # Resize to email-friendly size
    out = bg.resize((1200, int(1200 * bg.height / bg.width)), Image.LANCZOS)

    buf = BytesIO()
    out.save(buf, format='JPEG', quality=92)
    return buf.getvalue()
