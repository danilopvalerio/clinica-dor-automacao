import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { renderReportHtml, ReportPayload } from './report';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let splashProgress = 35;

function developmentIconPath(): string | undefined {
  if (!process.env.VITE_DEV_SERVER_URL) return undefined;

  const filename = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return path.join(app.getAppPath(), 'build', filename);
}

function splashHtml() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Clínica da Dor - PCS</title>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      background: #f4f8f9;
      color: #17343a;
      user-select: none;
      overflow: hidden;
    }
    .card {
      width: 100%;
      height: 100%;
      padding: 38px 42px 34px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background:
        radial-gradient(circle at 88% 14%, rgba(55, 142, 151, .14), transparent 34%),
        linear-gradient(145deg, #ffffff 0%, #eef6f7 100%);
    }
    .mark {
      width: 52px;
      height: 52px;
      border-radius: 15px;
      display: grid;
      place-items: center;
      margin-bottom: 20px;
      background: #236a73;
      color: #fff;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: .4px;
      box-shadow: 0 10px 24px rgba(35, 106, 115, .20);
    }
    h1 {
      margin: 0;
      font-size: 26px;
      line-height: 1.2;
      letter-spacing: -.4px;
    }
    .subtitle {
      margin-top: 8px;
      color: #60757a;
      font-size: 13px;
    }
    .loading-label {
      margin-top: 31px;
      margin-bottom: 9px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      color: #52696e;
      font-size: 12px;
    }
    .track {
      height: 9px;
      width: 100%;
      overflow: hidden;
      border-radius: 999px;
      background: #d9e7e9;
    }
    .bar {
      width: 35%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #236a73, #3b9199);
      transition: width 240ms ease;
    }
    .footer {
      margin-top: 18px;
      color: #8a9b9f;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="mark">PCS</div>
    <h1>Clínica da Dor</h1>
    <div class="subtitle">Sistema de apuração da Escala de Catastrofização da Dor</div>

    <div class="loading-label">
      <span id="status">Iniciando aplicação...</span>
      <span id="percent">35%</span>
    </div>
    <div class="track"><div class="bar" id="bar"></div></div>
    <div class="footer">Aguarde enquanto o sistema é preparado</div>
  </main>

  <script>
    let progress = 35;
    const bar = document.getElementById('bar');
    const percent = document.getElementById('percent');
    const status = document.getElementById('status');

    window.setSplashProgress = (value, message) => {
      progress = Math.max(progress, Math.min(100, value));
      bar.style.width = progress + '%';
      percent.textContent = Math.round(progress) + '%';
      if (message) status.textContent = message;
    };

    // Enquanto alguma etapa real estiver demorando, a barra continua avançando
    // lentamente até 90%. Os últimos 10% só acontecem quando a janela principal
    // realmente estiver pronta.
    const timer = setInterval(() => {
      if (progress >= 90) return;
      window.setSplashProgress(Math.min(90, progress + 1));
    }, 180);

    window.addEventListener('beforeunload', () => clearInterval(timer));
  </script>
</body>
</html>`;
}

async function setSplashProgress(value: number, message: string) {
  splashProgress = Math.max(splashProgress, Math.min(100, value));
  if (!splashWindow || splashWindow.isDestroyed()) return;

  await splashWindow.webContents
    .executeJavaScript(
      `window.setSplashProgress?.(${splashProgress}, ${JSON.stringify(message)});`,
    )
    .catch(() => undefined);
}

async function createSplashWindow() {
  splashProgress = 35;

  splashWindow = new BrowserWindow({
    width: 500,
    height: 310,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    movable: true,
    show: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#f4f8f9',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(splashHtml())}`,
  );

  if (!splashWindow.isDestroyed()) {
    splashWindow.show();
    splashWindow.focus();
  }
}

async function finishSplashAndShowMainWindow() {
  await setSplashProgress(100, 'Pronto');
  await new Promise((resolve) => setTimeout(resolve, 280));

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.destroy();
  }
  splashWindow = null;
}

function createMainWindow() {
  void setSplashProgress(48, 'Criando janela principal...');

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    icon: developmentIconPath(),
    minWidth: 1050,
    minHeight: 700,
    show: false,
    backgroundColor: '#eef5f6',
    title: 'Clínica da Dor - PCS',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.once('dom-ready', () => {
    void setSplashProgress(70, 'Carregando componentes...');
  });

  mainWindow.webContents.once('did-finish-load', () => {
    void setSplashProgress(90, 'Preparando interface...');
  });

  mainWindow.once('ready-to-show', () => {
    void finishSplashAndShowMainWindow();
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    void mainWindow.loadURL(devServer);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

function googleSheetExportUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('O link informado não é uma URL válida.');
  }

  if (url.hostname !== 'docs.google.com') {
    throw new Error('Informe um link do Google Sheets (docs.google.com/spreadsheets).');
  }

  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match?.[1]) {
    throw new Error('Não foi possível identificar o ID da planilha no link.');
  }

  const spreadsheetId = match[1];
  let gid = url.searchParams.get('gid') ?? '';

  if (!gid && url.hash) {
    const hashMatch = url.hash.match(/gid=(\d+)/);
    gid = hashMatch?.[1] ?? '';
  }

  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export`);
  exportUrl.searchParams.set('format', 'xlsx');
  if (gid) exportUrl.searchParams.set('gid', gid);
  return exportUrl.toString();
}

ipcMain.handle('google-sheet:download', async (_event, input: string) => {
  const exportUrl = googleSheetExportUrl(input);
  const response = await fetch(exportUrl, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`Não foi possível baixar a planilha (HTTP ${response.status}).`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const looksLikeXlsx = bytes.length > 3 && bytes[0] === 0x50 && bytes[1] === 0x4b;

  if (!looksLikeXlsx) {
    throw new Error(
      'O Google não retornou um arquivo XLSX. Verifique se a planilha está acessível para quem possui o link. Planilhas privadas exigirão autenticação em uma versão futura.',
    );
  }

  return Array.from(bytes);
});

ipcMain.handle('report:save-pdf', async (_event, payload: ReportPayload) => {
  const safeId = (payload.patient.id || 'paciente').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Salvar relatório PCS',
    defaultPath: `Relatorio_PCS_${safeId}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (canceled || !filePath) return null;

  const reportWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    const html = renderReportHtml(payload);
    await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdf = await reportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    await fs.writeFile(filePath, pdf);
    return filePath;
  } finally {
    reportWindow.destroy();
  }
});

app.whenReady().then(async () => {
  // Primeiro mostra a splash do Electron; a splash nativa do executável portátil
  // já ficou visível durante a etapa anterior de extração dos arquivos.
  await createSplashWindow();
  createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createSplashWindow();
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
