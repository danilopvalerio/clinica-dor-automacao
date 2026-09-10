# Clínica da Dor — NUTES / UEPB

Aplicação React + TypeScript + Vite para consultar pacientes e avaliações.

## Versão 0.4 — interface e formulários

- Direção editorial, mantendo o azul institucional `#184A71`: títulos em Georgia,
  texto em Arial, divisórias, listas e superfícies planas, sem sombras ou gradientes.
- Navegação por paciente ou por instrumento. Botão Voltar nas telas internas.
- Menu lateral no desktop e menu recolhível no celular.
- PCS: resumo, cálculo, ficha de apuração preenchida e 13 respostas marcadas.
- PROMIS-29: consulta das 29 respostas em oito grupos, na ordem do Forms:
  função física, ansiedade, depressão, fadiga, sono, atividades sociais,
  interferência da dor e intensidade da dor.
- SF-36: consulta das 36 respostas nos 11 blocos de perguntas do Forms.
  O nome foi corrigido de SF-26 para SF-36 conforme o PDF enviado.
- PROMIS-29 e SF-36 não calculam escores nesta versão. Os números das alternativas
  reproduzem os rótulos do formulário e não são resultados calculados.
- Respostas sem correspondência exata são exibidas como registradas, sem inventar
  uma marcação. Perguntas ausentes são indicadas e não são preenchidas.
- Os campos originais continuam acessíveis em uma seção recolhível.
- Impressão e salvamento em PDF pelo navegador, com identificação da avaliação.

## Executar

Requer Node.js 20.19+ e npm.

```bash
npm install
npm run dev
```

Abra o endereço informado pelo Vite. Para compilar:

```bash
npm run build
```

## Carregar e escolher avaliações

1. No início, clique em **Abrir arquivo XLSX**. Você pode selecionar os arquivos
   de PCS/PROMIS-29 e SF-36 juntos ou carregá-los um de cada vez.
2. Novos arquivos são adicionados. Reimportar um arquivo de mesmo nome atualiza
   seus registros, sem duplicá-los. Todas as abas compatíveis são lidas.
3. Em **Pacientes**, escolha o paciente. A ficha tem um seletor de avaliação que
   identifica data, momento, arquivo, aba e linha original.
4. Escolha uma escala. O seletor mostra apenas as avaliações que contêm essa
   escala. Quando a escala pertence a outro registro, sua data e momento são
   mostrados antes de abrir.
5. Para PCS, use **Ver detalhes e respostas**. As respostas PROMIS do mesmo
   registro também aparecem organizadas nessa tela.
6. Pelo menu **Escalas**, também é possível escolher o instrumento primeiro e
   depois o paciente e a avaliação.

Cada linha continua independente, mesmo quando o paciente e a data coincidem.
O agrupamento usa o Código/ID; use a mesma identificação nos dois formulários.
Na ausência do ID, usa o nome; a ausência continua sinalizada no registro.

Os dados ficam somente na memória da página. Atualizar ou fechar a página exige
uma nova importação. **Limpar importação** retira os dados carregados da tela,
sem alterar os arquivos originais. Planilhas reais não acompanham o projeto.

## Google Sheets e Vercel

A sincronização por link continua disponível quando o Google permite exportar
sem autenticação adicional. Links privados podem exigir o XLSX baixado.
O proxy de desenvolvimento está em `vite.config.ts`; a função para Vercel está
em `api/sheet.ts`. Importe o repositório na Vercel com preset Vite.

Não há banco de dados nem autenticação de usuários nesta versão.
`npm run preview` serve a compilação estática; use `npm run dev` ou a Vercel para
ter a rota de sincronização do Google Sheets.

## Critérios PCS preservados

- Ruminação: itens 8, 9, 10 e 11; corte ≥ 11/16.
- Magnificação: itens 6, 7 e 13; corte ≥ 5/12.
- Desamparo: itens 1, 2, 3, 4, 5 e 12; corte ≥ 13/24.
- Total: 0–14 baixa; 15–29 moderada; ≥ 30 clinicamente relevante.
- Respostas ausentes ou inválidas impedem o cálculo, sem serem substituídas por zero.

A divergência “> 30” na última linha da ficha original foi resolvida preservando
“≥ 30”, como no quadro principal e na versão anterior.

## Referências e verificação

A organização e as alternativas foram conferidas nos PDFs `pcs-promis.pdf` e
`sf-36.pdf` enviados pelo usuário. A exibição reproduz esses formulários, inclusive
a numeração invertida de algumas alternativas; não altera sua codificação.

Verificações realizadas:

- Compilação de produção e TypeScript.
- Importação das 14 avaliações da planilha enviada, preservando as 48 colunas.
- Correspondência das 406 respostas PROMIS-29 com as alternativas dos formulários.
- Soma PCS conferida em todas as avaliações.
- SF-36 testada com dados fictícios e cabeçalhos baseados no PDF: 36 respostas em
  11 grupos. Não foi fornecida uma planilha de respostas real dessa escala.
- Quatro registros do mesmo paciente, distribuídos entre os dois formulários,
  com identificadores independentes; reimportação sem duplicatas.
- Valores contraditórios não são marcados como uma alternativa válida.

O layout responsivo foi implementado em CSS; não houve teste visual em navegador
nesta entrega. A sincronização com um link real do Google não foi testada.
