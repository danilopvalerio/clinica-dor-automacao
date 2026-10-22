import { Evaluation, PatientGroup } from "./types";
import { EvaluationPicker } from "./EvaluationPicker";
import { FormResponses } from "./FormResponses";
import { organizedResponses, selectedChoice } from "./services/forms";
import { calculateSf36 } from "./services/sf36";
import { Sf36DomainScale } from "./Sf36DomainScale";

export function Sf36Report({
  selectedPatient,
  selectedEvaluation,
  setSelectedEvaluationRow,
  onExport,
}: {
  selectedPatient: PatientGroup;
  selectedEvaluation: Evaluation;
  setSelectedEvaluationRow: (row: string) => void;
  onExport: () => void;
}) {
  const result = calculateSf36(selectedEvaluation);
  const summary = organizedResponses(selectedEvaluation, "sf36").map((group) => ({
    ...group,
    answered: group.questions.filter(
      (q) => !q.ambiguous && selectedChoice(q.value, q.options) !== undefined,
    ).length,
    review:
      group.questions.filter(
        (q) => q.ambiguous || (q.value && selectedChoice(q.value, q.options) === undefined),
      ).length + group.extraQuestions.length,
  }));
  const answered = summary.reduce((n, g) => n + g.answered, 0);
  return (
    <section className="result-panel card sf36-report">
      <div className="patient-header">
        <div>
          <span className="eyebrow">Paciente</span>
          <h2>{selectedPatient.name || "Paciente sem nome"}</h2>
          <p>ID: {selectedPatient.id || "—"}</p>
        </div>
      </div>
      <EvaluationPicker
        evaluations={selectedPatient.evaluations}
        selected={selectedEvaluation}
        onChange={setSelectedEvaluationRow}
      />
      <div className="metadata-grid">
        <div>
          <span>Data da avaliação</span>
          <strong>{selectedEvaluation.date || "—"}</strong>
        </div>
        <div>
          <span>Momento</span>
          <strong>{selectedEvaluation.moment || "—"}</strong>
        </div>
      </div>
      <section className="promis-title-block">
        <span className="eyebrow">SF-36</span>
        <h2>Questionário de Qualidade de Vida</h2>
        <p>
          Os oito domínios possuem pontuação própria, de 0 a 100. Quanto maior o escore, melhor o
          resultado naquele domínio.
        </p>
      </section>
      <section
        className="promis-section result-interpretation"
        aria-label="Interpretação dos resultados SF-36"
      >
        <div className="section-kicker">01 · Interpretação dos resultados</div>
        <div className="sf-domain-list">
          {result.domains.map((domain) => (
            <Sf36DomainScale domain={domain} key={domain.id} />
          ))}
        </div>
        <p className="health-change">
          <strong>Saúde em relação a um ano atrás:</strong> {result.healthChange}
        </p>
      </section>
      <details className="report-disclosure">
        <summary>Resumo do preenchimento ({answered}/36 respostas reconhecidas)</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Questão / grupo</th>
                <th>Respostas</th>
                <th>Conferência</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((group) => (
                <tr key={group.id}>
                  <th>{group.title}</th>
                  <td>
                    {group.answered}/{group.expected}
                  </td>
                  <td>
                    {group.review
                      ? "Verificar"
                      : group.answered === group.expected
                        ? "Completo"
                        : "Incompleto"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="report-disclosure">
        <summary>Respostas registradas</summary>
        <FormResponses evaluation={selectedEvaluation} scale="sf36" />
      </details>
      {result.domains.some((d) => d.issues.length > 0) && (
        <details className="report-disclosure">
          <summary>Itens que exigem conferência</summary>
          <ul>
            {result.domains.flatMap((d) =>
              d.issues.map((issue) => (
                <li key={d.id + issue}>
                  {d.label}: {issue}
                </li>
              )),
            )}
          </ul>
        </details>
      )}
      <div className="actions-row no-print">
        <button className="button primary" onClick={onExport}>
          Exportar PDF · escolher conteúdo
        </button>
      </div>
    </section>
  );
}
