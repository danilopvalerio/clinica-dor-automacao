const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const XLSX = require('xlsx');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Load TypeScript in memory without producing a second build or requiring
// test-only packages. Fixture workbooks contain only fictitious patients.
const modules = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  if (modules.has(filename)) return modules.get(filename).exports;
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  const module = { exports: {} };
  modules.set(filename, module);
  const javascript = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', javascript)(id => {
    if (!id.startsWith('.')) return require(id);
    const base = path.resolve(path.dirname(filename), id);
    const dependency = [base, `${base}.ts`, `${base}.tsx`].find(candidate => fs.existsSync(candidate));
    return load(path.relative(path.resolve(__dirname, '..'), dependency));
  }, module, module.exports);
  return module.exports;
}

const { parseSpreadsheet, mergeSpreadsheet, groupPatients } = load('src/services/spreadsheet.ts');
const { FORM_GROUPS, fieldScale, normalize, organizedResponses, selectedChoice } = load('src/services/forms.ts');
const { SF36_SECTIONS } = load('src/services/sf36Form.ts');
const { configuredSheetUrls, SOURCE_KINDS, validateSource } = load('src/services/sources.ts');
const { syncSources } = load('src/services/syncSources.ts');
const { PatientFields } = load('src/PatientFields.tsx');
const { evaluationLabel } = load('src/services/forms.ts');
const spreadsheetHeaders = require('./fixtures/spreadsheet-headers.json');
const { calculatePcs } = load('src/services/pcs.ts');
const { calculatePromis29, classifyPromisTScore } = load('src/services/promis29.ts');
const { calculateSf36 } = load('src/services/sf36.ts');
const { Sf36Report } = load('src/Sf36Report.tsx');
const { PromisReport } = load('src/PromisReport.tsx');
const { EvaluationReport } = load('src/EvaluationReport.tsx');

const metadata = {
  'Carimbo de data/hora': '14/10/2026 10:30:00', 'Pontuação': '0',
  'Código/ID único do paciente': 'TESTE-01', 'Nome completo do paciente': 'Paciente fictício',
  'Data da avaliação': '14/10/2026', 'Extensionista/pesquisador(a) responsável pela coleta': 'Equipe de teste',
  'Momento da avaliação': 'Linha de base (pré-intervenção)',
};
function sfRow() {
  const fields = { ...metadata };
  SF36_SECTIONS.forEach((section, index) => section.questions.forEach((item, itemIndex) => {
    const header = section.intro ? `${section.intro}\n [${item.label}]` : item.label;
    const options = FORM_GROUPS.sf36[index].options(header);
    const choice = options[itemIndex % options.length];
    fields[header] = `${choice.label} (${choice.code})`;
  }));
  return fields;
}
function combinedRow() {
  const fields = { ...metadata, 'Data da avaliação': '10/14/2026' };
  for (let i = 1; i <= 13; i++) fields[`Quando estou sentindo dor [${i}. Item fictício ${i}]`] = '1 - Em um grau leve';
  let item = 1;
  for (const group of FORM_GROUPS.promis) {
    for (let i = 0; i < group.expected; i++, item++) {
      const prefix = group.id === 'sleep' ? 'Distúrbio do sono' : group.id === 'social' ? 'Capacidade de participar' : group.title;
      const header = group.id === 'pain' ? 'Como você avaliaria a sua dor nos últimos 7 dias?' : `${prefix} [${item}. Item fictício]`;
      const choice = group.options(header).find(option => option.code === (group.id === 'pain' ? 5 : 3));
      fields[header] = `${choice.label} (${choice.code})`;
    }
  }
  return fields;
}
function parse(rows, sourceId = 'file:sf36:teste.xlsx', sourceLabel = 'teste.xlsx') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Respostas ao formulário 1');
  return parseSpreadsheet(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), sourceId, sourceLabel);
}
function question(groups, key) {
  return groups.flatMap(group => group.questions).find(q => q.label.startsWith(key));
}

// Only header text was copied from the supplied exports. All answers are fictitious.
function exportedRow(version, kind) {
  return Object.fromEntries(spreadsheetHeaders[version][kind].map(header => {
    if (header === 'Data da avaliação' && kind === 'combined') return [header, '10/14/2026'];
    if (Object.hasOwn(metadata, header)) return [header, metadata[header]];
    const scale = fieldScale(header);
    if (scale === 'pcs') return [header, '1'];
    if (scale) {
      const group = FORM_GROUPS[scale].find(group => group.match(normalize(header)));
      const options = group.options(normalize(header));
      const option = options.find(option => option.code === 3) || options[0];
      return [header, `${option.label} (${option.code})`];
    }
    if (normalize(header) === 'data de nascimento') return [header, '01/02/1980'];
    return [header, 'Resposta fictícia'];
  }));
}

test('old and new real headers preserve all scale items and equivalent calculations', () => {
  for (const kind of ['combined', 'sf36']) {
    const results = ['old', 'new'].map(version => {
      const parsed = parse([exportedRow(version, kind)]);
      validateSource(parsed, kind);
      assert.deepEqual(parsed.warnings, []);
      const evaluation = parsed.evaluations[0];
      assert.equal(evaluation.kind, 'scales');
      assert.equal(Object.keys(evaluation.fields).length, spreadsheetHeaders[version][kind].length);
      if (kind === 'sf36') {
        const groups = organizedResponses(evaluation, 'sf36');
        assert.equal(groups.flatMap(group => group.questions).filter(q => !q.missingColumn && !q.ambiguous).length, 36);
        return calculateSf36(evaluation);
      }
      assert.equal(Object.values(evaluation.pcsResponses).filter(value => value !== null).length, 13);
      assert.equal(organizedResponses(evaluation, 'promis').flatMap(group => group.questions).length, 29);
      return [calculatePcs(evaluation), calculatePromis29(evaluation)];
    });
    assert.deepEqual(results[0], results[1]);
  }
});

