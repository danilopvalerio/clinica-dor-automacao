import { Evaluation, PatientGroup, PcsResult } from './types';
import { PCS_RULES, PCS_TOTAL_READINGS } from './services/pcs';
import { EvaluationDetails } from './EvaluationDetails';
import { EvaluationPicker } from './EvaluationPicker';
const scoreTone = (significant: boolean) => significant ? 'warning' : 'ok';
export function EvaluationReport({selectedPatient, selectedEvaluation, pcsResult, setSelectedEvaluationRow, detailed, onDetails}: {selectedPatient:PatientGroup;selectedEvaluation:Evaluation;pcsResult:PcsResult|null;setSelectedEvaluationRow:(row:string)=>void;detailed:boolean;onDetails:()=>void}) {
 return <section className="result-panel card print-report">
 <div className="print-only"><h1>Clínica da Dor — NUTES / UEPB · PCS</h1></div>
                <div className="patient-header">
                  <div>
                    <span className="eyebrow">Paciente</span>
                    <h2>{selectedPatient.name || 'Paciente sem nome'}</h2>
                    <p>ID: {selectedPatient.id || '—'}</p>
                  </div>

                </div>

                <EvaluationPicker evaluations={selectedPatient.evaluations} selected={selectedEvaluation} onChange={setSelectedEvaluationRow}/>
                <div className="metadata-grid">
                  <div><span>Data</span><strong>{selectedEvaluation.date || '—'}</strong></div>
                  <div><span>Momento</span><strong>{selectedEvaluation.moment || '—'}</strong></div>
                  <div><span>Responsável</span><strong>{selectedEvaluation.researcher || '—'}</strong></div>
                </div>

                <p className="source-record">Registro: {selectedEvaluation.sourceLabel} · {selectedEvaluation.sheetName} · linha {selectedEvaluation.rowNumber}</p>
                {selectedEvaluation.errors.length > 0 ? (
                  <div className="alert error result-error">
                    <strong>Não é possível calcular esta avaliação.</strong>
                    <ul>{selectedEvaluation.errors.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                ) : pcsResult ? (
                  <>
                    <section className="promis-section result-interpretation" aria-label="Interpretação dos resultados PCS">
                     <div className="section-kicker">01 · Interpretação dos resultados</div>
                     <div className={`total-card ${pcsResult.totalClassification}`}>
                      <div><span className="eyebrow">Escore total PCS</span><div className="total-score">{pcsResult.total}<small>/52</small></div></div>
                      <div className="total-interpretation"><span>Interpretação</span><strong>{pcsResult.totalLabel}</strong></div>
                     </div>
                     <p className="interpretation-reading">{PCS_TOTAL_READINGS[pcsResult.totalClassification]}</p>
                     <div className="thresholds"><span>Total: 0–14 baixa</span><span>15–29 moderada</span><span>≥ 30 clinicamente relevante</span></div>
                     <div className="interpretation-subscales">{[
                      {label:'Ruminação',significant:pcsResult.ruminationSignificant,description:'Pensamentos intrusivos e repetitivos sobre a dor; incapacidade de desviar a atenção dela.'},
                      {label:'Magnificação',significant:pcsResult.magnificationSignificant,description:'Ampliação da ameaça representada pela dor e antecipação de desfechos negativos.'},
                      {label:'Desamparo',significant:pcsResult.helplessnessSignificant,description:'Sensação de incapacidade de lidar com a dor ou de influenciar seu curso.'},
                     ].map(subscale=><div key={subscale.label}><h3>{subscale.label}<span className="status-badge">{subscale.significant?'Pontuação significativa':'Abaixo do ponto de corte'}</span></h3><p>{subscale.description}</p></div>)}</div>
                    </section>
                    <section className="promis-section">
                    <div className="section-kicker">02 · Apuração das subescalas</div>
                    <div className="score-grid">
                      <ScoreCard
                        title="Ruminação"
                        score={pcsResult.rumination}
                        max={PCS_RULES.rumination.max}
                        significant={pcsResult.ruminationSignificant}
                      />
                      <ScoreCard
                        title="Magnificação"
                        score={pcsResult.magnification}
                        max={PCS_RULES.magnification.max}
                        significant={pcsResult.magnificationSignificant}
                      />
                      <ScoreCard
                        title="Desamparo"
                        score={pcsResult.helplessness}
                        max={PCS_RULES.helplessness.max}
                        significant={pcsResult.helplessnessSignificant}
                      />
                    </div>

                    </section>
                    <div className="actions-row no-print">
                      
                      <button className="button primary" onClick={() => window.print()}>
                        Imprimir / salvar PDF
                      </button>
                    </div>
                  </>
                ) : null}
 {!detailed && <div className="actions-row no-print"><button className="button secondary" onClick={onDetails}>Ver detalhes e respostas</button></div>}
 {detailed && <EvaluationDetails evaluation={selectedEvaluation} result={pcsResult}/>}
 </section>;
}
function ScoreCard({
  title,
  score,
  max,
  significant,
}: {
  title: string;
  score: number;
  max: number;
  significant: boolean;
}) {
  return (
    <div className={`score-card ${scoreTone(significant)}`}>
      <div className="score-card-top">
        <h3>{title}</h3>
        <span className={`status-badge ${scoreTone(significant)}`}>
          {significant ? 'Significativa' : 'Não significativa'}
        </span>
      </div>
      <div className="score-value">{score}<small>/{max}</small></div>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (score / max) * 100)}%` }} />
      </div>
    </div>
  );
}
