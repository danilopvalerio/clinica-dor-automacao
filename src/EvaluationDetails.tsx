import { Evaluation, PcsItemNumber } from "./types";
import { FormResponses } from "./FormResponses";
const options = [
  "De forma alguma",
  "Em um grau leve",
  "Em um grau moderado",
  "Em um grau elevado",
  "O tempo todo",
];
const subscales = [
  {
    key: "rumination",
    label: "Ruminação",
    description:
      "Pensamentos intrusivos e repetitivos sobre a dor; incapacidade de desviar a atenção dela.",
  },
  {
    key: "magnification",
    label: "Magnificação",
    description: "Ampliação da ameaça representada pela dor e antecipação de desfechos negativos.",
  },
  {
    key: "helplessness",
    label: "Desamparo",
    description: "Sensação de incapacidade de lidar com a dor ou de influenciar seu curso.",
  },
] as const;
export function EvaluationDetails({ evaluation }: { evaluation: Evaluation }) {
  return (
    <div className="evaluation-details">
      <section className="report-section questionnaire">
        <span className="eyebrow">Parte 2 · Respostas marcadas</span>
        <h2>Escala de Catastrofização da Dor</h2>
        <p>
          Pensamentos e sentimentos do paciente quando está sentindo dor. As marcações abaixo
          reproduzem as respostas registradas na planilha.
        </p>
        <div className="answer-legend">
          {options.map((o, i) => (
            <span key={o}>
              <b>{i}</b> {o}
            </span>
          ))}
        </div>
        <div className="question-head" aria-hidden="true">
          <strong>Quando estou sentindo dor…</strong>
          <span>Resposta registrada</span>
        </div>
        {Array.from({ length: 13 }, (_, i) => {
          const item = (i + 1) as PcsItemNumber;
          const answer = evaluation.pcsResponses[item];
          return (
            <div className="question-row" key={item}>
              <div className="question-text">
                <strong>{evaluation.pcsQuestions[item]}</strong>
                <span className={answer === null ? "invalid-answer" : ""}>
                  {answer === null
                    ? "Resposta ausente ou inválida"
                    : `${answer} — ${options[answer]}`}
                </span>
              </div>
              <div className="answer-options" role="group" aria-label={`Resposta do item ${item}`}>
                {options.map((o, value) => (
                  <span
                    key={value}
                    className={`answer-option ${answer === value ? "marked" : ""}`}
                    aria-label={`${value}: ${o}${answer === value ? ", marcado" : ", não marcado"}`}
                  >
                    <small>{value}</small>
                    <span aria-hidden="true">{answer === value ? "●" : "○"}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </section>
      {evaluation.scales.includes("promis") && (
        <section className="report-section">
          <span className="eyebrow">Mesmo registro · somente respostas</span>
          <h2>PROMIS-29</h2>
          <FormResponses evaluation={evaluation} scale="promis" />
        </section>
      )}
      <details className="original-fields no-print">
        <summary>Consultar todos os campos originais da planilha</summary>
        <dl className="field-grid raw-fields">
          {Object.entries(evaluation.fields).map(([field, value]) => (
            <div key={field}>
              <dt>{field}</dt>
              <dd>{value || "Não informado"}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
