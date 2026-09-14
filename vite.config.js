import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Reuse the exact production headers from vercel.json so `npm run preview`
// exercises the real Content-Security-Policy locally. Read at config time
// rather than duplicated here — one source of truth, no drift.
const vercelConfig = JSON.parse(
  readFileSync(fileURLToPath(new URL('./vercel.json', import.meta.url)), 'utf8')
)

const previewHeaders = Object.fromEntries(
  (vercelConfig.headers?.find(h => h.source === '/(.*)')?.headers ?? []).map(({ key, value }) => [key, value])
)

function devApiPlugin() {
  return {
    name: 'dev-api-competitions',
    configureServer(server) {
      server.middlewares.use('/api/competitions', async (req, res) => {
        try {
          const { fetchCompetitionsFromUnstop } = await import('./api/competitions.js');
          const data = await fetchCompetitionsFromUnstop();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, count: data.length, data }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiPlugin()],
  // NOTE: applied to `preview` only, never `server`. The dev server relies on
  // inline scripts and eval for HMR, which this CSP deliberately forbids.
  preview: {
    headers: previewHeaders,
  },
})
