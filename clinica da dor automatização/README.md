# Clínica da Dor — UEPB — PCS

Aplicativo desktop multiplataforma em **Electron + React + TypeScript** para automatizar a apuração da **Escala de Catastrofização da Dor (PCS)**.

## O que esta versão faz

- recebe um link do Google Sheets e baixa a planilha em XLSX quando o compartilhamento permite;
- também permite abrir um `.xlsx` local;
- identifica as 13 questões da PCS pelos cabeçalhos;
- ignora o PROMIS-29 nesta versão;
- permite buscar paciente por nome/ID e selecionar a avaliação;
- calcula Ruminação, Magnificação, Desamparo e Escore Total;
- interpreta automaticamente os pontos de corte;
- valida respostas ausentes ou fora da faixa 0–4;
- gera relatório em PDF;
- possui tela de carregamento;
- possui ícones próprios para Windows, Linux e macOS;
- possui build automatizado para os três sistemas via GitHub Actions.

## Regras PCS

- Ruminação: itens 8, 9, 10 e 11; significativa em `>= 11`.
- Magnificação: itens 6, 7 e 13; significativa em `>= 5`.
- Desamparo: itens 1, 2, 3, 4, 5 e 12; significativa em `>= 13`.
- Total 0–14: catastrofização baixa.
- Total 15–29: catastrofização moderada.
- Total `>= 30`: nível clinicamente relevante.

## Desenvolvimento

Requer **Node.js 20+** e npm apenas no computador de desenvolvimento.

```bash
npm install
npm run dev
```

## Builds locais

### Windows

```bash
npm run dist:win
```

Gera:

- `Setup.exe`: instalador NSIS para uso diário;
- `Portable.exe`: executável direto sem instalação.

O Setup é `perMachine`, pede elevação de administrador, usa a pasta tradicional do Windows e permite que o usuário altere o diretório. Também cria atalhos na Área de Trabalho e Menu Iniciar.

### Linux

Em uma máquina Linux:

```bash
npm run dist:linux
```

Gera:

- `.AppImage`: versão portátil;
- `.deb`: instalador para Debian/Ubuntu e derivados.

### macOS

Em um Mac:

```bash
npm run dist:mac
```

Gera build **universal** para Intel e Apple Silicon:

- `.dmg`: distribuição/instalação;
- `.zip`: contém a aplicação para distribuição direta.

A versão macOS está configurada sem assinatura digital. Para distribuição pública sem alertas do Gatekeeper será necessário configurar Apple Developer ID e notarização.

## GitHub Actions

O arquivo abaixo já está configurado:

```text
.github/workflows/build.yml
```

Ele só executa quando iniciado manualmente no GitHub em **Actions → Build multiplataforma → Run workflow**.

São executados três jobs independentes:

- Windows → Setup + Portable;
- Ubuntu → AppImage + DEB;
- macOS → DMG + ZIP universal.

Ao final, os arquivos ficam disponíveis na seção **Artifacts** da execução.

## Recursos de build

```text
build/
├── icon.ico    # Windows
├── icon.png    # Linux
├── icon.icns   # macOS
└── splash.bmp  # splash nativa do Portable no Windows
```

## Estrutura

```text
.github/
└── workflows/
    └── build.yml
build/
├── icon.ico
├── icon.png
├── icon.icns
└── splash.bmp
electron/
├── main.ts
├── preload.ts
└── report.ts
src/
├── App.tsx
├── services/
│   ├── spreadsheet.ts
│   └── pcs.ts
└── types.ts
examples/
└── exemplo_respostas_clinica_da_dor.xlsx
package.json
```

## Google Sheets

Na versão atual, a planilha deve permitir exportação sem autenticação adicional. Planilhas privadas exigirão uma integração autenticada com a Google Sheets API em uma versão futura.

## Observação de uso clínico

O sistema automatiza a apuração das regras configuradas e não substitui avaliação clínica, diagnóstico ou julgamento profissional.
