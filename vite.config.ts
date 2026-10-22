import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const SHEET_ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;
const GID_PATTERN = /^\d+$/;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function googleSheetsDevProxy(env: Record<string,string>): Plugin {
  return {
    name: 'google-sheets-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/sheet')) return next();

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Use POST para acessar esta rota.' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { source?: unknown };
          const names = { combined: 'SHEET_PCS_PROMIS_URL', sf36: 'SHEET_SF36_URL', initial: 'SHEET_INITIAL_URL' } as const;
          const source = typeof payload.source === 'string' ? payload.source : '';
          if (!(source in names)) {
            res.statusCode = 400;res.setHeader('Content-Type', 'application/json; charset=utf-8');res.end(JSON.stringify({ error: 'Fonte não reconhecida.' }));return;
          }
          const configured = env[names[source as keyof typeof names]];
          if (!configured) {
            res.statusCode = 503;res.setHeader('Content-Type', 'application/json; charset=utf-8');res.end(JSON.stringify({ error: `Fonte ${source} não configurada no .env.` }));return;
          }
          const url = new URL(configured);
          if (url.hostname !== 'docs.google.com') throw new Error('Origem inválida');
          const sheetId = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)?.[1] || '';
          const gid = url.searchParams.get('gid') || new URLSearchParams(url.hash.replace(/^#/, '')).get('gid') || '';
          if (!SHEET_ID_PATTERN.test(sheetId) || (gid && !GID_PATTERN.test(gid))) {
            res.statusCode = 400;res.setHeader('Content-Type', 'application/json; charset=utf-8');res.end(JSON.stringify({ error: 'Link configurado inválido.' }));return;
          }

          const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
          exportUrl.searchParams.set('format', 'xlsx');
          if (gid) exportUrl.searchParams.set('gid', gid);

          const googleResponse = await fetch(exportUrl, { redirect: 'follow', cache: 'no-store' });
          const contentType = googleResponse.headers.get('content-type') ?? '';

          if (!googleResponse.ok || contentType.includes('text/html')) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                error: 'A planilha não pôde ser exportada. Verifique as permissões ou carregue o arquivo XLSX.',
              }),
            );
            return;
          }

          const bytes = Buffer.from(await googleResponse.arrayBuffer());
          if (!bytes.length || bytes.length > MAX_FILE_SIZE) {
            res.statusCode = bytes.length > MAX_FILE_SIZE ? 413 : 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Arquivo vazio ou maior que 20 MB.' }));
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
          res.end(bytes);
        } catch {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Falha ao consultar o Google Sheets.' }));
        }
      });
    },
  };
}

export default defineConfig(({mode}) => ({
  plugins: [react(), googleSheetsDevProxy(loadEnv(mode,process.cwd(),''))],
  server: { port: 5173 },
}));
