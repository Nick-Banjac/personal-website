# PTV proxy (Cloudflare Worker)

Signs PTV Timetable API requests server-side so the API key never reaches the
browser. The static site (nickbanjac.com) calls this Worker for train data.

## One-time setup

```bash
cd ptv-worker
npm install -g wrangler        # if you don't have it
wrangler login                 # opens the browser, log in to Cloudflare
```

## Add your PTV credentials as secrets

```bash
wrangler secret put API_ID     # paste your PTV devid, e.g. 3004284
wrangler secret put API_KEY    # paste your PTV API key (the GUID)
```

These are stored encrypted by Cloudflare — they are never committed to git.

## Deploy

```bash
wrangler deploy
```

Wrangler prints the Worker URL, e.g. `https://ptv-proxy.<your-subdomain>.workers.dev`.

## Wire the site to it

Copy that URL into `trains.js` at the top:

```js
const API_BASE = 'https://ptv-proxy.<your-subdomain>.workers.dev';
```

Then commit & push the site. Test the Worker directly in a browser:

```
https://ptv-proxy.<your-subdomain>.workers.dev/departures?board=alamein
```

## Local dev

```bash
wrangler dev        # runs the Worker locally at http://localhost:8787
```