test('initial assessments accept both versions, preserve original meanings and display all fields', () => {
  for (const version of ['old', 'new']) {
    const row = exportedRow(version, 'initial');
    // Matching must not depend on column position.
    const parsed = parse([Object.fromEntries(Object.entries(row).reverse())], 'google:initial');
    validateSource(parsed, 'initial');
    assert.deepEqual(parsed.warnings, []);
    const evaluation = parsed.evaluations[0];
    assert.equal(evaluation.kind, 'initial');
    assert.equal(evaluation.moment, '');
    assert.deepEqual(evaluation.scales, []);
    assert.deepEqual(evaluation.fields, row);
    assert.equal(Object.keys(evaluation.fields).length, 48);
    assert.match(evaluationLabel(evaluation), /Avaliação inicial/);
    assert.doesNotMatch(evaluationLabel(evaluation), /Sem momento/);
    const html = renderToStaticMarkup(React.createElement(PatientFields, { evaluation }));
    assert.equal((html.match(/<dt>/g) || []).length, 48);
    assert.match(html, version === 'new' ? /Data de Nascimento/ : /Frequência respiratória/);
    assert.doesNotMatch(html, version === 'new' ? /Frequência respiratória/ : /Data de Nascimento/);
    assert.match(html, version === 'new' ? /Algum médico já lhe deu diagnóstico/ : /alguma outra doença/);
    assert.equal(evaluation.fields['Data de Nascimento'], version === 'new' ? '01/02/1980' : undefined);
    assert.throws(() => validateSource(parsed, 'combined'), /Este campo aceita/);
    assert.throws(() => validateSource(parsed, 'sf36'), /Este campo aceita/);
  }
});

test('all three sources coexist, including identical repeated initial rows and independent refreshes', () => {
  const initialRow = exportedRow('new', 'initial');
  const initial = parse([initialRow, initialRow], 'google:initial');
  const combined = parse([exportedRow('new', 'combined')], 'google:combined');
  const sf = parse([exportedRow('new', 'sf36')], 'google:sf36');
  const merged = mergeSpreadsheet(mergeSpreadsheet(initial, combined), sf);
  const patients = groupPatients(merged.evaluations);
  assert.equal(patients.length, 1);
  assert.equal(patients[0].evaluations.length, 4);
  assert.equal(new Set(patients[0].evaluations.map(e => e.recordKey)).size, 4);
  const refreshed = mergeSpreadsheet(merged, initial);
  assert.equal(refreshed.evaluations.length, 4);
  const changed = mergeSpreadsheet(refreshed, parse([{ ...initialRow, 'Data de Nascimento': '02/03/1981' }], 'google:initial'));
  assert.equal(changed.evaluations.length, 3);
  assert.equal(changed.evaluations.find(e => e.kind === 'initial').fields['Data de Nascimento'], '02/03/1981');
  assert.deepEqual(changed.evaluations.filter(e => e.kind === 'scales'), [...combined.evaluations, ...sf.evaluations]);
  assert.deepEqual(calculatePcs(combined.evaluations[0]), calculatePcs(changed.evaluations.find(e => e.scales.includes('pcs'))));
  assert.throws(() => validateSource(sf, 'initial'), /Este campo aceita/);
  assert.throws(() => validateSource(combined, 'initial'), /Este campo aceita/);
});

test('initial detection never admits arbitrary metadata sheets or relaxes scale requirements', () => {
  const { ['Pontuação']: ignoredScore, ['Momento da avaliação']: ignoredMoment, ...meta } = metadata;
  assert.throws(() => parse([meta]), /nenhum cabeçalho/);
  const incomplete = combinedRow();
  delete incomplete['Momento da avaliação'];
  assert.throws(() => parse([incomplete]), /Momento da avaliação/);
  const initial = exportedRow('new', 'initial');
  delete initial['Nome completo do paciente'];
  assert.throws(() => parse([initial]), /Nome completo do paciente/);
});

test('environment configuration accepts three independent optional links', () => {
  assert.deepEqual(configuredSheetUrls({}), { combined: '', sf36: '', initial: '' });
  assert.deepEqual(configuredSheetUrls({
    VITE_COMBINED_SHEET_URL: ' https://example.test/combined ',
    VITE_SF36_SHEET_URL: 'https://example.test/sf36',
    VITE_INITIAL_SHEET_URL: 'https://example.test/initial',
  }), { combined: 'https://example.test/combined', sf36: 'https://example.test/sf36', initial: 'https://example.test/initial' });
});

