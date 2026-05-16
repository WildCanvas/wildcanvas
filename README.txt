# Wild Canvas — Website Files
## Netlify Deployment Guide

---

### FOLDER STRUCTURE
Put all these files in ONE folder on your computer, then drag the whole folder to Netlify.

```
wildcanvas/
│
├── index.html                ← Homepage (rename wildcanvas_home.html to this)
├── kowhai.html
├── pohutukawa.html
├── experiences.html
├── catering.html
├── massages.html
├── gift.html                 ← Gift vouchers (rename wildcanvas_gift_vouchers.html)
├── about.html                ← About (rename wildcanvas_about.html)
├── faq.html
├── media.html
├── waitomo.html
├── contact.html
├── 404.html
├── sitemap.xml
├── robots.txt
├── _redirects                ← Netlify redirects (no extension, important!)
│
├── P22_Mackinac.otf
├── Fontspring-DEMO-P22Mackinac-Bold.otf
├── Baton-MediumItalic.otf
├── Wild_Canvas_Logo_Black.png
├── nz-herald-logo.png
├── logo-kiaora.png
├── life-leisure.png
├── fashion-quarterly.png
└── qualmark.png
```

---

### FILE RENAMES NEEDED
Before uploading, rename these files:
- `wildcanvas_home.html`         → `index.html`
- `wildcanvas_kowhai.html`       → `kowhai.html`
- `wildcanvas_pohutukawa.html`   → `pohutukawa.html`
- `wildcanvas_experiences.html`  → `experiences.html`
- `wildcanvas_catering.html`     → `catering.html`
- `wildcanvas_massages.html`     → `massages.html`
- `wildcanvas_gift_vouchers.html`→ `gift.html`
- `wildcanvas_about.html`        → `about.html`
- `wildcanvas_faq.html`          → `faq.html`
- `wildcanvas_media.html`        → `media.html`
- `wildcanvas_waitomo.html`      → `waitomo.html`
- `wildcanvas_contact.html`      → `contact.html`

---

### HOW TO DEPLOY TO NETLIFY (DRAFT)

1. Go to https://netlify.com and log in
2. Click "Add new site" → "Deploy manually"
3. Drag your wildcanvas/ folder into the drop zone
4. Netlify gives you a URL like: https://wildcanvas-abc123.netlify.app
5. That's your draft — click through and test everything!

To update after making changes:
- Go to your site in Netlify dashboard
- Drag the updated folder again (or just the changed files)
- Takes about 30 seconds

---

### STRIPE LINKS TO ADD
Before going live, create these Payment Links in your Stripe dashboard
and replace the placeholder URLs in the relevant HTML files:

Search for "REPLACE_WITH_" in each file to find all placeholders.

| Item                          | File(s)                          | Price  |
|-------------------------------|----------------------------------|--------|
| Kōwhai One Night Stay         | gift.html                        | $590   |
| Ultimate One Night Stay       | gift.html                        | $1,159 |
| Pōhutukawa One Night Stay     | gift.html                        | $1,635 |
| Antipasto Platter             | experiences.html, catering.html  | $89    |
| Ready-to-Cook Pizza           | experiences.html, catering.html  | $44    |
| Gourmet Dinner for Two        | experiences.html, catering.html  | $170   |
| Back, Neck and Shoulder       | experiences.html, massages.html  | $120   |
| Full Body Massage             | experiences.html, massages.html  | $150   |

---

### CONTACT FORM
Add `data-netlify="true"` to the <form> tag in contact.html.
Netlify will then email you every submission for free.
Change the <form> line to:
<form id="contactForm" data-netlify="true" name="contact" novalidate>

---

### POINTING YOUR DOMAIN (when ready to go live)
1. In Netlify: Site settings → Domain management → Add custom domain → wildcanvas.nz
2. Netlify shows you DNS records to add
3. Log into your domain registrar and update the DNS
4. Takes up to 24hrs to propagate — Wix stays live during this time
5. Once live, submit sitemap to Google Search Console:
   https://search.google.com/search-console
   Add property → Submit sitemap → https://www.wildcanvas.nz/sitemap.xml

---

### TAWK.TO LIVE CHAT (to add later)
1. Sign up at tawk.to
2. Get your embed script
3. Paste it before </body> in every HTML file
   (easiest to do a find-and-replace across all files)

---

### UPDATING PHOTOS
Every photo is an <img src="..."> tag.
Use Ctrl+F (Windows) or Cmd+F (Mac) in any text editor to find and replace image URLs.
Keep your own photos in an images/ folder for cleanliness.
