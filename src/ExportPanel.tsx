import { useState } from "react";
import type { Evaluation, PatientGroup } from "./types";
import { ScaleId, SCALE_NAMES } from "./services/forms";
import { calculatePcs } from "./services/pcs";
import { calculatePromis29 } from "./services/promis29";
import { calculateSf36 } from "./services/sf36";
import { Sf36DomainScale } from "./Sf36DomainScale";
import { PatientBasics, InitialRecord } from "./PatientRecord";
import { FormResponses } from "./FormResponses";

const scaleIds: ScaleId[] = ["pcs", "promis", "sf36"];
const printValue = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
function ScalePrint({
  scale,
  evaluation,
  includeResponses,
}: {
  scale: ScaleId;
  evaluation: Evaluation;
  includeResponses: boolean;
}) {
  return (
    <section className="pdf-scale-section">
      <div className="pdf-scale-header">
        <h2>{SCALE_NAMES[scale]}</h2>
        <p>
          {evaluation.moment || "Avaliação"} · {evaluation.date || "Sem data"}
        </p>
      </div>
      {scale === "sf36" ? (
        <>
          <div className="sf-domain-list">
            {calculateSf36(evaluation).domains.map((domain) => (
              <Sf36DomainScale key={domain.id} domain={domain} />
            ))}
          </div>
          {includeResponses && <FormResponses evaluation={evaluation} scale="sf36" />}
        </>
      ) : scale === "promis" ? (
        <>
          {(() => {
            const result = calculatePromis29(evaluation);
            return (
              <>
                <table className="pdf-table">
                  <thead>
                    <tr>
                      <th>Domínio</th>
                      <th>T-score</th>
                      <th>Classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.domains.map((d) => (
                      <tr key={d.id}>
                        <td>{d.label}</td>
                        <td>{printValue(d.tScore)}</td>
                        <td>
                          {d.classification === "normal"
                            ? "Dentro da normalidade"
                            : d.classification === "mild"
                              ? "Leve"
                              : d.classification === "moderate"
                                ? "Moderado"
                                : d.classification === "severe"
                                  ? "Grave"
                                  : "Indisponível"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  Intensidade da dor: <strong>{printValue(result.painIntensity)}/10</strong>
                </p>
              </>
            );
          })()}
          {includeResponses && <FormResponses evaluation={evaluation} scale="promis" />}
        </>
      ) : (
        <>
          {(() => {
            if (evaluation.errors.length)
              return (
                <p>Não foi possível calcular esta avaliação: {evaluation.errors.join("; ")}</p>
              );
            const result = calculatePcs(evaluation);
            return (
              <>
                <div className="pdf-score-block">
                  <div>
                    <span>Escore total PCS</span>
                    <strong>{result.total}/52</strong>
                    <small>{result.totalLabel}</small>
                  </div>
                  <div>
                    <span>Ruminação</span>
                    <strong>{result.rumination}/16</strong>
                  </div>
                  <div>
                    <span>Magnificação</span>
                    <strong>{result.magnification}/12</strong>
                  </div>
                  <div>
                    <span>Desamparo</span>
                    <strong>{result.helplessness}/24</strong>
                  </div>
                </div>
                <p>
                  Faixas de referência: 0–14 baixa; 15–29 moderada; ≥ 30 clinicamente relevante.
                </p>
              </>
            );
          })()}
          {includeResponses && (
            <table className="pdf-table">
              <thead>
                <tr>
                  <th>Questão</th>
                  <th>Resposta (0–4)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(evaluation.pcsResponses).map(([n, value]) => (
                  <tr key={n}>
                    <td>
                      {n}. {evaluation.pcsQuestions[Number(n) as keyof Evaluation["pcsQuestions"]]}
                    </td>
                    <td>{value ?? "Não informado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}

export function ExportPanel({
  patient,
  onClose,
  defaultScale,
  defaultRecordKey,
}: {
  patient: PatientGroup;
  onClose: () => void;
  defaultScale?: ScaleId;
  defaultRecordKey?: string;
}) {
  const entries = scaleIds.flatMap((scale) =>
    patient.evaluations
      .filter((e) => e.scales.includes(scale))
      .map((e) => ({ key: `${scale}:${e.recordKey}`, scale, evaluation: e })),
  );
  const initial = patient.evaluations.filter((e) => e.scales.length === 0);
  const [checked, setChecked] = useState<Record<string, boolean>>(
    defaultScale && defaultRecordKey ? { [`${defaultScale}:${defaultRecordKey}`]: true } : {},
  );
  const [selectedInitial, setSelectedInitial] = useState(initial[0]?.recordKey || "");
  const [includeDossier, setIncludeDossier] = useState(!defaultScale && initial.length > 0);
  const [includeResponses, setIncludeResponses] = useState(false);
  const chosen = entries.filter((e) => checked[e.key]);
  const currentInitial = initial.find((e) => e.recordKey === selectedInitial) || initial[0];
  const count = chosen.length + (includeDossier && currentInitial ? 1 : 0);
  const toggle = (key: string) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  const print = () => {
    if (!count) return;
    const previous = document.title;
    document.title = `Prontuario_${(patient.id || patient.name).replace(/[^\p{L}\p{N}-]/gu, "_")}`;
    // The preview is already mounted before print; restore the tab title afterwards.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
        document.title = previous;
      });
    });
  };
  return (
    <>
      <div className="pdf-modal-backdrop no-print" role="presentation" onClick={onClose}>
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-title"
          className="pdf-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pdf-modal-heading">
            <div>
              <span className="eyebrow">Exportação personalizada</span>
              <h2 id="export-title">Montar prontuário em PDF</h2>
              <p>
                Ficha do paciente na primeira página. Selecione as avaliações e os momentos que
                deseja incluir.
              </p>
            </div>
            <button className="button secondary" onClick={onClose} aria-label="Fechar">
              ✕
            </button>
          </div>
          <div className="pdf-modal-content">
            <div className="pdf-choice-section">
              <label className="pdf-check">
                <input
                  type="checkbox"
                  checked={includeDossier}
                  disabled={!initial.length}
                  onChange={(e) => setIncludeDossier(e.target.checked)}
                />
                <span>
                  <strong>Prontuário / avaliação inicial</strong>
                  <small>
                    {initial.length
                      ? "Incluir respostas e informações da avaliação inicial"
                      : "Sem avaliação inicial disponível"}
                  </small>
                </span>
              </label>
              {includeDossier && initial.length > 1 && (
                <div className="pdf-dossier-picker">
                  <label htmlFor="pdf-initial">Registro da avaliação inicial</label>
                  <select
                    id="pdf-initial"
                    value={selectedInitial}
                    onChange={(e) => setSelectedInitial(e.target.value)}
                  >
                    {initial.map((e) => (
                      <option key={e.recordKey} value={e.recordKey}>
                        {e.date || "Sem data"} · Avaliação inicial
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {scaleIds.map((scale) => {
              const list = entries.filter((item) => item.scale === scale);
              return (
                <div className="pdf-choice-section" key={scale}>
                  <div className="pdf-group-heading">
                    <strong>{SCALE_NAMES[scale]}</strong>
                    <label>
                      <input
                        type="checkbox"
                        disabled={!list.length}
                        checked={list.length > 0 && list.every((item) => checked[item.key])}
                        onChange={(event) =>
                          setChecked((prev) => ({
                            ...prev,
                            ...Object.fromEntries(
                              list.map((item) => [item.key, event.target.checked]),
                            ),
                          }))
                        }
                      />{" "}
                      Selecionar todas
                    </label>
                  </div>
                  {list.length ? (
                    list.map((item) => (
                      <label className="pdf-check" key={item.key}>
                        <input
                          type="checkbox"
                          checked={Boolean(checked[item.key])}
                          onChange={() => toggle(item.key)}
                        />
                        <span>
                          {item.evaluation.moment || "Avaliação"} ·{" "}
                          {item.evaluation.date || "Sem data"}
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="helper">Nenhuma avaliação cadastrada.</p>
                  )}
                </div>
              );
            })}
            <label className="pdf-check pdf-option">
              <input
                type="checkbox"
                checked={includeResponses}
                onChange={(e) => setIncludeResponses(e.target.checked)}
              />
              <span>
                <strong>Incluir respostas das escalas</strong>
                <small>Adiciona os itens respondidos após a interpretação.</small>
              </span>
            </label>
          </div>
          <div className="pdf-modal-footer">
            <span>{count} seção(ões) selecionada(s), além da ficha do paciente</span>
            <div>
              <button className="button secondary" onClick={onClose}>
                Cancelar
              </button>
              <button className="button primary" disabled={!count} onClick={print}>
                Imprimir / salvar em PDF
              </button>
            </div>
          </div>
        </section>
      </div>
      <article className="pdf-document" aria-label="Documento para exportação">
        <header className="pdf-cover">
          <h1>Clínica da Dor</h1>
          <p>NUTES · Universidade Estadual da Paraíba</p>
          <h2>Ficha do paciente</h2>
          <div className="pdf-name">{patient.name || "Paciente sem nome"}</div>
          <p>Identificação: {patient.id || "—"}</p>
          <PatientBasics patient={patient} initial={currentInitial} />
        </header>
        {includeDossier && currentInitial && (
          <section className="pdf-dossier-section">
            <h2>Prontuário · Avaliação inicial</h2>
            <InitialRecord evaluation={currentInitial} />
          </section>
        )}
        {chosen.map(({ key, scale, evaluation }) => (
          <ScalePrint
            key={key}
            scale={scale}
            evaluation={evaluation}
            includeResponses={includeResponses}
          />
        ))}
        <footer className="pdf-footer">
          Clínica da Dor · NUTES / UEPB · Documento para acompanhamento clínico. Interpretar os
          resultados em conjunto com a avaliação profissional.
        </footer>
      </article>
    </>
  );
}