test('configured downloads merge independently; a failed source preserves existing records', async () => {
  const downloads = [];
  const errors = [];
  let data = parse([exportedRow('old', 'sf36')], 'google:sf36');
  const original = data.evaluations[0];
  const download = async kind => {
    downloads.push(kind);
    if (kind === 'sf36') throw new Error('Falha simulada');
    const workbook = XLSX.utils.book_new();
    const row = exportedRow('new', kind);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(kind === 'initial' ? [row, row] : [row]), 'Respostas ao formulário 1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  };
  const success = parsed => { data = mergeSpreadsheet(data, parsed); };
  await syncSources(SOURCE_KINDS, success, (kind, message) => errors.push({ kind, message }), download);
  assert.deepEqual(new Set(downloads), new Set(SOURCE_KINDS));
  assert.deepEqual(errors, [{ kind: 'sf36', message: 'Falha simulada' }]);
  assert.equal(data.evaluations.length, 4);
  assert.deepEqual(data.evaluations.find(e => e.sourceId === 'google:sf36'), original);
  await syncSources(['initial'], success, () => assert.fail('Unexpected sync error'), download);
  assert.equal(data.evaluations.length, 4);
  assert.equal(downloads.length, 4);
  await syncSources(['initial'], () => assert.fail('Wrong form must not replace initial records'), (kind, message) => {
    assert.equal(kind, 'initial');
    assert.match(message, /Este campo aceita/);
  }, () => download('combined'));
  assert.equal(data.evaluations.length, 4);
});

test('imports all 36 SF-36 answers with the original Forms text/code format', () => {
  const parsed = parse([sfRow()]);
  validateSource(parsed, 'sf36');
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.evaluations[0].scales, ['sf36']);
  assert.equal(Object.keys(parsed.evaluations[0].fields).length, 43);
  const groups = organizedResponses(parsed.evaluations[0], 'sf36');
  assert.deepEqual(groups.map(g => g.questions.length), [1, 1, 10, 4, 3, 1, 1, 1, 9, 1, 4]);
  assert.equal(groups.flatMap(g => g.questions).filter(q => selectedChoice(q.value, q.options) !== undefined).length, 36);
});

test('reordered columns and a missing subitem never shift subsequent answers', () => {
  const row = sfRow();
  const removed = Object.keys(row).find(h => h.includes('[b) Atividades moderadas'));
  delete row[removed];
  const reversed = Object.fromEntries(Object.entries(row).reverse());
  const groups = organizedResponses(parse([reversed]).evaluations[0], 'sf36');
  const physical = groups.find(g => g.id === 'sf3');
  assert.equal(physical.questions.length, 10);
  assert.equal(question([physical], 'b)').missingColumn, true);
  assert.equal(question([physical], 'b)').value, '');
  assert.equal(selectedChoice(question([physical], 'c)').value, physical.options('')), 3);
  assert.equal(selectedChoice(question([physical], 'd)').value, physical.options('')), 1);
});

test('blank, contradictory and duplicate answers stay unmarked and originals remain available', () => {
  const row = sfRow();
  const first = Object.keys(row).find(h => h.startsWith('1 —'));
  row[first] = 'Boa (1)';
  const second = Object.keys(row).find(h => h.startsWith('2 —'));
  row[second] = '';
  const physical = Object.keys(row).find(h => h.includes('[a) Atividades rigorosas'));
  row[`${physical} `] = 'Sim, dificulta um pouco (2)';
  const evaluation = parse([row]).evaluations[0];
  const groups = organizedResponses(evaluation, 'sf36');
  assert.equal(selectedChoice(groups[0].questions[0].value, groups[0].questions[0].options), undefined);
  assert.equal(groups[1].questions[0].value, '');
  assert.equal(groups[2].questions[0].ambiguous, true);
  assert.equal(evaluation.fields[first], 'Boa (1)');
  const html = renderToStaticMarkup(React.createElement(Sf36Report, {
    selectedPatient: groupPatients([evaluation])[0], selectedEvaluation: evaluation, setSelectedEvaluationRow() {},
  }));
  assert.match(html, /Itens que exigem conferência/);
  assert.match(html, /Mais de uma coluna/);
  assert.match(html, /Boa \(1\)/);
  assert.equal((html.match(/response-choice selected/g) || []).length, 33);
});

test('both spreadsheets coexist by patient ID, keeping dates, scales and independent record keys', () => {
  const combined = parse([combinedRow()], 'google:combined', 'PCS e PROMIS-29 · Google Sheets');
  const sf = parse([{ ...sfRow(), 'Data da avaliação': '15/10/2026' }], 'google:sf36', 'SF-36 · Google Sheets');
  validateSource(combined, 'combined');
  validateSource(sf, 'sf36');
  const merged = mergeSpreadsheet(combined, sf);
  assert.equal(merged.evaluations.length, 2);
  const patients = groupPatients(merged.evaluations);
  assert.equal(patients.length, 1);
  assert.equal(patients[0].evaluations.length, 2);
  assert.equal(new Set(patients[0].evaluations.map(e => e.recordKey)).size, 2);
  assert.equal(patients[0].evaluations.filter(e => e.scales.includes('sf36')).length, 1);
  assert.deepEqual(new Set(patients[0].evaluations.map(e => e.date)), new Set(['14/10/2026', '15/10/2026']));
  assert.equal(mergeSpreadsheet(merged, sf).evaluations.length, 2);
  const replaced = mergeSpreadsheet(merged, parse([{ ...sfRow(), 'Data da avaliação': '16/10/2026' }], 'google:sf36'));
  assert.equal(replaced.evaluations.length, 2);
  assert.equal(replaced.evaluations.find(e => e.sourceId === 'google:sf36').date, '16/10/2026');
  assert.deepEqual(replaced.evaluations.find(e => e.sourceId === 'google:combined'), combined.evaluations[0]);
});

