import type { Evaluation, PatientGroup } from "./types";
import { displayDate } from "./services/spreadsheet";
import { EvaluationPicker } from "./EvaluationPicker";
import { ScaleId, SCALE_NAMES } from "./services/forms";

const sections = [
  { title: "Dados pessoais e sociodemográficos", start: 5, end: 10 },
  { title: "Queixa principal e histórico de saúde", start: 11, end: 16 },
  { title: "Hábitos e estilo de vida", start: 17, end: 23 },
  { title: "Medicamentos e caracterização da dor", start: 24, end: 33 },
  { title: "Características e sintomas associados à dor", start: 34, end: 41 },
  { title: "Medidas e sinais vitais", start: 42, end: 48 },
];
const ignore =
  /^(carimbo de data\/hora|código\/id único do paciente|data da avaliação|extensionista\/pesquisador\(a\) responsável pela coleta|nome completo do paciente)$/i;

export function PatientBasics({
  patient,
  initial,
}: {
  patient: PatientGroup;
  initial?: Evaluation;
}) {
  const entries = Object.entries(initial?.fields ?? {});
  const get = (index: number) => entries[index - 1]?.[1]?.trim() || "—";
  return (
    <div className="patient-basics">
      <div>
        <span>Identificação</span>
        <strong>{patient.id || "—"}</strong>
      </div>
      <div>
        <span>Gênero</span>
        <strong>{initial ? get(6) : "—"}</strong>
      </div>
      <div>
        <span>Município de residência</span>
        <strong>{initial ? get(10) : "—"}</strong>
      </div>
      <div>
        <span>Data da avaliação inicial</span>
        <strong>{initial?.date || "—"}</strong>
      </div>
    </div>
  );
}
export function InitialRecord({ evaluation }: { evaluation: Evaluation }) {
  const entries = Object.entries(evaluation.fields);
  return (
    <div className="initial-record">
      <div className="metadata-grid">
        <div>
          <span>Data</span>
          <strong>{evaluation.date || "—"}</strong>
        </div>
        <div>
          <span>Responsável</span>
          <strong>{evaluation.researcher || "—"}</strong>
        </div>
      </div>
      {sections.map((section) => {
        const data = entries
          .slice(section.start - 1, section.end)
          .filter(([question]) => !ignore.test(question));
        return (
          <section key={section.title} className="record-section">
            <h3>{section.title}</h3>
            <dl className="record-fields">
              {data.map(([question, value]) => (
                <div key={question}>
                  <dt>{question}</dt>
                  <dd>{/^\d{5}$/.test(value) ? displayDate(value) : value || "Não informado"}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
export function PatientRecord({
  patient,
  onScale,
  onExport,
}: {
  patient: PatientGroup;
  onScale: (scale: ScaleId, evaluation: Evaluation) => void;
  onExport: () => void;
}) {
  const initial = patient.evaluations.filter((e) => !e.scales.length);
  const [selected, setSelected] = importReactState(initial[0]?.recordKey || "");
  const [showForm, setShowForm] = importReactState(false);
  const current = initial.find((e) => e.recordKey === selected) || initial[0];
  return (
    <section className="result-panel card dossier">
      <div className="patient-header">
        <div>
          <span className="eyebrow">Prontuário clínico</span>
          <h2>{patient.name || "Paciente sem nome"}</h2>
          <p>Código do paciente: {patient.id || "—"}</p>
        </div>
      </div>
      <PatientBasics patient={patient} initial={current} />
      <section className="record-section">
        <div className="section-heading">
          <h2>Avaliação inicial</h2>
        </div>
        {current ? (
          <>
            <div className="metadata-grid">
              <div>
                <span>Data da avaliação</span>
                <strong>{current.date || "—"}</strong>
              </div>
              <div>
                <span>Responsável</span>
                <strong>{current.researcher || "—"}</strong>
              </div>
            </div>
            {initial.length > 1 && (
              <EvaluationPicker
                evaluations={initial}
                selected={current}
                onChange={(key) => {
                  setSelected(key);
                  setShowForm(false);
                }}
              />
            )}
            <button
              className="button secondary no-print"
              onClick={() => setShowForm((prev) => !prev)}
              aria-expanded={showForm}
            >
              {showForm ? "Ocultar formulário da avaliação inicial" : "Exibir detalhes"}
            </button>
            {showForm && <InitialRecord evaluation={current} />}
          </>
        ) : (
          <p className="helper">Não há avaliação inicial cadastrada para este paciente.</p>
        )}
      </section>
      <section className="record-section">
        <h2>Escalas aplicadas</h2>
        <p className="helper">
          Escolha a escala e depois o momento da avaliação que deseja consultar.
        </p>
        <div className="record-scale-list">
          {(["pcs", "promis", "sf36"] as ScaleId[]).map((scale) => {
            const available = patient.evaluations.filter((e) => e.scales.includes(scale));
            return (
              <div className="record-scale" key={scale}>
                <div>
                  <h3>{SCALE_NAMES[scale]}</h3>
                  <span>{available.length} avaliação(ões)</span>
                </div>
                {available.length > 0 ? (
                  <div className="record-moments">
                    {available.map((e) => (
                      <button
                        key={e.recordKey}
                        className="button secondary"
                        onClick={() => onScale(scale, e)}
                      >
                        {e.moment || "Sem momento"} · {e.date || "Sem data"} →
                      </button>
                    ))}
                  </div>
                ) : (
                  <small className="helper">Nenhuma avaliação cadastrada</small>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <div className="actions-row">
        <button className="button primary" onClick={onExport}>
          Exportar prontuário · configurar PDF
        </button>
      </div>
    </section>
  );
}
import { useState as importReactState } from "react";
