# Clínica da Dor — NUTES / UEPB

Aplicação React + TypeScript + Vite para consultar pacientes e avaliações.

## PCS, PROMIS-29 e SF-36

- Direção visual limpa, inspirada em interfaces Apple, mantendo o azul institucional
  `#184A71`, tipografia sans-serif do sistema, superfícies planas e contraste acessível.
- Navegação por paciente ou por instrumento. Botão Voltar nas telas internas.
- Menu lateral no desktop e menu recolhível no celular.
- Os três relatórios exibem primeiro a interpretação individual dos resultados,
  seguida de apuração e respostas. A referência é `folhas_de_correção_das_escalas_.docx`.
- PCS: resumo, cálculo, ficha de apuração preenchida e 13 respostas marcadas.
- PROMIS-29 v2.1: leitura organizada das 29 respostas em oito grupos, soma dos
  quatro itens de cada domínio, conversão para T-score conforme a tabela enviada e
  classificação por domínio. Função física e participação social usam a direção
  “maior é melhor”; os demais domínios usam “maior é pior”.
- A intensidade da dor aparece em um eixo de 0 a 10 com marcações de 1 em 1,
  gradiente, rótulos “sem dor” e “pior dor imaginável” e marcador da resposta.
- SF-36 (chamada SF-26 no título do Forms): 36 respostas em 11 grupos,
  oito escores de 0 a 100, interpretação por domínio, apuração, resumo do
  preenchimento, alternativas marcadas, campos originais e impressão.
  Perguntas e alternativas seguem `Escalas e Instrumentos escolhidos.docx`.
  A apuração segue `folhas_de_correção_das_escalas_.docx`.
- Dois campos independentes de importação: PCS/PROMIS-29 e SF-36, cada um com
  link do Google Sheets e seleção de arquivos XLSX.
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

1. No início, use **Planilha 1 — PCS e PROMIS-29** e **Planilha 2 — SF-36**.
   Em cada campo, informe o link do Google Sheets ou selecione o XLSX correspondente.
   A planilha `Forms SF-26 (respostas).xlsx` é recebida no formato original.
2. Novos arquivos são adicionados. Reimportar um arquivo de mesmo nome atualiza
   seus registros, sem duplicá-los. Sincronizar um link atualiza apenas o campo
   correspondente, preservando a outra fonte. Todas as abas compatíveis são lidas.
   Planilhas colocadas no campo de outra escala são recusadas antes de substituir dados.
3. Em **Pacientes**, escolha o paciente. A ficha tem um seletor de avaliação que
   identifica data, momento, arquivo, aba e linha original.
4. Escolha uma escala. O seletor mostra apenas as avaliações que contêm essa
   escala. Quando a escala pertence a outro registro, sua data e momento são
   mostrados antes de abrir.
5. Ao abrir qualquer escala, a interpretação dos resultados aparece primeiro.
   Para PCS, use também **Ver detalhes e respostas**. Para PROMIS-29, consulte
   os T-scores, a apuração, o eixo de dor e as respostas. Para SF-36, consulte
   os oito escores, sua apuração, os 36 itens preenchidos e os campos originais.
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

## PROMIS-29

Os valores brutos de cada domínio são convertidos pela tabela do documento de
correção enviado. A escala usa quatro itens por domínio, com respostas codificadas
de acordo com o Forms; a direção invertida das perguntas de função física, sono e
participação social é respeitada. Com um item faltante (3 de 4 respondidos), a
soma pode ser estimada pela média dos respondidos multiplicada por 4; fica
sinalizada na interpretação e apuração. Com dois ou mais itens faltantes, valores
não reconhecidos ou colunas em excesso, o domínio não é convertido. Somas
estimadas fracionárias usam interpolação linear entre entradas da tabela.

Os casos TC01 a TC05 da planilha real foram usados na validação da implementação.
O total bruto apresentado é a soma dos sete domínios e da intensidade da dor para
registro interno; a interpretação clínica continua separada por domínio.

## Critérios PCS preservados