test('within an evaluation phase, dates sort oldest first with missing or invalid dates last', () => {
  const dates = ['30/9/26', '21/10/26', '23/9/26', '21/10/26', '23/09/2026', '2026-11-02', '01/10/2026', '', '31/02/2026', '01/11/26'];
  const parsed = parse(dates.map(date => ({ ...sfRow(), 'Data da avaliação': date })));
  const before = parsed.evaluations.map(e => e.recordKey);
  const sorted = groupPatients(parsed.evaluations)[0].evaluations;
  assert.deepEqual(sorted.map(e => e.date), ['23/09/2026', '23/09/2026', '30/09/2026', '01/10/2026', '21/10/2026', '21/10/2026', '01/11/2026', '02/11/2026', '31/02/2026', '']);
  assert.equal(sorted.length, dates.length);
  assert.equal(new Set(sorted.map(e => e.recordKey)).size, dates.length);
  assert.deepEqual(parsed.evaluations.map(e => e.recordKey), before);
});

test('numeric Excel dates follow the source convention before evaluation sorting', () => {
  const serial = (year, month, day) => (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;
  const november = serial(2026, 11, 4), april = serial(2026, 4, 11), september = serial(2026, 9, 23);
  const workbook = XLSX.utils.book_new();
  function append(name, rows, format) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const column = Object.keys(rows[0]).indexOf('Data da avaliação');
    rows.forEach((row, index) => { sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })].z = format; });
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  append('combined', [
    { ...combinedRow(), 'Data da avaliação': april, 'Momento da avaliação': 'Reavaliação final' },
    { ...combinedRow(), 'Data da avaliação': september, 'Momento da avaliação': 'Avaliação inicial' },
  ], 'd/m/yy');
  append('sf36', [
    { ...sfRow(), 'Data da avaliação': november, 'Momento da avaliação': 'Reavaliação Final' },
  ], 'd/m/yy');
  append('sf36-original-april', [
    { ...sfRow(), 'Data da avaliação': april, 'Momento da avaliação': 'Reavaliação Final' },
  ], 'd/m/yy');
  append('initial', [{ ...exportedRow('new', 'initial'), 'Data da avaliação': september }], 'd/m/yy');
  const parsed = parseSpreadsheet(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  const sorted = groupPatients(parsed.evaluations)[0].evaluations;
  assert.deepEqual(sorted.map(e => e.sheetName), ['initial', 'combined', 'sf36-original-april', 'combined', 'sf36']);
  assert.deepEqual(sorted.map(e => e.date), ['23/09/2026', '23/09/2026', '11/04/2026', '04/11/2026', '04/11/2026']);
  assert.equal(sorted[3].dateValue, sorted[4].dateValue);
  assert.equal(sorted[3].fields['Data da avaliação'], '04/11/2026');
  assert.equal(sorted[4].fields['Data da avaliação'], '04/11/2026');
  assert.equal(sorted[2].fields['Data da avaliação'], '11/04/2026');
  assert.equal(sorted[3].originalFields['Data da avaliação'], '11/4/26');
  assert.equal(sorted[4].originalFields['Data da avaliação'], '4/11/26');
  assert.equal(sorted[2].originalFields['Data da avaliação'], '11/4/26');
});

