import { Evaluation, PatientGroup } from './types';
import { EvaluationPicker } from './EvaluationPicker';
import { calculatePromis29, PromisClassification, PROMIS_INTERPRETATION } from './services/promis29';
import { FormResponses } from './FormResponses';

function classificationLabel(value: PromisClassification): string {
  return value === 'normal' ? 'Dentro da normalidade' : value === 'mild' ? 'Leve' : value === 'moderate' ? 'Moderado' : value === 'severe' ? 'Grave' : 'Não disponível';
}

function formatScore(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(value) ? 0 : 1, maximumFractionDigits: 1 });
}

export function PromisReport({
  selectedPatient,
  selectedEvaluation,
  setSelectedEvaluationRow,
  onExport,
}: {
  selectedPatient: PatientGroup;
  selectedEvaluation: Evaluation;
  setSelectedEvaluationRow: (row: string) => void;
  onExport:()=>void;
}) {
  const result = calculatePromis29(selectedEvaluation);
  return (
    <section className="result-panel card print-report promis-report">
      <div className="print-only"><h1>Clínica da Dor — NUTES / UEPB · PROMIS-29</h1></div>
      <div className="patient-header">
        <div>
          <span className="eyebrow">Paciente</span>
          <h2>{selectedPatient.name || 'Paciente sem nome'}</h2>
          <p>ID: {selectedPatient.id || '—'}</p>
        </div>
        <span className="eyebrow">Consulta de respostas e escores</span>
      </div>

      <EvaluationPicker
        evaluations={selectedPatient.evaluations}
        selected={selectedEvaluation}
        onChange={setSelectedEvaluationRow}
      />
      <div className="metadata-grid">
        <div><span>Data</span><strong>{selectedEvaluation.date || '—'}</strong></div>
        <div><span>Momento</span><strong>{selectedEvaluation.moment || '—'}</strong></div>
        <div><span>Responsável</span><strong>{selectedEvaluation.researcher || '—'}</strong></div>
      </div>

      <section className="promis-title-block">
        <span className="eyebrow">Instrumento de autorrelato</span>
        <h2>PROMIS-29 v2.1 — Perfil de Saúde</h2>
        <p>Os sete domínios são apresentados pelo escore bruto, T-score e classificação correspondente. A intensidade da dor é registrada em uma escala de 0 a 10 e não é convertida em T-score.</p>
      </section>

      <section className="promis-section result-interpretation" aria-label="Interpretação dos resultados PROMIS-29">
        <div className="section-kicker">01 · Interpretação dos resultados</div>
        <div className="table-scroll interpretation-table" role="region" aria-label="Interpretação por domínio PROMIS-29" tabIndex={0}>
          <table><thead><tr><th>Domínio</th><th>Classificação</th><th>T-score</th><th>Leitura</th></tr></thead><tbody>{result.domains.map(domain => <tr key={domain.id}>
            <th scope="row">{domain.label}</th><td><span className={`promis-status ${domain.classification}`}>{classificationLabel(domain.classification)}</span>{domain.estimated && <small className="item-issue">Estimado · 3 de 4 itens</small>}</td>
            <td className="promis-number">{formatScore(domain.tScore)}</td>
            <td>{domain.invalid ? 'Conferir respostas ou colunas do domínio.' : domain.tScore === null ? 'É necessário responder pelo menos 3 dos 4 itens.' : domain.direction === 'higherBetter' ? 'Maior T-score = melhor função ou participação.' : 'Maior T-score = maior impacto do sintoma.'}</td>
          </tr>)}</tbody></table>
        </div>
        <p className="promis-note">A interpretação é feita pelo T-score de cada domínio, separadamente. Na população de referência, a média é 50 e o desvio-padrão é 10 pontos.</p>
        <p className="health-change"><strong>Intensidade da dor:</strong> {formatScore(result.painIntensity)} /10. Este item é apresentado pelo valor registrado, sem T-score nem classificação.</p>
      </section>

      <section className="promis-section">
        <div className="section-kicker">02 · Intensidade da dor</div>
        <PainAxis value={result.painIntensity} />
      </section>

      <section className="promis-section">
        <div className="section-kicker">03 · Critérios de interpretação dos T-scores</div>
        <div className="interpretation-columns">
          <InterpretationColumn title="Sintomas" subtitle="Ansiedade, depressão, fadiga, sono e interferência da dor" rows={PROMIS_INTERPRETATION.symptoms} />
          <InterpretationColumn title="Função e participação" subtitle="Função física e participação social" rows={PROMIS_INTERPRETATION.function} />
        </div>
      </section>

      <details className="report-disclosure response-section"><summary>Respostas registradas</summary>
        <FormResponses evaluation={selectedEvaluation} scale="promis" />
      </details>

      <div className="actions-row no-print"><button className="button primary" onClick={onExport}>Exportar PDF · escolher conteúdo</button></div>
    </section>
  );
}

function InterpretationColumn({ title, subtitle, rows }: { title: string; subtitle: string; rows: ReadonlyArray<{ label: string; rule: string }> }) {
  return <div className="interpretation-column"><h3>{title}</h3><p>{subtitle}</p><ul>{rows.map((row) => <li key={row.label}><strong>{row.label}</strong><span>{row.rule}</span></li>)}</ul></div>;
}

function PainAxis({ value }: { value: number | null }) {
  const marker = value === null ? null : Math.min(10, Math.max(0, value));
  return <div className="pain-axis" aria-label={marker === null ? 'Intensidade da dor não informada' : `Intensidade da dor: ${marker} de 10`}>
    <div className="pain-axis-labels"><span><strong>0</strong> sem dor</span><span><strong>10</strong> pior dor imaginável</span></div>
    <div className="pain-track" role="img" aria-hidden="true">
      {Array.from({ length: 11 }, (_, index) => <span key={index} className="pain-tick" style={{ left: `${index * 10}%` }}><i /></span>)}
      {marker !== null && <span className="pain-marker" style={{ left: `${marker * 10}%` }}><b /><em>{marker}</em></span>}
    </div>
    <p className="pain-value">Resposta registrada: <strong>{marker === null ? 'não informada' : marker}</strong> / 10</p>
  </div>;
}
