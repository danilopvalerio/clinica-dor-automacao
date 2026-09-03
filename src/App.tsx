import { ChangeEvent, useMemo, useState } from 'react';
import { calculatePcs, PCS_RULES } from './services/pcs';
import { groupPatients, parseSpreadsheet } from './services/spreadsheet';
import { Evaluation, PcsResult, SpreadsheetParseResult } from './types';

const EXAMPLE_LINK =
  'https://docs.google.com/spreadsheets/d/1l4nZqJUeDWCive3MqWGEk13-drRKlL4D4kw-iti5XYg/edit?resourcekey=&gid=218267114#gid=218267114';

const scoreTone = (significant: boolean) => (significant ? 'warning' : 'ok');

function App() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [data, setData] = useState<SpreadsheetParseResult | null>(null);
  const [sourceLabel, setSourceLabel] = useState('Nenhuma fonte carregada');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedPatientKey, setSelectedPatientKey] = useState('');
  const [selectedEvaluationRow, setSelectedEvaluationRow] = useState<number | null>(null);
  const [savedPdf, setSavedPdf] = useState('');

  const patients = useMemo(() => groupPatients(data?.evaluations ?? []), [data]);

  const filteredPatients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return patients;
    return patients.filter((patient) =>
      `${patient.id} ${patient.name}`.toLowerCase().includes(normalized),
    );
  }, [patients, query]);

  const selectedPatient = patients.find((patient) => patient.key === selectedPatientKey) ?? null;
  const selectedEvaluation =
    selectedPatient?.evaluations.find((evaluation) => evaluation.rowNumber === selectedEvaluationRow) ??
    selectedPatient?.evaluations[0] ??
    null;

  const pcsResult: PcsResult | null = useMemo(() => {
    if (!selectedEvaluation || selectedEvaluation.errors.length) return null;
    return calculatePcs(selectedEvaluation);
  }, [selectedEvaluation]);

  const loadParsedData = (parsed: SpreadsheetParseResult, label: string) => {
    setData(parsed);
    setSourceLabel(label);
    setQuery('');
    setSavedPdf('');
    const groups = groupPatients(parsed.evaluations);
    const first = groups[0];
    setSelectedPatientKey(first?.key ?? '');
    setSelectedEvaluationRow(first?.evaluations[0]?.rowNumber ?? null);
  };

  const handleLocalFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    try {
      const parsed = parseSpreadsheet(await file.arrayBuffer());
      loadParsedData(parsed, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir a planilha.');
    } finally {
      event.target.value = '';
    }
  };

  const handleSync = async () => {
    if (!sheetUrl.trim()) {
      setError('Cole o link da planilha do Google Sheets.');
      return;
    }

    setLoading(true);
    setError('');
    setSavedPdf('');
    try {
      const bytes = await window.clinicaDor.downloadGoogleSheet(sheetUrl.trim());
      const parsed = parseSpreadsheet(new Uint8Array(bytes));
      loadParsedData(parsed, 'Google Sheets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível sincronizar a planilha.');
    } finally {
      setLoading(false);
    }
  };

  const selectPatient = (key: string) => {
    setSelectedPatientKey(key);
    const patient = patients.find((candidate) => candidate.key === key);
    setSelectedEvaluationRow(patient?.evaluations[0]?.rowNumber ?? null);
    setSavedPdf('');
  };

  const savePdf = async () => {
    if (!selectedEvaluation || !pcsResult) return;
    setSavedPdf('');
    const filePath = await window.clinicaDor.saveReportPdf({
      patient: {
        id: selectedEvaluation.id,
        name: selectedEvaluation.name,
        date: selectedEvaluation.date,
        researcher: selectedEvaluation.researcher,
        moment: selectedEvaluation.moment,
      },
      pcs: pcsResult,
    });
    if (filePath) setSavedPdf(`Relatório salvo em: ${filePath}`);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">CD</div>
        <div>
          <h1>Clínica da Dor — UEPB</h1>
          <p>Apuração automatizada da Escala de Catastrofização da Dor (PCS)</p>
        </div>
      </header>

      <main className="page-grid">
        <section className="source-card card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Fonte dos dados</span>
              <h2>Carregar avaliações</h2>
            </div>
            <span className="source-pill">{sourceLabel}</span>
          </div>

          <label className="field-label" htmlFor="sheet-url">
            Link da planilha do Google Sheets
          </label>
          <div className="url-row">
            <input
              id="sheet-url"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
              placeholder={EXAMPLE_LINK}
            />
            <button className="button primary" onClick={handleSync} disabled={loading}>
              {loading ? 'Sincronizando…' : 'Sincronizar'}
            </button>
          </div>
          <p className="helper">
            Na primeira versão, o link precisa permitir acesso à planilha. O aplicativo converte o link do Google Sheets
            em XLSX e lê somente os campos de identificação e os 13 itens da PCS.
          </p>

          <div className="divider"><span>ou</span></div>

          <label className="button secondary file-button">
            Abrir arquivo XLSX local
            <input type="file" accept=".xlsx,.xls" onChange={handleLocalFile} />
          </label>

          {error && <div className="alert error">{error}</div>}
          {data && (
            <div className="load-summary">
              <strong>{data.evaluations.length}</strong> avaliações carregadas em <strong>{patients.length}</strong>{' '}
              pacientes. Aba: <strong>{data.sheetName}</strong>.
              {data.warnings.length > 0 && (
                <span className="warning-inline"> {data.warnings.length} avaliação(ões) com pendência.</span>
              )}
            </div>
          )}
        </section>

        <section className="workspace">
          <aside className="patients-panel card">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Pacientes</span>
                <h2>Selecione um paciente</h2>
              </div>
            </div>
            <input
              className="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome ou ID"
              disabled={!data}
            />

            <div className="patient-list">
              {!data && <div className="empty-small">Carregue uma planilha para listar os pacientes.</div>}
              {data && filteredPatients.length === 0 && (
                <div className="empty-small">Nenhum paciente encontrado.</div>
              )}
              {filteredPatients.map((patient) => {
                const hasIssue = patient.evaluations.some((evaluation) => evaluation.errors.length > 0);
                return (
                  <button
                    key={patient.key}
                    className={`patient-row ${patient.key === selectedPatientKey ? 'active' : ''}`}
                    onClick={() => selectPatient(patient.key)}
                  >
                    <div>
                      <strong>{patient.name || 'Paciente sem nome'}</strong>
                      <span>{patient.id || 'Sem ID'}</span>
                    </div>
                    <div className="patient-count">
                      {patient.evaluations.length}
                      {hasIssue && <span className="issue-dot" title="Há avaliação com pendência" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="result-panel card">
            {!selectedPatient || !selectedEvaluation ? (
              <div className="empty-state">
                <div className="empty-icon">PCS</div>
                <h2>Nenhuma avaliação selecionada</h2>
                <p>Carregue a planilha e escolha o paciente para apurar a escala.</p>
              </div>
            ) : (
              <>
                <div className="patient-header">
                  <div>
                    <span className="eyebrow">Paciente</span>
                    <h2>{selectedPatient.name}</h2>
                    <p>ID: {selectedPatient.id}</p>
                  </div>
                  <div className="evaluation-select-wrap">
                    <label htmlFor="evaluation">Avaliação</label>
                    <select
                      id="evaluation"
                      value={selectedEvaluation.rowNumber}
                      onChange={(event) => {
                        setSelectedEvaluationRow(Number(event.target.value));
                        setSavedPdf('');
                      }}
                    >
                      {selectedPatient.evaluations.map((evaluation) => (
                        <option value={evaluation.rowNumber} key={evaluation.rowNumber}>
                          {evaluation.date || 'Sem data'} — {evaluation.moment || `Linha ${evaluation.rowNumber}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="metadata-grid">
                  <div><span>Data</span><strong>{selectedEvaluation.date || '—'}</strong></div>
                  <div><span>Momento</span><strong>{selectedEvaluation.moment || '—'}</strong></div>
                  <div><span>Responsável</span><strong>{selectedEvaluation.researcher || '—'}</strong></div>
                </div>

                {selectedEvaluation.errors.length > 0 ? (
                  <div className="alert error result-error">
                    <strong>Não é possível calcular esta avaliação.</strong>
                    <ul>
                      {selectedEvaluation.errors.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : pcsResult ? (
                  <>
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

                    <div className={`total-card ${pcsResult.totalClassification}`}>
                      <div>
                        <span className="eyebrow">Escore total PCS</span>
                        <div className="total-score">{pcsResult.total}<small>/52</small></div>
                      </div>
                      <div className="total-interpretation">
                        <span>Interpretação</span>
                        <strong>{pcsResult.totalLabel}</strong>
                      </div>
                    </div>

                    <div className="thresholds">
                      <span>Total: 0–14 baixa</span>
                      <span>15–29 moderada</span>
                      <span>≥ 30 clinicamente relevante</span>
                    </div>

                    <div className="actions-row">
                      <button className="button primary" onClick={savePdf}>Gerar relatório em PDF</button>
                      {savedPdf && <span className="saved-message">{savedPdf}</span>}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </section>
        </section>

        <footer className="clinical-note">
          A ferramenta automatiza a apuração da PCS conforme os pontos de corte configurados. O resultado não substitui
          avaliação clínica, diagnóstico ou julgamento profissional.
        </footer>
      </main>
    </div>
  );
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
      <div className="progress"><span style={{ width: `${Math.min(100, (score / max) * 100)}%` }} /></div>
    </div>
  );
}

export default App;