test('Excel 1904 dates and source-specific text dates keep the original calendar day', () => {
  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { WBProps: { date1904: true } };
  const row = sfRow();
  row['Data da avaliação'] = (Date.UTC(2026, 11 - 1, 4) - Date.UTC(1904, 0, 1)) / 86400000;
  const sheet = XLSX.utils.json_to_sheet([row]);
  const address = XLSX.utils.encode_cell({ r: 1, c: Object.keys(row).indexOf('Data da avaliação') });
  sheet[address].z = 'm/d/yy';
  XLSX.utils.book_append_sheet(workbook, sheet, 'SF36');
  const parsed = parseSpreadsheet(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  assert.equal(parsed.evaluations[0].date, '04/11/2026');
  const { readEvaluationDate } = load('src/services/evaluationDates.ts');
  assert.equal(readEvaluationDate({ t: 's', v: '4/11/26', z: 'dd/mm/yy' }, '4/11/26', 'dmy').date, '04/11/2026');
  assert.equal(readEvaluationDate({ t: 's', v: '11/4/26', z: 'mm/dd/yy' }, '11/4/26', 'mdy').date, '04/11/2026');
});

test('each form has a fixed date convention for ambiguous text dates and both year lengths', () => {
  for (const kind of SOURCE_KINDS) {
    for (const version of ['old', 'new']) {
      for (const year of ['26', '2026']) {
        const row = { ...exportedRow(version, kind), 'Data da avaliação': `04/11/${year}` };
        const parsed = parse([row], `google:${kind}`, 'Arquivo renomeado.xlsx');
        validateSource(parsed, kind);
        assert.equal(parsed.evaluations[0].date, kind === 'combined' ? '11/04/2026' : '04/11/2026');
        assert.equal(parsed.evaluations[0].fields['Data da avaliação'], parsed.evaluations[0].date);
        assert.equal(parsed.evaluations[0].originalFields['Data da avaliação'], `04/11/${year}`);
      }
    }
  }
  const { readEvaluationDate } = load('src/services/evaluationDates.ts');
  // A stale display format must not override the source's declared convention.
  assert.equal(readEvaluationDate({ t: 's', v: '04/11/2026', z: 'mm/dd/yyyy' }, '04/11/2026', 'dmy').date, '04/11/2026');
  assert.equal(readEvaluationDate({ t: 's', v: '04/11/2026', z: 'dd/mm/yyyy' }, '04/11/2026', 'mdy').date, '11/04/2026');
  assert.equal(readEvaluationDate(undefined, '11/23/2026', 'dmy').dateValue, null);
  assert.equal(readEvaluationDate(undefined, '23/11/2026', 'mdy').dateValue, null);
});

test('different source conventions identify the same day and preserve ascending alphabetical ties', () => {
  let data = null;
  for (const kind of SOURCE_KINDS) {
    const row = { ...exportedRow('new', kind), 'Data da avaliação': kind === 'combined' ? '11/04/2026' : '04/11/2026' };
    data = mergeSpreadsheet(data, parse([row], `google:${kind}`));
  }
  const sorted = groupPatients(data.evaluations)[0].evaluations;
  assert.equal(new Set(sorted.map(e => e.dateValue)).size, 1);
  assert.deepEqual(sorted.map(e => e.date), ['04/11/2026', '04/11/2026', '04/11/2026']);
  assert.deepEqual(sorted.map(e => e.sourceId), ['google:initial', 'google:combined', 'google:sf36']);
  assert.deepEqual(sorted.map(e => e.fields['Data da avaliação']), ['04/11/2026', '04/11/2026', '04/11/2026']);
  assert.equal(data.evaluations.filter(e => e.date === '04/11/2026').length, 3);
  assert.equal(data.evaluations.filter(e => e.fields['Data da avaliação'] === '04/11/2026').length, 3);
  const combined = sorted.find(e => e.sourceId === 'google:combined');
  assert.equal(combined.originalFields['Data da avaliação'], '11/04/2026');
  const html = renderToStaticMarkup(React.createElement(PatientFields, { evaluation: combined }));
  assert.match(html, /Data da avaliação<\/dt><dd>04\/11\/2026<\/dd>/);
  assert.doesNotMatch(html, /11\/04\/2026/);
});

test('the patient pathway preserves the SF-36 November date while keeping initial assessments first', () => {
  const workbook = XLSX.utils.book_new();
  const serial = (month, day) => (Date.UTC(2026, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;
  function append(name, rows) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    const column = Object.keys(rows[0]).indexOf('Data da avaliação');
    rows.forEach((row, index) => {
      if (typeof row['Data da avaliação'] === 'number') sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })].z = 'm/d/yy';
    });
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  // Match the new ZIP: PCS/PROMIS contains text/numeric month-first values;
  // SF-36 stores November 4 as a real Excel date and must preserve that day.
  append('PCS e PROMIS-29', [
    { ...combinedRow(), 'Data da avaliação': serial(4, 11), 'Momento da avaliação': 'Reavaliação final' },
    { ...combinedRow(), 'Data da avaliação': '09/23/2026', 'Momento da avaliação': 'Avaliação inicial' },
  ]);
  append('SF-36', [
    { ...sfRow(), 'Data da avaliação': serial(11, 4), 'Momento da avaliação': 'Reavaliação Final' },
    { ...sfRow(), 'Data da avaliação': serial(10, 14), 'Momento da avaliação': 'Avaliação Inicial' },
  ]);
  append('Inicial', [{ ...exportedRow('new', 'initial'), 'Data da avaliação': serial(9, 23) }]);
  const parsed = parseSpreadsheet(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  const sorted = groupPatients(parsed.evaluations)[0].evaluations;
  assert.deepEqual(sorted.map(evaluationLabel), [
    '23/09/2026 · Avaliação inicial',
    '23/09/2026 · Avaliação inicial · PCS e PROMIS-29',
    '14/10/2026 · Avaliação Inicial · SF-36',
    '11/04/2026 · Reavaliação final · PCS e PROMIS-29',
    '04/11/2026 · Reavaliação Final · SF-36',
  ]);
  assert.equal(new Set(sorted.map(e => e.recordKey)).size, 5);
});

test('SF-36 and initial numeric dates never swap day and month due to Excel display formatting', () => {
  for (const kind of ['sf36', 'initial']) {
    for (const format of [14, 'm/d/yy', 'd/m/yy']) {
      const rows = [4, 11].map(month => ({
        ...exportedRow('new', kind),
        'Data da avaliação': (Date.UTC(2026, month - 1, month === 4 ? 11 : 4) - Date.UTC(1899, 11, 30)) / 86400000,
      }));
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(rows);
      const column = Object.keys(rows[0]).indexOf('Data da avaliação');
      rows.forEach((_, index) => { sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })].z = format; });
      XLSX.utils.book_append_sheet(workbook, sheet, 'Respostas');
      const parsed = parseSpreadsheet(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
      assert.deepEqual(parsed.evaluations.map(e => e.date), ['11/04/2026', '04/11/2026']);
      assert.deepEqual(parsed.evaluations.map(e => e.fields['Data da avaliação']), ['11/04/2026', '04/11/2026']);
    }
  }
});

test('wrong source fields are rejected before merging', () => {
  assert.throws(() => validateSource(parse([sfRow()]), 'combined'), /Este campo aceita/);
  assert.throws(() => validateSource(parse([combinedRow()]), 'sf36'), /Este campo aceita/);
});

