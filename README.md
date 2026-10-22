# Clínica da Dor — NUTES / UEPB

Aplicação web React + TypeScript + Vite para consultar fichas e prontuários de pacientes, resultados de PCS, PROMIS-29 e SF-36, e preparar relatórios PDF personalizados. Esta versão preserva os cálculos das escalas existentes e integra os registros da **Avaliação inicial**.

## Principais alterações

- Menu lateral apenas com **Página inicial** e **Pacientes**.
- Busca de pacientes por nome ou ID, com botão **Abrir ficha**.
- Ficha com identificação, informações básicas e tabela contendo apenas **data e tipo** das avaliações.
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

Há uma área recolhível **Importar XLSX local para testes** na página inicial. Essa opção funciona sem Google Sheets e lê os arquivos apenas em memória. Não há banco de dados; os registros são recarregados das fontes a cada abertura/atualização da página.

## Planilhas e associação de pacientes

- **Clínica da Dor — PCS e PROMIS-29 (respostas)**: respostas e cálculos das duas escalas.
- **Forms SF-26 (respostas)**: formulário correspondente à SF-36, com 36 respostas e cálculo de oito domínios.
- **Clínica da Dor — Avaliação inicial (respostas)**: questionário sociodemográfico e clínico. Pode não ter coluna `Momento da avaliação` e não contém questões de escala.
- **Tab_referencias_SF-36**, aba *Domínios*: somente a referência textual da interpretação SF-36; seus textos são estáticos no JSON gerado a partir da planilha.

As fontes são associadas pelo campo **Código/ID único do paciente**. Na falta do ID, o agrupamento usa o nome normalizado; nomes divergentes entre arquivos sem um ID comum podem resultar em fichas separadas. Cada linha continua sendo uma avaliação distinta. IDs e respostas não são modificados.

## Cuidados com dados clínicos

**A aplicação não possui autenticação ou autorização. Não publique um deployment com dados reais de pacientes acessível pela internet sem implantar controles de acesso e proteção de dados.** As variáveis no servidor impedem a exposição direta dos URLs no bundle, mas **não protegem** a rota `/api/sheet` contra usuários não autenticados. Para uso em produção, implemente autenticação, autorização por perfil, logs de auditoria e políticas adequadas à LGPD. Os arquivos XLSX reais enviados para desenvolver esta versão **não estão incluídos** no projeto entregue.

## Validação desta versão

A estrutura das quatro planilhas foi inspecionada. Em um teste de importação usando cabeçalhos e linhas das planilhas fornecidas, as três fontes produziram **13 registros de avaliação inicial, 10 de PCS/PROMIS-29 e 13 de SF-36**, associados em 13 grupos de pacientes, com 8 deles tendo dados clínicos iniciais e avaliações de escala. Foram exercitados os cálculos das três escalas e realizada uma verificação estática da sintaxe TypeScript/JSX e dos tipos com declarações auxiliares.

**Limitação do ambiente de entrega:** não foi possível executar o `npm ci`, os testes automatizados oficiais nem a compilação de produção nesta sessão, porque as dependências npm não puderam ser baixadas (falha de resolução de rede). O projeto inclui os testes adaptados para o novo formato visual e um teste adicional de importação da avaliação inicial; execute `npm ci && npm test && npm run build` em um ambiente com acesso ao registro npm antes de publicar.
