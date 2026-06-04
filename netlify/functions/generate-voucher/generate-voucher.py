import json
import base64
import os
from io import BytesIO

def handler(event, context):
    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'body': 'Method Not Allowed'}

    try:
        body = json.loads(event.get('body', '{}'))
        voucher_type = int(body.get('voucherType', 1))
        code         = str(body.get('code', '')).strip()
        expiry       = str(body.get('expiry', '')).strip()

        if not code or not expiry:
            return {'statusCode': 400, 'body': json.dumps({'error': 'Missing code or expiry'})}

        # Base JPGs live in the vouchers/ folder at the repo root
        base_map = {
            1: '/var/task/vouchers/base_kowhai.jpg',
            2: '/var/task/vouchers/base_ultimate.jpg',
            3: '/var/task/vouchers/base_pohutukawa.jpg',
        }

        base_path = base_map.get(voucher_type)
        if not base_path or not os.path.exists(base_path):
            return {'statusCode': 400, 'body': json.dumps({'error': f'Base image not found for type {voucher_type}'})}

        img_bytes = generate_voucher_image(base_path, code, expiry)

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


def generate_voucher_image(base_path, code, expiry):
    from PIL import Image, ImageDraw, ImageFont

    img = Image.open(base_path).convert('RGB')
    draw = ImageDraw.Draw(img)

    font_dir    = os.path.dirname(__file__)
    font_path   = os.path.join(font_dir, 'PlayfairDisplay.ttf')
    font_code   = ImageFont.truetype(font_path, 90)
    font_expiry = ImageFont.truetype(font_path, 76)

    draw.text((2280, 3230), code,   font=font_code,   fill=(0, 0, 0))
    draw.text((2321, 3415), expiry, font=font_expiry, fill=(0, 0, 0))

    buf = BytesIO()
    img.save(buf, format='JPEG', quality=95)
    return buf.getvalue()