test('import notices are retained per source and cleared only when that source is corrected', () => {
  const incomplete = { ...combinedRow(), 'Código/ID único do paciente': '' };
  const first = parse([incomplete], 'google:combined');
  assert.equal(first.warnings.length, 1);
  const sf = parse([sfRow()], 'google:sf36');
  const merged = mergeSpreadsheet(first, sf);
  assert.equal(merged.warnings.length, 1);
  assert.equal(mergeSpreadsheet(merged, sf).warnings.length, 1);
  assert.equal(mergeSpreadsheet(merged, parse([combinedRow()], 'google:combined')).warnings.length, 0);
});

test('PCS and PROMIS calculations are preserved after importing SF-36', () => {
  const combined = parse([combinedRow()], 'google:combined');
  const merged = mergeSpreadsheet(combined, parse([sfRow()], 'google:sf36'));
  const evaluation = merged.evaluations.find(e => e.scales.includes('pcs'));
  const pcs = calculatePcs(evaluation);
  assert.deepEqual([pcs.total, pcs.rumination, pcs.magnification, pcs.helplessness], [13, 4, 3, 6]);
  const promis = calculatePromis29(evaluation);
  assert.equal(promis.complete, true);
  assert.equal(promis.totalRaw, 89);
  assert.deepEqual(promis.domains.map(d => d.tScore), [36.7, 63.4, 62.2, 57, 54.3, 44.2, 61.2]);
});

test("SF-36 displays all eight visual domain references and hides responses under disclosure", () => {
  const evaluation = parse([sfRow()]).evaluations[0];
  const html = renderToStaticMarkup(
    React.createElement(Sf36Report, {
      selectedPatient: groupPatients([evaluation])[0],
      selectedEvaluation: evaluation,
      setSelectedEvaluationRow() {},
      onExport() {},
    }),
  );
  assert.match(html, /Questionário de Qualidade de Vida/);
  assert.match(html, /Domínio: Capacidade funcional/);
  assert.match(html, /Presença e extensão de limitações relacionadas à capacidade física/);
  assert.match(html, /Muita limitação para realizar todas as atividades físicas/);
  assert.match(html, /Alto desempenho/);
  assert.equal((html.match(/class="sf-domain"/g) || []).length, 8);
  assert.equal((html.match(/response-choice selected/g) || []).length, 36);
  assert.match(html, /<details class="report-disclosure"><summary>Respostas registradas/);
  assert.match(html, /Exportar PDF · escolher conteúdo/);
  assert.doesNotMatch(html, /Apuração dos escores|<th>Situação<\/th>/);
});

function setSf(row, id, value) {
  const [, number, letter] = id.match(/^(\d+)([a-j]?)$/);
  const header = Object.keys(row).find(h => h.startsWith(`${number} —`) && (!letter || h.includes(`[${letter})`)));
  assert.ok(header, `Missing fixture header: ${id}`);
  row[header] = String(value);
  return row;
}
const sfResult = row => calculateSf36(parse([row]).evaluations[0]);
const domain = (result, id) => result.domains.find(d => d.id === id);

test('SF-36 scores all eight separate domains with the correction DOCX weights', () => {
  const result = sfResult(sfRow());
  assert.deepEqual(result.domains.map(d => d.score), [45, 50, 100, 50, 40, 50, 33.3, 56]);
  assert.ok(result.domains.every(d => !d.estimated && !d.issues.length));
  assert.equal(result.items.find(i => i.id === '9a').weighted, 6);
  assert.equal(result.items.find(i => i.id === '9b').weighted, 2);
  assert.equal(result.items.find(i => i.id === '11b').weighted, 4);
  assert.equal(result.items.find(i => i.id === '11a').weighted, 1);
  assert.equal(Object.hasOwn(result, 'total'), false);
});

test('SF-36 reproduces the two worked examples: physical function 55 and pain 74', () => {
  const row = sfRow();
  for (const letter of 'abcdefghij') setSf(row, `3${letter}`, 2);
  setSf(row, '3a', 3); // Sum 21, lower 10, range 20 => 55.
  setSf(row, '7', 2); setSf(row, '8', 2); // Weights 5.4 + 4 => 74.
  const result = sfResult(row);
  assert.equal(domain(result, 'physicalFunction').score, 55);
  assert.equal(domain(result, 'pain').score, 74);
  assert.equal(domain(result, 'pain').rawScore, 9.4);
});

test('SF-36 pain follows every stated dependency and the DOCX severe-pain weight 2.0', () => {
  const q7Weights = [6, 5.4, 4.2, 3.1, 2, 1];
  for (let q7 = 2; q7 <= 6; q7++) {
    for (let q8 = 1; q8 <= 5; q8++) {
      const result = sfResult(setSf(setSf(sfRow(), '7', q7), '8', q8));
      assert.equal(domain(result, 'pain').score, Math.round((q7Weights[q7 - 1] + 6 - q8 - 2) * 100) / 10);
    }
  }
  assert.equal(domain(sfResult(setSf(setSf(sfRow(), '7', 5), '8', 4)), 'pain').score, 20);
  for (let q8 = 2; q8 <= 5; q8++) {
    const pain = domain(sfResult(setSf(setSf(sfRow(), '7', 1), '8', q8)), 'pain');
    assert.equal(pain.score, null);
    assert.match(pain.issues[0], /sem regra/);
  }
});

test('SF-36 uses the supplied Q8 fallback when Q7 is blank and labels the domain estimated', () => {
  for (let q8 = 1; q8 <= 5; q8++) {
    const result = sfResult(setSf(setSf(sfRow(), '7', ''), '8', q8));
    const pain = domain(result, 'pain');
    assert.equal(pain.score, [100,75,50,25,0][q8 - 1]);
    assert.equal(pain.estimated, true);
    assert.equal(pain.answered, 1);
    assert.equal(result.items.find(i => i.id === '7').original, '');
  }
});

