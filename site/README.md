# Kuro UI

Static operator console for the Railway executor API.

## Run Locally

```bash
python3 -m http.server 8787
```

Open:

```text
http://127.0.0.1:8787
```

Use executor URL:

```text
https://kuro-production-281c.up.railway.app
```

## Deploy

Vercel:

```bash
vercel --prod
```

Cloudflare Pages:

```bash
npx wrangler pages deploy . --project-name kuro-ui
```

After deployment, add the UI origin to the executor service:

```bash
KURO_ALLOWED_ORIGINS=https://YOUR-KURO-UI.vercel.app,https://YOUR-KURO-UI.pages.dev
```

The executor key is stored only in the browser's local storage.
