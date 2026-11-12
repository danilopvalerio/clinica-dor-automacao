# Clínica da Dor — NUTES / UEPB

Aplicação web React + TypeScript + Vite para consultar fichas e prontuários de pacientes, resultados de PCS, PROMIS-29 e SF-36, e preparar relatórios PDF personalizados. Esta versão preserva os cálculos das escalas existentes e integra os registros da **Avaliação inicial**.

## Principais alterações

- Menu lateral apenas com **Página inicial** e **Pacientes**.
- Busca de pacientes por nome ou ID, com botão **Abrir ficha**.
- Ficha com identificação, informações básicas e um **seletor com todas as avaliações do paciente**, reunindo as três fontes. O seletor mostra data, momento e formulário, na ordem definida abaixo; os campos e a consulta da escala acompanham o registro selecionado.
- A tabela de **data e tipo** continua disponível em **Ver todas as avaliações cadastradas**.
- **Abrir prontuário do paciente** mostra a avaliação inicial e permite revelar/ocultar as respostas do formulário.
- No prontuário, escolha **PCS**, **PROMIS-29** ou **SF-36**, selecionando o momento/data de cada registro.
- Interpretação SF-36 reproduz a escala visual horizontal de 0 a 100 para os oito domínios. As descrições e os significados dos escores baixo/alto foram extraídos do arquivo de referências enviado, na aba **Domínios**, com base nas colunas **Descrição do Domínio (Ciconelli, 1997)**, **Escore BAIXO** e **Escore ALTO**. Os textos foram incorporados em `src/data/sf36References.json`. Não há coluna Situação nem tabela de apuração.
- Nos relatórios, tabelas de apuração detalhada foram removidas. Respostas da SF-36 e PROMIS-29 ficam recolhidas por padrão. Na SF-36, o resumo do preenchimento também fica recolhido. Para PCS, **Ver detalhes e respostas** revela os itens.
- O botão de exportação abre uma configuração para escolher **avaliação inicial**, **escalas**, **datas/momentos específicos** e, se desejado, **respostas das escalas**. A primeira página do documento inclui a ficha básica do paciente. Depois use **Imprimir / salvar em PDF** e selecione *Salvar como PDF* na janela do navegador.
- Os links das três planilhas são definidos no `.env` e carregados automaticamente ao abrir a aplicação; não há campos para digitar URLs na interface.

## Configuração

**Requisitos:** Node.js 20.19 ou superior e npm.

1. Instale as dependências com `npm install` (ou `npm ci`).
2. Abra `.env` (ou copie `.env.example` para `.env`) e preencha os três links:

```dotenv
SHEET_PCS_PROMIS_URL="https://docs.google.com/spreadsheets/d/SEU_ID_1/edit"
SHEET_SF36_URL="https://docs.google.com/spreadsheets/d/SEU_ID_2/edit"
SHEET_INITIAL_URL="https://docs.google.com/spreadsheets/d/SEU_ID_3/edit"
```

3. Execute `npm run dev` e abra o endereço indicado (porta 5173 por padrão).
4. Para verificar: `npm run typecheck`, `npm test` e `npm run build`.

Os links devem permitir **exportação XLSX pelo Google Sheets** sem interação com uma tela de login, pois o sistema usa uma rota proxy para buscar os arquivos. Reinicie o servidor ao alterar o `.env`. O arquivo `.env` não deve ser incluído no controle de versão. Na Vercel, crie essas três variáveis de ambiente nas configurações do projeto; o backend é `api/sheet.ts`.

Ao entrar, o frontend requisita as três fontes usando apenas um identificador de fonte (`combined`, `sf36`, `initial`); os links ficam no servidor e não são enviados ao JavaScript. O proxy de desenvolvimento está em `vite.config.ts`.

Para compatibilidade com a configuração anterior, o servidor também aceita
`VITE_COMBINED_SHEET_URL`, `VITE_SF36_SHEET_URL` e `VITE_INITIAL_SHEET_URL`.
As variáveis `SHEET_*` têm prioridade. O `.env` existente não precisa ser alterado
para continuar funcionando; o modelo `.env.example` usa os nomes do servidor.

Há uma área recolhível **Importar XLSX local para testes** na página inicial. Essa opção funciona sem Google Sheets e lê os arquivos apenas em memória. Não há banco de dados; os registros são recarregados das fontes a cada abertura/atualização da página.

## Planilhas e associação de pacientes

- **Clínica da Dor — PCS e PROMIS-29 (respostas)**: respostas e cálculos das duas escalas.
- **Forms SF-26 (respostas)**: formulário correspondente à SF-36, com 36 respostas e cálculo de oito domínios.
- **Clínica da Dor — Avaliação inicial (respostas)**: questionário sociodemográfico e clínico. Pode não ter coluna `Momento da avaliação` e não contém questões de escala.
- **Tab_referencias_SF-36**, aba *Domínios*: somente a referência textual da interpretação SF-36; seus textos são estáticos no JSON gerado a partir da planilha.

As fontes são associadas pelo campo **Código/ID único do paciente**. Na falta do ID, o agrupamento usa o nome normalizado; nomes divergentes entre arquivos sem um ID comum podem resultar em fichas separadas. Cada linha continua sendo uma avaliação distinta. IDs e respostas não são modificados.

- A avaliação inicial aceita os cabeçalhos antigos e novos, incluindo nascimento
  no formato novo e frequência respiratória no antigo. A ficha reconhece gênero,
  residência e grupos de perguntas por cabeçalho, sem depender de índices de coluna.
- SF-36 aceita as versões com e sem a coluna “Pontuação”.
- Datas em texto de avaliação inicial e SF-36 são lidas como **dia/mês/ano**.
  As datas numéricas dessas duas fontes preservam o dia armazenado no Excel.
  PCS/PROMIS-29 aplica a leitura **mês/dia/ano** ao valor recebido na origem.
  A importação padroniza os campos usados pelo aplicativo em **dia/mês/ano**,
  mantendo os valores recebidos em `originalFields` para consulta.
- A lista prioriza avaliações iniciais, depois acompanhamentos e reavaliações
  finais. Dentro do momento, ordena por data crescente e texto de A a Z.
  Linhas repetidas permanecem independentes. Datas ausentes ou inválidas vão
  para o fim do respectivo momento.
- As divisórias duplicadas entre questionários e grupos de respostas foram
  reduzidas a uma linha, sem alterar os cálculos.

## Cuidados com dados clínicos

**A aplicação não possui autenticação ou autorização. Não publique um deployment com dados reais de pacientes acessível pela internet sem implantar controles de acesso e proteção de dados.** As variáveis no servidor impedem a exposição direta dos URLs no bundle, mas **não protegem** a rota `/api/sheet` contra usuários não autenticados. Para uso em produção, implemente autenticação, autorização por perfil, logs de auditoria e políticas adequadas à LGPD. Os arquivos XLSX reais enviados para desenvolver esta versão **não estão incluídos** no projeto entregue.

## Validação desta versão

A suíte usa respostas fictícias e os seis conjuntos de cabeçalhos antigos/novos
em `tests/fixtures/spreadsheet-headers.json`, sem respostas de pacientes.
Os testes cobrem importação das três fontes, regressão de PCS/PROMIS/SF-36,
datas específicas por origem, registros repetidos, ordenação, configuração do
servidor, ficha clínica e apresentação dos domínios SF-36.

Execute `npm test` e `npm run build` antes de publicar. No ambiente Windows com
restrição ao carregador padrão de configuração do Vite, a compilação pode ser
executada com `npm run build -- --configLoader runner`.
