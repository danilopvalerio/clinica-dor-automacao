# Clínica da Dor — UEPB — PCS (Web)

Aplicação web responsiva em React + TypeScript + Vite para apuração da Escala de Catastrofização da Dor (PCS).

## Funcionalidades

- Importação de `.xlsx`/`.xls` diretamente no navegador.
- Sincronização por link do Google Sheets quando a planilha permite exportação sem autenticação adicional.
- Identificação automática das 13 questões da PCS pelos cabeçalhos do Google Forms.
- Agrupamento por paciente e múltiplas avaliações.
- Cálculo de Ruminação, Magnificação, Desamparo e Escore Total.
- Interpretação automática dos pontos de corte.
- Layout responsivo para desktop, tablet e celular.
- Impressão/Salvar como PDF pelo navegador.
- Favicon/ícone do projeto já configurado.
- Função serverless `/api/sheet` pronta para Vercel, sem banco de dados.

## Regras PCS configuradas

- Ruminação: itens 8, 9, 10 e 11; significativo quando `>= 11`.
- Magnificação: itens 6, 7 e 13; significativo quando `>= 5`.
- Desamparo: itens 1, 2, 3, 4, 5 e 12; significativo quando `>= 13`.
- Escore total: 0–14 baixa; 15–29 moderada; >= 30 clinicamente relevante.

## Requisitos locais

- Node.js 20.19+ (Node 22 ou 24 também funciona).
- npm.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente `http://localhost:5173`.

A rota de sincronização do Google Sheets também funciona no `npm run dev`, porque o `vite.config.ts` contém um proxy local equivalente à função da Vercel.

## Build local

```bash
npm run build
npm run preview
```

## Vercel

O projeto contém `vercel.json` e a função `api/sheet.ts`. Ao importar o repositório na Vercel, o preset Vite deve ser detectado e o deploy pode ser feito sem variáveis de ambiente.

## Observação sobre links restritos

A aplicação não usa OAuth do Google. Se o link depender exclusivamente da sessão autenticada do usuário, a exportação via servidor pode ser negada pelo Google. Nesse caso, baixe a planilha como XLSX e use a opção de arquivo local.

## Dados

Não há banco de dados nesta versão. Evite versionar dados reais de pacientes. O `.gitignore` bloqueia planilhas por padrão e libera apenas o arquivo fictício em `examples/`.
