const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const XLSX = require("xlsx");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

// Load TypeScript in memory without producing a second build or requiring
// test-only packages. Fixture workbooks contain only fictitious patients.
const modules = new Map();
function load(file) {
  const filename = path.resolve(__dirname, "..", file);
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  if (filename.endsWith(".json")) {
    const result = JSON.parse(fs.readFileSync(filename, "utf8"));
    modules.get(filename).exports = result;
    return result;
  }
  const javascript = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  new Function("require", "module", "exports", javascript)(
    (id) => {
      if (!id.startsWith(".")) return require(id);
      const base = path.resolve(path.dirname(filename), id);
      const dependency = [base, `${base}.ts`, `${base}.tsx`].find((candidate) =>
        fs.existsSync(candidate),
      );
      return load(path.relative(path.resolve(__dirname, ".."), dependency));
    },
    module,
    module.exports,
  );
  return module.exports;
}

const { parseSpreadsheet, mergeSpreadsheet, groupPatients } = load("src/services/spreadsheet.ts");
const { FORM_GROUPS, organizedResponses, selectedChoice } = load("src/services/forms.ts");
const { SF36_SECTIONS } = load("src/services/sf36Form.ts");
const { validateSource } = load("src/services/sources.ts");
const { calculatePcs } = load("src/services/pcs.ts");
const { calculatePromis29, classifyPromisTScore } = load("src/services/promis29.ts");
const { calculateSf36 } = load("src/services/sf36.ts");
const { Sf36Report } = load("src/Sf36Report.tsx");
const { PromisReport } = load("src/PromisReport.tsx");
const { EvaluationReport } = load("src/EvaluationReport.tsx");

const metadata = {
  "Carimbo de data/hora": "14/10/2026 10:30:00",
  Pontuação: "0",
  "Código/ID único do paciente": "TESTE-01",
  "Nome completo do paciente": "Paciente fictício",
  "Data da avaliação": "14/10/2026",
  "Extensionista/pesquisador(a) responsável pela coleta": "Equipe de teste",
  "Momento da avaliação": "Linha de base (pré-intervenção)",
};
function sfRow() {
  const fields = { ...metadata };
  SF36_SECTIONS.forEach((section, index) =>
    section.questions.forEach((item, itemIndex) => {
      const header = section.intro ? `${section.intro}\n [${item.label}]` : item.label;
      const options = FORM_GROUPS.sf36[index].options(header);
      const choice = options[itemIndex % options.length];
      fields[header] = `${choice.label} (${choice.code})`;
    }),
  );
  return fields;
}
function combinedRow() {
  const fields = { ...metadata };
  for (let i = 1; i <= 13; i++)
    fields[`Quando estou sentindo dor [${i}. Item fictício ${i}]`] = "1 - Em um grau leve";
  let item = 1;
  for (const group of FORM_GROUPS.promis) {
    for (let i = 0; i < group.expected; i++, item++) {
      const prefix =
        group.id === "sleep"
          ? "Distúrbio do sono"
          : group.id === "social"
            ? "Capacidade de participar"
            : group.title;
      const header =
        group.id === "pain"
          ? "Como você avaliaria a sua dor nos últimos 7 dias?"
          : `${prefix} [${item}. Item fictício]`;
      const choice = group
        .options(header)
        .find((option) => option.code === (group.id === "pain" ? 5 : 3));
      fields[header] = `${choice.label} (${choice.code})`;
    }
  }
  return fields;
}
function parse(rows, sourceId = "file:sf36:teste.xlsx", sourceLabel = "teste.xlsx") {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    "Respostas ao formulário 1",
  );
  return parseSpreadsheet(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
    sourceId,
    sourceLabel,
  );
}
function question(groups, key) {
  return groups.flatMap((group) => group.questions).find((q) => q.label.startsWith(key));
}

