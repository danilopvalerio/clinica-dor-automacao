const SHEET_ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;
const GID_PATTERN = /^\d+$/;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

interface SheetRequestBody {
  source?: unknown;
}

export async function POST(request: Request) {
  let body: SheetRequestBody;
  try {
    body = (await request.json()) as SheetRequestBody;
  } catch {
    return jsonError('Requisição inválida.', 400);
  }

  const names = {
    combined: 'SHEET_PCS_PROMIS_URL',
    sf36: 'SHEET_SF36_URL',
    initial: 'SHEET_INITIAL_URL',
  } as const;
  const source = typeof body.source === 'string' ? body.source : '';
  if (!(source in names)) return jsonError('Fonte não reconhecida.', 400);
  const configured = process.env[names[source as keyof typeof names]];
  if (!configured) return jsonError(`Fonte ${source} não configurada no ambiente do servidor.`, 503);
  let url:URL;
  try{url = new URL(configured);}catch{return jsonError('Link da fonte inválido no servidor.', 500);}
  if (url.hostname !== 'docs.google.com') return jsonError('O link da fonte deve ser do Google Sheets.', 500);
  const sheetId=url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)?.[1]||'';
  const gid=url.searchParams.get('gid')||new URLSearchParams(url.hash.replace(/^#/, '')).get('gid')||'';
  if (!SHEET_ID_PATTERN.test(sheetId) || (gid && !GID_PATTERN.test(gid))) return jsonError('Link ou aba configurados incorretamente.', 500);

  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
  exportUrl.searchParams.set('format', 'xlsx');
  if (gid) exportUrl.searchParams.set('gid', gid);

  try {
    const googleResponse = await fetch(exportUrl, {
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream',
      },
    });

    if (!googleResponse.ok) {
      return jsonError(
        'O Google não liberou o download da planilha. Verifique as permissões ou use o arquivo XLSX baixado.',
        googleResponse.status === 404 ? 404 : 403,
      );
    }

    const contentType = googleResponse.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      return jsonError(
        'A planilha exige autenticação do Google. Use um link que permita exportação ou carregue o arquivo XLSX.',
        403,
      );
    }

    const bytes = await googleResponse.arrayBuffer();
    if (bytes.byteLength === 0) {
      return jsonError('O Google retornou um arquivo vazio.', 502);
    }
    if (bytes.byteLength > MAX_FILE_SIZE) {
      return jsonError('A planilha excede o limite de 20 MB desta aplicação.', 413);
    }

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="respostas.xlsx"',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return jsonError('Falha de comunicação com o Google Sheets. Tente novamente ou use o XLSX local.', 502);
  }
}

export function GET() {
  return jsonError('Use uma requisição POST para acessar esta rota.', 405);
}

function jsonError(message: string, status: number) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      },
    },
  );
}
