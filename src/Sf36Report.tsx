import { Evaluation, PatientGroup } from './types';
import { EvaluationPicker } from './EvaluationPicker';
import { FormResponses } from './FormResponses';
import { organizedResponses, selectedChoice } from './services/forms';
import { calculateSf36 } from './services/sf36';

const formatScore = (value: number | null, digits = 1) => value === null ? '—' : value.toLocaleString('pt-BR', { maximumFractionDigits: digits });

export function Sf36Report({ selectedPatient, selectedEvaluation, setSelectedEvaluationRow }: {
  selectedPatient: PatientGroup;
  selectedEvaluation: Evaluation;
  setSelectedEvaluationRow: (row: string) => void;
}) {
  const groups = organizedResponses(selectedEvaluation, 'sf36');
  const summary = groups.map(group => ({
    ...group,
    answered: group.questions.filter(q => !q.ambiguous && selectedChoice(q.value, q.options) !== undefined).length,
    review: group.questions.filter(q => q.ambiguous || (q.value && selectedChoice(q.value, q.options) === undefined)).length + group.extraQuestions.length,
  }));
  const answered = summary.reduce((total, group) => total + group.answered, 0);
  const result = calculateSf36(selectedEvaluation);

  return <section className="result-panel card print-report sf36-report">
    <div className="print-only"><h1>Clínica da Dor — NUTES / UEPB · SF-36</h1></div>
    <div className="patient-header">
      <div><span className="eyebrow">Paciente</span><h2>{selectedPatient.name || 'Paciente sem nome'}</h2><p>ID: {selectedPatient.id || '—'}</p></div>
      <span className="eyebrow">Interpretação e respostas</span>
    </div>
    <EvaluationPicker evaluations={selectedPatient.evaluations} selected={selectedEvaluation} onChange={setSelectedEvaluationRow} />
    <div className="metadata-grid">
      <div><span>Data</span><strong>{selectedEvaluation.date || '—'}</strong></div>
      <div><span>Momento</span><strong>{selectedEvaluation.moment || '—'}</strong></div>
      <div><span>Responsável</span><strong>{selectedEvaluation.researcher || '—'}</strong></div>
    </div>
    <p className="source-record">Registro: {selectedEvaluation.sourceLabel} · {selectedEvaluation.sheetName} · linha {selectedEvaluation.rowNumber}</p>
    {!!selectedEvaluation.errors.length && <div className="alert" role="alert"><strong>Confira a identificação deste registro</strong><ul>{selectedEvaluation.errors.map(error => <li key={error}>{error}</li>)}</ul></div>}

    <section className="promis-title-block">
      <span className="eyebrow">Instrumento de autorrelato</span>
      <h2>SF-36 — Questionário de Qualidade de Vida</h2>
      <p>Os oito domínios são interpretados separadamente: 0 representa o pior estado e 100, o melhor. Quanto maior o escore, melhor o resultado naquele domínio.</p>
    </section>

    <section className="promis-section result-interpretation" aria-label="Interpretação dos resultados SF-36">
      <div className="section-kicker">01 · Interpretação dos resultados</div>
      <div className="table-scroll sf36-interpretation" role="region" aria-label="Resultados por domínio SF-36" tabIndex={0}>
        <table><thead><tr><th>Domínio</th><th>Resultado · 0 a 100</th><th>Situação</th></tr></thead><tbody>{result.domains.map(domain => <tr key={domain.id}>
          <th scope="row">{domain.label}</th>
          <td><div className="domain-result"><strong>{formatScore(domain.score)}{domain.score !== null && <small> /100</small>}</strong>{domain.score !== null && <span className="domain-track" role="img" aria-label={`${domain.label}: ${formatScore(domain.score)} de 100; maior é melhor`}><span style={{ width: `${domain.score}%` }} /></span>}</div></td>
          <td>{domain.issues.length ? 'Conferir respostas' : domain.score === null ? 'Respostas insuficientes' : domain.estimated ? 'Estimado' : 'Completo'}</td>
        </tr>)}</tbody></table>
      </div>
      <div className="promis-summary-line"><span>0 = pior estado</span><span>100 = melhor estado</span></div>
      <p className="promis-note">Os domínios não são somados nem usados para calcular uma média geral. A folha de correção não define faixas de gravidade para esses resultados.</p>
      <p className="health-change"><strong>Saúde em relação a um ano atrás:</strong> {result.healthChange}. A questão 2 é apresentada separadamente e não entra nos escores.</p>
      {result.domains.some(domain => domain.estimated) && <p className="promis-note">Resultados estimados usam a média dos itens ponderados respondidos, com pelo menos 50% dos itens do domínio. As respostas originais permanecem como registradas.</p>}
      {result.domains.some(domain => domain.issues.length) && <div className="alert" role="alert"><strong>Confira os itens indicados antes de interpretar os domínios afetados.</strong><ul>{result.domains.flatMap(domain => domain.issues.map(issue => <li key={`${domain.id}-${issue}`}>{domain.label} · {issue}</li>))}</ul></div>}
    </section>

    <section className="promis-section">
      <div className="section-kicker">02 · Apuração dos escores</div>
      <div className="table-scroll sf36-calculation" role="region" aria-label="Cálculo dos escores SF-36" tabIndex={0}>
        <table><thead><tr><th>Domínio</th><th>Questões</th><th>Itens respondidos</th><th>Soma ponderada</th><th>Cálculo</th></tr></thead><tbody>{result.domains.map(domain => <tr key={domain.id}>
          <th scope="row">{domain.label}</th><td>{domain.questions}</td><td>{domain.answered}/{domain.expected}{domain.estimated ? ' · estimado' : ''}</td>
          <td className="score-cell">{formatScore(domain.rawScore, 3)}</td><td>{domain.score === null ? 'Não calculado' : `[(${formatScore(domain.rawScore, 3)} − ${domain.lower}) × 100] ÷ ${domain.range} ≈ ${formatScore(domain.score)}`}</td>
        </tr>)}</tbody></table>
      </div>
      <p className="promis-note">As ponderações e a fórmula seguem a folha de correção fornecida. Valores ausentes, desconhecidos ou duplicados não são substituídos por zero.</p>
      <details className="original-fields"><summary>Ver a ponderação dos itens</summary><div className="table-scroll"><table><thead><tr><th>Item</th><th>Resposta registrada</th><th>Código</th><th>Valor ponderado</th></tr></thead><tbody>{result.items.map(item => <tr key={item.id}><th scope="row">{item.id}</th><td>{item.original || 'Não respondida'}</td><td>{item.code ?? '—'}</td><td>{item.id === '2' ? 'Não entra nos domínios' : formatScore(item.weighted, 2)}{item.issue && <small className="item-issue">{item.issue}</small>}</td></tr>)}</tbody></table></div></details>
    </section>

    <section className="promis-section">
      <div className="section-kicker">03 · Resumo do preenchimento</div>
      <div className="table-scroll sf36-summary" role="region" aria-label="Preenchimento SF-36" tabIndex={0}>
        <table>
          <thead><tr><th>Questão</th><th>Grupo</th><th>Respostas reconhecidas</th><th>Situação</th></tr></thead>
          <tbody>{summary.map((group, index) => <tr key={group.id}>
            <td>{String(index + 1).padStart(2, '0')}</td><th scope="row">{group.title}</th>
            <td className="score-cell">{group.answered}/{group.expected}</td>
            <td>{group.review ? 'Conferir respostas' : group.answered === group.expected ? 'Completo' : 'Incompleto'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="promis-summary-line"><span>Respostas reconhecidas: <strong>{answered}/36</strong></span><span>Grupos completos: <strong>{summary.filter(g => g.answered === g.expected && !g.review).length}/11</strong></span></div>
    </section>

    <section className="promis-section response-section">
      <div className="section-kicker">04 · Respostas registradas</div>
      <FormResponses evaluation={selectedEvaluation} scale="sf36" />
    </section>
    <details className="original-fields no-print"><summary>Consultar todos os campos originais da planilha</summary><dl className="field-grid raw-fields">{Object.entries(selectedEvaluation.fields).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Não informado'}</dd></div>)}</dl></details>
    <div className="actions-row no-print"><button className="button primary" onClick={() => window.print()}>Imprimir SF-36 / salvar PDF</button></div>
  </section>;
}