test("imports all 36 SF-36 answers with the original Forms text/code format", () => {
  const parsed = parse([sfRow()]);
  validateSource(parsed, "sf36");
  assert.deepEqual(parsed.warnings, []);
  assert.deepEqual(parsed.evaluations[0].scales, ["sf36"]);
  assert.equal(Object.keys(parsed.evaluations[0].fields).length, 43);
  const groups = organizedResponses(parsed.evaluations[0], "sf36");
  assert.deepEqual(
    groups.map((g) => g.questions.length),
    [1, 1, 10, 4, 3, 1, 1, 1, 9, 1, 4],
  );
  assert.equal(
    groups
      .flatMap((g) => g.questions)
      .filter((q) => selectedChoice(q.value, q.options) !== undefined).length,
    36,
  );
});

test("reordered columns and a missing subitem never shift subsequent answers", () => {
  const row = sfRow();
  const removed = Object.keys(row).find((h) => h.includes("[b) Atividades moderadas"));
  delete row[removed];
  const reversed = Object.fromEntries(Object.entries(row).reverse());
  const groups = organizedResponses(parse([reversed]).evaluations[0], "sf36");
  const physical = groups.find((g) => g.id === "sf3");
  assert.equal(physical.questions.length, 10);
  assert.equal(question([physical], "b)").missingColumn, true);
  assert.equal(question([physical], "b)").value, "");
  assert.equal(selectedChoice(question([physical], "c)").value, physical.options("")), 3);
  assert.equal(selectedChoice(question([physical], "d)").value, physical.options("")), 1);
});

test("blank, contradictory and duplicate answers stay unmarked and originals remain available", () => {
  const row = sfRow();
  const first = Object.keys(row).find((h) => h.startsWith("1 —"));
  row[first] = "Boa (1)";
  const second = Object.keys(row).find((h) => h.startsWith("2 —"));
  row[second] = "";
  const physical = Object.keys(row).find((h) => h.includes("[a) Atividades rigorosas"));
  row[`${physical} `] = "Sim, dificulta um pouco (2)";
  const evaluation = parse([row]).evaluations[0];
  const groups = organizedResponses(evaluation, "sf36");
  assert.equal(
    selectedChoice(groups[0].questions[0].value, groups[0].questions[0].options),
    undefined,
  );
  assert.equal(groups[1].questions[0].value, "");
  assert.equal(groups[2].questions[0].ambiguous, true);
  assert.equal(evaluation.fields[first], "Boa (1)");
  const html = renderToStaticMarkup(
    React.createElement(Sf36Report, {
      selectedPatient: groupPatients([evaluation])[0],
      selectedEvaluation: evaluation,
      setSelectedEvaluationRow() {},
    }),
  );
  assert.match(html, /Itens que exigem conferência/);
  assert.match(html, /Mais de uma coluna/);
  assert.match(html, /Boa \(1\)/);
  assert.equal((html.match(/response-choice selected/g) || []).length, 33);
});

test("both spreadsheets coexist by patient ID, keeping dates, scales and independent record keys", () => {
  const combined = parse([combinedRow()], "google:combined", "PCS e PROMIS-29 · Google Sheets");
  const sf = parse(
    [{ ...sfRow(), "Data da avaliação": "15/10/2026" }],
    "google:sf36",
    "SF-36 · Google Sheets",
  );
  validateSource(combined, "combined");
  validateSource(sf, "sf36");
  const merged = mergeSpreadsheet(combined, sf);
  assert.equal(merged.evaluations.length, 2);
  const patients = groupPatients(merged.evaluations);
  assert.equal(patients.length, 1);
  assert.equal(patients[0].evaluations.length, 2);
  assert.equal(new Set(patients[0].evaluations.map((e) => e.recordKey)).size, 2);
  assert.equal(patients[0].evaluations.filter((e) => e.scales.includes("sf36")).length, 1);
  assert.deepEqual(
    new Set(patients[0].evaluations.map((e) => e.date)),
    new Set(["14/10/2026", "15/10/2026"]),
  );
  assert.equal(mergeSpreadsheet(merged, sf).evaluations.length, 2);
  const replaced = mergeSpreadsheet(
    merged,
    parse([{ ...sfRow(), "Data da avaliação": "16/10/2026" }], "google:sf36"),
  );
  assert.equal(replaced.evaluations.length, 2);
  assert.equal(replaced.evaluations.find((e) => e.sourceId === "google:sf36").date, "16/10/2026");
  assert.deepEqual(
    replaced.evaluations.find((e) => e.sourceId === "google:combined"),
    combined.evaluations[0],
  );
});