test('SF-36 requires at least 50% of each domain, including rounding up for odd item counts', () => {
  const row = sfRow();
  for (const letter of 'abcdefghij') setSf(row, `3${letter}`, '');
  for (const letter of 'abcd') setSf(row, `3${letter}`, 3);
  assert.equal(domain(sfResult(row), 'physicalFunction').score, null);
  setSf(row, '3e', 3);
  const enough = domain(sfResult(row), 'physicalFunction');
  assert.equal(enough.score, 100); assert.equal(enough.estimated, true);
  setSf(row, '5a', ''); setSf(row, '5b', '');
  assert.equal(domain(sfResult(row), 'emotionalRole').score, null);
  setSf(row, '5b', 2);
  assert.equal(domain(sfResult(row), 'emotionalRole').score, 50);
  setSf(row, '1', ''); setSf(row, '11a', ''); setSf(row, '11b', '');
  assert.equal(domain(sfResult(row), 'generalHealth').score, null);
  setSf(row, '11b', 1);
  assert.equal(domain(sfResult(row), 'generalHealth').estimated, true);
});

test('SF-36 general health uses Q1 and Q11; Q2 and emotional-role changes never affect it', () => {
  const row = sfRow();
  const before = sfResult(row);
  setSf(row, '2', 5);
  for (const letter of 'abc') setSf(row, `5${letter}`, 2);
  const after = sfResult(row);
  assert.equal(after.healthChange, 'Muito pior');
  assert.equal(domain(after, 'generalHealth').score, domain(before, 'generalHealth').score);
  assert.equal(domain(after, 'emotionalRole').score, 100);
  setSf(row, '1', 5);
  assert.equal(domain(sfResult(row), 'generalHealth').score, 30);
});

test('invalid SF-36 answers block only affected domains, with no estimated replacement', () => {
  const row = sfRow(); setSf(row, '1', 'Boa (1)'); setSf(row, '7', 'Grave (99)');
  const result = sfResult(row);
  assert.equal(domain(result, 'generalHealth').score, null);
  assert.equal(domain(result, 'pain').score, null);
  assert.equal(domain(result, 'physicalFunction').score, 45);
  assert.equal(domain(result, 'mentalHealth').score, 56);
  assert.equal(result.items.find(i => i.id === '1').original, 'Boa (1)');
});

test('PCS interpretation includes the 30-point boundary and subscale cutoffs', () => {
  for (const [total, classification] of [[14,'low'],[15,'moderate'],[29,'moderate'],[30,'clinicallyRelevant'],[31,'clinicallyRelevant']]) {
    const row = combinedRow(); let remaining = total;
    for (const header of Object.keys(row).filter(h => h.startsWith('Quando estou sentindo dor'))) {
      const value = Math.min(4, remaining); row[header] = String(value); remaining -= value;
    }
    const result = calculatePcs(parse([row]).evaluations[0]);
    assert.equal(result.total, total); assert.equal(result.totalClassification, classification);
  }
  for (const [items, cutoff, flag] of [[[8,9,10,11],11,'ruminationSignificant'],[[6,7,13],5,'magnificationSignificant'],[[1,2,3,4,5,12],13,'helplessnessSignificant']]) {
    for (const target of [cutoff - 1, cutoff]) {
      const row = combinedRow(); let remaining = target;
      for (const header of Object.keys(row).filter(h => h.startsWith('Quando estou sentindo dor'))) {
        const number = Number(header.match(/\[(\d+)/)[1]); const value = items.includes(number) ? Math.min(4,remaining) : 0;
        row[header] = String(value); remaining -= value;
      }
      assert.equal(calculatePcs(parse([row]).evaluations[0])[flag], target === cutoff);
    }
  }
});

test('PROMIS classifies both directions at all DOCX boundaries', () => {
  for (const [t, classification] of [[54.9,'normal'],[55,'mild'],[59.9,'mild'],[60,'moderate'],[69.9,'moderate'],[70,'severe']]) assert.equal(classifyPromisTScore(t,'higherWorse'),classification);
  for (const [t, classification] of [[45.1,'normal'],[45,'mild'],[40,'mild'],[39.9,'moderate'],[30,'moderate'],[29.9,'severe']]) assert.equal(classifyPromisTScore(t,'higherBetter'),classification);
  assert.equal(classifyPromisTScore(null,'higherBetter'),'notAvailable');
});

test('PROMIS estimates one missing answer, but never converts two missing or contradictory answers', () => {
  const row = combinedRow(); const physical = Object.keys(row).filter(h => h.startsWith('Função física'));
  row[physical[0]] = '';
  let result = calculatePromis29(parse([row]).evaluations[0]);
  assert.equal(result.domains[0].estimated, true); assert.equal(result.domains[0].tScore, 36.7);
  row[physical[1]] = '';
  result = calculatePromis29(parse([row]).evaluations[0]);
  assert.equal(result.domains[0].tScore, null); assert.equal(result.totalRaw, null);
  row[physical[1]] = 'Incapaz de fazer (5)';
  result = calculatePromis29(parse([row]).evaluations[0]);
  assert.equal(result.domains[0].invalid, true); assert.equal(result.domains[0].tScore, null);
  const duplicate = combinedRow();
  delete duplicate[physical[1]];
  duplicate[`${physical[0]} `] = duplicate[physical[0]];
  result = calculatePromis29(parse([duplicate]).evaluations[0]);
  assert.equal(result.domains[0].invalid, true); assert.equal(result.domains[0].tScore, null);
});

test("reports prioritize clinical interpretation and omit raw calculation tables", () => {
  const sf = parse([sfRow()]).evaluations[0];
  const combined = parse([combinedRow()]).evaluations[0];
  for (const [Component, evaluation, extra] of [
    [Sf36Report, sf, {}],
    [PromisReport, combined, {}],
    [
      EvaluationReport,
      combined,
      { pcsResult: calculatePcs(combined), detailed: true, onDetails() {} },
    ],
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(Component, {
        selectedPatient: groupPatients([evaluation])[0],
        selectedEvaluation: evaluation,
        setSelectedEvaluationRow() {},
        onExport() {},
        ...extra,
      }),
    );
    assert.ok(html.includes("01 · Interpretação dos resultados"));
    assert.doesNotMatch(html, /Apuração dos escores|Apuração por domínio|<th>Soma ponderada<\/th>|<th>Cálculo<\/th>/);
    assert.ok(!html.includes("NaN"));
  }
});

test('server configuration accepts existing and new environment names without sending URLs to the browser', async () => {
  const { configuredSourceUrl } = load('server/sheetSources.ts');
  const primary = { combined: 'SHEET_PCS_PROMIS_URL', sf36: 'SHEET_SF36_URL', initial: 'SHEET_INITIAL_URL' };
  const legacy = { combined: 'VITE_COMBINED_SHEET_URL', sf36: 'VITE_SF36_SHEET_URL', initial: 'VITE_INITIAL_SHEET_URL' };
  for (const kind of SOURCE_KINDS) {
    assert.equal(configuredSourceUrl({}, kind), '');
    assert.equal(configuredSourceUrl({ [legacy[kind]]: ' https://example.test/legacy ' }, kind), 'https://example.test/legacy');
    assert.equal(configuredSourceUrl({ [primary[kind]]: 'https://example.test/primary', [legacy[kind]]: 'https://example.test/legacy' }, kind), 'https://example.test/primary');
  }
  const { downloadGoogleSheet } = load('src/services/googleSheets.ts');
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    assert.equal(url, '/api/sheet');
    assert.equal(options.method, 'POST');
    requests.push(JSON.parse(options.body));
    return new Response(new Uint8Array([1, 2, 3]));
  };
  try {
    for (const kind of SOURCE_KINDS) assert.deepEqual(Array.from(new Uint8Array(await downloadGoogleSheet(kind))), [1, 2, 3]);
  } finally {
    global.fetch = originalFetch;
  }
  assert.deepEqual(requests, SOURCE_KINDS.map(source => ({ source })));
});

