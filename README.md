# Plat & Record

A real-estate price explorer for Romania, built with React + Vite.

## 1. Install dependencies

You'll need [Node.js](https://nodejs.org) (v18 or newer) installed on your computer.

```
npm install
```

## 2. Test it locally (optional)

```
npm run dev
```

This opens the app at `http://localhost:5173` so you can check it before deploying.

## 3. Build it for the web

```
npm run build
```

This creates a `dist/` folder with the finished, ready-to-host website.

## 4. Put it online (pick one — all free)

### Easiest: Netlify Drop (no account, no command line needed for this step)
1. Go to https://app.netlify.com/drop
2. Drag your `dist` folder onto the page
3. You get a live URL immediately (e.g. `random-name-123.netlify.app`)
4. Optional: make a free Netlify account afterward to keep the site permanently and set a custom name

### Also easy: Vercel
1. Go to https://vercel.com and sign up (free)
2. Install the CLI: `npm install -g vercel`
3. Run `vercel` in this project folder and follow the prompts
4. Every time you run `vercel --prod`, it redeploys your latest build

### If you want it on GitHub Pages
1. Push this project to a GitHub repository
2. Run `npm install --save-dev gh-pages`
3. Add `"homepage": "https://<your-username>.github.io/<repo-name>"` to `package.json`
4. Add to `package.json` scripts: `"deploy": "gh-pages -d dist"`
5. Run `npm run build && npm run deploy`

## Custom domain (optional)

Netlify and Vercel both let you attach a domain you own for free — just buy the
domain anywhere (Namecheap, Google Domains, etc.) and point its DNS at whichever
host you pick, following their dashboard instructions.