test("wrong source fields are rejected before merging", () => {
  assert.throws(() => validateSource(parse([sfRow()]), "combined"), /Este campo aceita/);
  assert.throws(() => validateSource(parse([combinedRow()]), "sf36"), /Este campo aceita/);
});

test("import notices are retained per source and cleared only when that source is corrected", () => {
  const incomplete = { ...combinedRow(), "Código/ID único do paciente": "" };
  const first = parse([incomplete], "google:combined");
  assert.equal(first.warnings.length, 1);
  const sf = parse([sfRow()], "google:sf36");
  const merged = mergeSpreadsheet(first, sf);
  assert.equal(merged.warnings.length, 1);
  assert.equal(mergeSpreadsheet(merged, sf).warnings.length, 1);
  assert.equal(
    mergeSpreadsheet(merged, parse([combinedRow()], "google:combined")).warnings.length,
    0,
  );
});

test("PCS and PROMIS calculations are preserved after importing SF-36", () => {
  const combined = parse([combinedRow()], "google:combined");
  const merged = mergeSpreadsheet(combined, parse([sfRow()], "google:sf36"));
  const evaluation = merged.evaluations.find((e) => e.scales.includes("pcs"));
  const pcs = calculatePcs(evaluation);
  assert.deepEqual([pcs.total, pcs.rumination, pcs.magnification, pcs.helplessness], [13, 4, 3, 6]);
  const promis = calculatePromis29(evaluation);
  assert.equal(promis.complete, true);
  assert.equal(promis.totalRaw, 89);
  assert.deepEqual(
    promis.domains.map((d) => d.tScore),
    [36.7, 63.4, 62.2, 57, 54.3, 44.2, 61.2],
  );
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
  assert.equal(init.evaluations[0].moment, "Avaliação inicial");
  assert.equal(init.evaluations[0].date, "22/09/2026");
  const sf = parse([sfRow()], "google:sf36");
  const patients = groupPatients(mergeSpreadsheet(sf, init).evaluations);
  assert.equal(patients.length, 1);
  assert.equal(patients[0].evaluations.length, 2);
  assert.throws(() => validateSource(init, "sf36"), /Este campo aceita/);
});

function setSf(row, id, value) {
  const [, number, letter] = id.match(/^(\d+)([a-j]?)$/);
  const header = Object.keys(row).find(
    (h) => h.startsWith(`${number} —`) && (!letter || h.includes(`[${letter})`)),
  );
  assert.ok(header, `Missing fixture header: ${id}`);
  row[header] = String(value);
  return row;
}
const sfResult = (row) => calculateSf36(parse([row]).evaluations[0]);
const domain = (result, id) => result.domains.find((d) => d.id === id);

test("SF-36 scores all eight separate domains with the correction DOCX weights", () => {
  const result = sfResult(sfRow());
  assert.deepEqual(
    result.domains.map((d) => d.score),
    [45, 50, 100, 50, 40, 50, 33.3, 56],
  );
  assert.ok(result.domains.every((d) => !d.estimated && !d.issues.length));
  assert.equal(result.items.find((i) => i.id === "9a").weighted, 6);
  assert.equal(result.items.find((i) => i.id === "9b").weighted, 2);
  assert.equal(result.items.find((i) => i.id === "11b").weighted, 4);
  assert.equal(result.items.find((i) => i.id === "11a").weighted, 1);
  assert.equal(Object.hasOwn(result, "total"), false);
});