test('the merged patient record reads both initial schemas by header without shifting birth date, gender or residence', () => {
  const { PatientBasics, InitialRecord } = load('src/PatientRecord.tsx');
  for (const version of ['old', 'new']) {
    const row = exportedRow(version, 'initial');
    const gender = Object.keys(row).find(h => normalize(h).startsWith('genero'));
    const residence = Object.keys(row).find(h => normalize(h).includes('mora atualmente'));
    row[gender] = 'Feminino';
    row[residence] = 'Campina Grande/PB';
    const evaluation = parse([row]).evaluations[0];
    const patient = groupPatients([evaluation])[0];
    const basics = renderToStaticMarkup(React.createElement(PatientBasics, { patient, initial: evaluation }));
    assert.match(basics, /Gênero<\/span><strong>Feminino/);
    assert.match(basics, /Município de residência<\/span><strong>Campina Grande\/PB/);
    const record = renderToStaticMarkup(React.createElement(InitialRecord, { evaluation }));
    assert.equal((record.match(/<dt>/g) || []).length, 43);
    assert.match(record, /Dados pessoais e sociodemográficos/);
    assert.match(record, /Queixa principal e histórico de saúde/);
    assert.match(record, version === 'new' ? /Data de Nascimento/ : /Frequência respiratória/);
  }
});

test("initial clinical sheet imports without a moment or any scale and links by patient ID", () => {
  const initialRow = {
    "Carimbo de data/hora": "14/10/2026",
    "Código/ID único do paciente": "TESTE-01",
    "Data da avaliação": 46287,
    "Extensionista/pesquisador(a) responsável pela coleta": "Equipe de teste",
    "Nome completo do paciente": "Paciente fictício",
    "Gênero (confirmar/observar).": "Feminino",
    "Qual é o principal motivo que trouxe o(a) senhor(a) até aqui hoje?": "Queixa fictícia",
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet([initialRow]),
    "Respostas ao formulário 1",
  );
  const init = parseSpreadsheet(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
    "google:initial",
    "Avaliação inicial",
    "initial",
  );
  validateSource(init, "initial");
  assert.deepEqual(init.evaluations[0].scales, []);
  assert.equal(init.evaluations[0].moment, "");
  assert.equal(init.evaluations[0].date, "22/09/2026");
  const sf = parse([sfRow()], "google:sf36");
  const patients = groupPatients(mergeSpreadsheet(sf, init).evaluations);
  assert.equal(patients.length, 1);
  assert.equal(patients[0].evaluations.length, 2);
  assert.throws(() => validateSource(init, "sf36"), /Este campo aceita/);
});
