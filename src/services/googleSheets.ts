export interface GoogleSheetTarget {
  sheetId: string;
  gid?: string;
}

export function parseGoogleSheetsUrl(value: string): GoogleSheetTarget {
  const input = value.trim();
  if (!input) throw new Error('Cole o link da planilha do Google Sheets.');

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error('O link informado não é uma URL válida do Google Sheets.');
  }

  if (url.hostname !== 'docs.google.com') {
    throw new Error('Use um link do Google Sheets em docs.google.com.');
  }

  const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!match) {
    throw new Error('Não foi possível identificar o ID da planilha no link informado.');
  }

  const sheetId = match[1];
  const gidFromQuery = url.searchParams.get('gid');
  const gidFromHash = new URLSearchParams(url.hash.replace(/^#/, '')).get('gid');
  const gid = gidFromQuery ?? gidFromHash ?? undefined;

  return { sheetId, gid };
}

export async function downloadGoogleSheet(url: string): Promise<ArrayBuffer> {
  const target = parseGoogleSheetsUrl(url);

  const response = await fetch('/api/sheet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(target),
  });

  if (!response.ok) {
    let message = 'Não foi possível acessar a planilha pelo link.';
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Mantém a mensagem padrão se a resposta não for JSON.
    }
    throw new Error(message);
  }

  return response.arrayBuffer();
}