test("SF-36 reproduces the two worked examples: physical function 55 and pain 74", () => {
  const row = sfRow();
  for (const letter of "abcdefghij") setSf(row, `3${letter}`, 2);
  setSf(row, "3a", 3); // Sum 21, lower 10, range 20 => 55.
  setSf(row, "7", 2);
  setSf(row, "8", 2); // Weights 5.4 + 4 => 74.
  const result = sfResult(row);
  assert.equal(domain(result, "physicalFunction").score, 55);
  assert.equal(domain(result, "pain").score, 74);
  assert.equal(domain(result, "pain").rawScore, 9.4);
});

test("SF-36 pain follows every stated dependency and the DOCX severe-pain weight 2.0", () => {
  const q7Weights = [6, 5.4, 4.2, 3.1, 2, 1];
  for (let q7 = 2; q7 <= 6; q7++) {
    for (let q8 = 1; q8 <= 5; q8++) {
      const result = sfResult(setSf(setSf(sfRow(), "7", q7), "8", q8));
      assert.equal(
        domain(result, "pain").score,
        Math.round((q7Weights[q7 - 1] + 6 - q8 - 2) * 100) / 10,
      );
    }
  }
  assert.equal(domain(sfResult(setSf(setSf(sfRow(), "7", 5), "8", 4)), "pain").score, 20);
  for (let q8 = 2; q8 <= 5; q8++) {
    const pain = domain(sfResult(setSf(setSf(sfRow(), "7", 1), "8", q8)), "pain");
    assert.equal(pain.score, null);
    assert.match(pain.issues[0], /sem regra/);
  }
});

test("SF-36 uses the supplied Q8 fallback when Q7 is blank and labels the domain estimated", () => {
  for (let q8 = 1; q8 <= 5; q8++) {
    const result = sfResult(setSf(setSf(sfRow(), "7", ""), "8", q8));
    const pain = domain(result, "pain");
    assert.equal(pain.score, [100, 75, 50, 25, 0][q8 - 1]);
    assert.equal(pain.estimated, true);
    assert.equal(pain.answered, 1);
    assert.equal(result.items.find((i) => i.id === "7").original, "");
  }
});

test("SF-36 requires at least 50% of each domain, including rounding up for odd item counts", () => {
  const row = sfRow();
  for (const letter of "abcdefghij") setSf(row, `3${letter}`, "");
  for (const letter of "abcd") setSf(row, `3${letter}`, 3);
  assert.equal(domain(sfResult(row), "physicalFunction").score, null);
  setSf(row, "3e", 3);
  const enough = domain(sfResult(row), "physicalFunction");
  assert.equal(enough.score, 100);
  assert.equal(enough.estimated, true);
  setSf(row, "5a", "");
  setSf(row, "5b", "");
  assert.equal(domain(sfResult(row), "emotionalRole").score, null);
  setSf(row, "5b", 2);
  assert.equal(domain(sfResult(row), "emotionalRole").score, 50);
  setSf(row, "1", "");
  setSf(row, "11a", "");
  setSf(row, "11b", "");
  assert.equal(domain(sfResult(row), "generalHealth").score, null);
  setSf(row, "11b", 1);
  assert.equal(domain(sfResult(row), "generalHealth").estimated, true);
});

test("SF-36 general health uses Q1 and Q11; Q2 and emotional-role changes never affect it", () => {
  const row = sfRow();
  const before = sfResult(row);
  setSf(row, "2", 5);
  for (const letter of "abc") setSf(row, `5${letter}`, 2);
  const after = sfResult(row);
  assert.equal(after.healthChange, "Muito pior");
  assert.equal(domain(after, "generalHealth").score, domain(before, "generalHealth").score);
  assert.equal(domain(after, "emotionalRole").score, 100);
  setSf(row, "1", 5);
  assert.equal(domain(sfResult(row), "generalHealth").score, 30);
});

