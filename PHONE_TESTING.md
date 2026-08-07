# Phone testing

## LAN (the usual way)

```bash
npm run dev:phone
```

The terminal prints a **PHONE URL** and a QR code — point the iPhone camera
at it (phone and Mac must be on the same Wi-Fi). Edits hot-reload on the
phone. `npm run preview:phone` does the same with the production build.

If the page won't load: macOS System Settings → Network → Firewall may be
blocking node; allow it, or use the tunnel below.

## Add to Home Screen

Open the LAN or deployed URL in Safari → Share → **Add to Home Screen**.
You get the TSH memo icon and a standalone, address-bar-free launch
(portrait, paper status bar). The service worker only registers on
production builds, so offline play needs `preview:phone` or the deploy —
not `dev:phone`.

## On-device console (cable)

1. iPhone: Settings → Safari → Advanced → **Web Inspector** on.
2. Plug the phone into the Mac, open the page on the phone.
3. Mac Safari → **Develop → [your iPhone] → the page** — full console,
   elements, and network for the on-device session.

## Tunnel (when LAN is blocked)

```bash
npm run tunnel
```

Prints a public `https://….loca.lt` URL + QR. localtunnel shows visitors a
one-time password page — the password is your public IP, which the script
prints right next to the URL. Expect slightly laggy HMR; it's for smoke
tests, not feel tests.

## Deploy (real URL)

```bash
npx vercel login   # once
npm run deploy     # builds and ships dist/ to production
```

Config is in [vercel.json](vercel.json) (static output, SPA fallback,
no-cache on `sw.js`). Netlify works too via [netlify.toml](netlify.toml).