- Ruminação: itens 8, 9, 10 e 11; corte ≥ 11/16.
- Magnificação: itens 6, 7 e 13; corte ≥ 5/12.
- Desamparo: itens 1, 2, 3, 4, 5 e 12; corte ≥ 13/24.
- Total: 0–14 baixa; 15–29 moderada; ≥ 30 clinicamente relevante.
- Respostas ausentes ou inválidas impedem o cálculo, sem serem substituídas por zero.

A divergência “> 30” na última linha da ficha original foi resolvida preservando
“≥ 30”, como no quadro principal e na versão anterior.

## SF-36

Os pesos, agrupamentos e limites seguem a folha de correção DOCX enviada:
estado geral de saúde usa **01 + 11**, os itens **9a, 9d, 9e, 9h** e **11b, 11d**
são invertidos, e a resposta **Grave (5)** de Q7 tem peso **2,0**, conforme esse
documento. Q8 depende de Q7 e aplica a tabela alternativa quando Q7 está vazia.
Se Q7 = 1 e Q8 = 2–5, combinação sem regra na folha fornecida, o domínio dor
fica indisponível e a combinação é sinalizada para conferência.

Cada domínio vai de 0 (pior) a 100 (melhor). Não há total, média geral ou faixas
de gravidade. Q2 fica separada como comparação da saúde com um ano atrás.
Com pelo menos 50% dos itens do domínio válidos, respostas ausentes são estimadas
pela média dos itens ponderados respondidos, multiplicada pelo número esperado
de itens. Essa operacionalização da regra de 50% fica explícita na tela; as
respostas originais não são alteradas. Abaixo de 50%, ou com valores desconhecidos
ou duplicados, o domínio não é calculado. Os escores finais são arredondados para
uma casa decimal; o cálculo usa os valores completos antes do arredondamento.

## Referências e verificação

Para SF-36, a referência é `Escalas e Instrumentos escolhidos.docx`, comparada à
planilha real `Forms SF-26 (respostas).xlsx`. Os PDFs da SF-36 não são usados nesta
implementação. A apuração e interpretação dos três instrumentos usam
`folhas_de_correção_das_escalas_.docx`. A codificação das alternativas é preservada. Valores sem
correspondência ou colunas duplicadas não recebem marcação automática.
PCS mantém os pontos de corte existentes. PROMIS-29 mantém a tabela de conversão
e as direções dos domínios; a regra de itens faltantes agora segue a folha DOCX,
permitindo estimativa apenas com um item faltante.

Verificações realizadas:

- Compilação de produção e TypeScript.
- Importação das 19 avaliações da planilha enviada, preservando as 48 colunas.
- TC01–TC05 conferidos com soma bruta, T-scores, classificação e intensidade da dor.
- Correspondência das respostas PROMIS-29 com as alternativas dos formulários.
- Soma PCS conferida em todas as avaliações.
- SF-36 conferida na planilha real: quatro avaliações completas, 43 colunas e
  36 respostas reconhecidas em 11 grupos. A linha vazia é ignorada. Os exemplos
  de capacidade funcional (55) e dor (74) da folha foram reproduzidos nos testes.
- Os limites de classificação PCS/PROMIS, as regras de ponderação SF-36, os
  casos de dados incompletos e a ordem dos relatórios são cobertos por testes.
- Quatro registros do mesmo paciente, distribuídos entre os dois formulários,
  com identificadores independentes; reimportação sem duplicatas.
- Valores contraditórios não são marcados como uma alternativa válida.

O navegador foi verificado em desktop e celular: importação dos dois XLSX,
consulta por paciente e por escala, seleção de avaliações, 36 marcações SF-36,
regressão de PCS/PROMIS e impressão. A sincronização dos dois campos foi testada
com downloads simulados, incluindo reimportação, arquivo incorreto e falha de
download sem perda dos dados existentes. Um link real do Google não foi testado.

Para executar os testes de importação, marcações, fontes independentes e regressão
de PCS/PROMIS: `npm test`. Os testes usam dados fictícios em memória.