test("invalid SF-36 answers block only affected domains, with no estimated replacement", () => {
  const row = sfRow();
  setSf(row, "1", "Boa (1)");
  setSf(row, "7", "Grave (99)");
  const result = sfResult(row);
  assert.equal(domain(result, "generalHealth").score, null);
  assert.equal(domain(result, "pain").score, null);
  assert.equal(domain(result, "physicalFunction").score, 45);
  assert.equal(domain(result, "mentalHealth").score, 56);
  assert.equal(result.items.find((i) => i.id === "1").original, "Boa (1)");
});

test("PCS interpretation includes the 30-point boundary and subscale cutoffs", () => {
  for (const [total, classification] of [
    [14, "low"],
    [15, "moderate"],
    [29, "moderate"],
    [30, "clinicallyRelevant"],
    [31, "clinicallyRelevant"],
  ]) {
    const row = combinedRow();
    let remaining = total;
    for (const header of Object.keys(row).filter((h) =>
      h.startsWith("Quando estou sentindo dor"),
    )) {
      const value = Math.min(4, remaining);
      row[header] = String(value);
      remaining -= value;
    }
    const result = calculatePcs(parse([row]).evaluations[0]);
    assert.equal(result.total, total);
    assert.equal(result.totalClassification, classification);
  }
  for (const [items, cutoff, flag] of [
    [[8, 9, 10, 11], 11, "ruminationSignificant"],
    [[6, 7, 13], 5, "magnificationSignificant"],
    [[1, 2, 3, 4, 5, 12], 13, "helplessnessSignificant"],
  ]) {
    for (const target of [cutoff - 1, cutoff]) {
      const row = combinedRow();
      let remaining = target;
      for (const header of Object.keys(row).filter((h) =>
        h.startsWith("Quando estou sentindo dor"),
      )) {
        const number = Number(header.match(/\[(\d+)/)[1]);
        const value = items.includes(number) ? Math.min(4, remaining) : 0;
        row[header] = String(value);
        remaining -= value;
      }
      assert.equal(calculatePcs(parse([row]).evaluations[0])[flag], target === cutoff);
    }
  }
});

test("PROMIS classifies both directions at all DOCX boundaries", () => {
  for (const [t, classification] of [
    [54.9, "normal"],
    [55, "mild"],
    [59.9, "mild"],
    [60, "moderate"],
    [69.9, "moderate"],
    [70, "severe"],
  ])
    assert.equal(classifyPromisTScore(t, "higherWorse"), classification);
  for (const [t, classification] of [
    [45.1, "normal"],
    [45, "mild"],
    [40, "mild"],
    [39.9, "moderate"],
    [30, "moderate"],
    [29.9, "severe"],
  ])
    assert.equal(classifyPromisTScore(t, "higherBetter"), classification);
  assert.equal(classifyPromisTScore(null, "higherBetter"), "notAvailable");
});

test("PROMIS estimates one missing answer, but never converts two missing or contradictory answers", () => {
  const row = combinedRow();
  const physical = Object.keys(row).filter((h) => h.startsWith("Função física"));
  row[physical[0]] = "";
  let result = calculatePromis29(parse([row]).evaluations[0]);
  assert.equal(result.domains[0].estimated, true);
  assert.equal(result.domains[0].tScore, 36.7);
  row[physical[1]] = "";
  result = calculatePromis29(parse([row]).evaluations[0]);
  assert.equal(result.domains[0].tScore, null);
  assert.equal(result.totalRaw, null);
  row[physical[1]] = "Incapaz de fazer (5)";
  result = calculatePromis29(parse([row]).evaluations[0]);
  assert.equal(result.domains[0].invalid, true);
  assert.equal(result.domains[0].tScore, null);
  const duplicate = combinedRow();
  delete duplicate[physical[1]];
  duplicate[`${physical[0]} `] = duplicate[physical[0]];
  result = calculatePromis29(parse([duplicate]).evaluations[0]);
  assert.equal(result.domains[0].invalid, true);
  assert.equal(result.domains[0].tScore, null);
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
    assert.doesNotMatch(html, /Apuração dos escores|Apuração por domínio|Apuração das subescalas/);
    assert.ok(!html.includes("NaN"));
  }
});
