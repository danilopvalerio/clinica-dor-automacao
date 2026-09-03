import { ChangeEvent, useMemo, useState } from 'react';
import { downloadGoogleSheet } from './services/googleSheets';
import { calculatePcs, PCS_RULES } from './services/pcs';
import { groupPatients, parseSpreadsheet } from './services/spreadsheet';
import { PcsResult, SpreadsheetParseResult } from './types';

const EXAMPLE_LINK = 'https://docs.google.com/spreadsheets/d/SEU_ID_DA_PLANILHA/edit?gid=0';
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

  const patients = useMemo(() => groupPatients(data?.evaluations ?? []), [data]);

  const filteredPatients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return patients;
    return patients.filter((patient) =>
      `${patient.id} ${patient.name}`.toLocaleLowerCase('pt-BR').includes(normalized),
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
    const groups = groupPatients(parsed.evaluations);
    const first = groups[0];
    setSelectedPatientKey(first?.key ?? '');
    setSelectedEvaluationRow(first?.evaluations[0]?.rowNumber ?? null);
  };

  const handleLocalFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);
    try {
      const parsed = parseSpreadsheet(await file.arrayBuffer());
      loadParsedData(parsed, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir a planilha.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError('');
    try {
      const bytes = await downloadGoogleSheet(sheetUrl);
      const parsed = parseSpreadsheet(bytes);
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
  };

  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div className="topbar-inner">
          <img className="brand-icon" src="/icon.png" alt="Ícone PCS" />
          <div>
            <h1>Clínica da Dor — UEPB</h1>
            <p>Apuração automatizada da Escala de Catastrofização da Dor (PCS)</p>
          </div>
        </div>
      </header>

      <main className="page-grid">
        <section className="source-card card no-print">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Fonte dos dados</span>
              <h2>Carregar avaliações</h2>
            </div>
            <span className="source-pill" title={sourceLabel}>{sourceLabel}</span>
          </div>

          <label className="field-label" htmlFor="sheet-url">Link da planilha do Google Sheets</label>
          <div className="url-row">
            <input
              id="sheet-url"
              inputMode="url"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
              placeholder={EXAMPLE_LINK}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !loading) void handleSync();
              }}
            />
            <button className="button primary" onClick={() => void handleSync()} disabled={loading}>
              {loading ? 'Carregando…' : 'Sincronizar'}
            </button>
          </div>
          <p className="helper">
            O sistema tenta exportar a planilha como XLSX. Se o Google exigir autenticação e não permitir a exportação,
            use o arquivo XLSX baixado como alternativa.
          </p>

          <div className="divider"><span>ou</span></div>

          <label className={`button secondary file-button ${loading ? 'disabled' : ''}`}>
            Abrir arquivo XLSX
            <input type="file" accept=".xlsx,.xls" onChange={handleLocalFile} disabled={loading} />
          </label>

          {error && <div className="alert error" role="alert">{error}</div>}
          {data && (
            <div className="load-summary">
              <strong>{data.evaluations.length}</strong> avaliações em <strong>{patients.length}</strong> pacientes.
              {' '}Aba lida: <strong>{data.sheetName}</strong>.
              {data.warnings.length > 0 && (
                <span className="warning-inline"> {data.warnings.length} avaliação(ões) com pendência.</span>
              )}
            </div>
          )}
        </section>

        <section className="workspace">
          <aside className="patients-panel card no-print">
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
              {data && filteredPatients.length === 0 && <div className="empty-small">Nenhum paciente encontrado.</div>}
              {filteredPatients.map((patient) => {
                const hasIssue = patient.evaluations.some((evaluation) => evaluation.errors.length > 0);
                return (
                  <button
                    key={patient.key}
                    className={`patient-row ${patient.key === selectedPatientKey ? 'active' : ''}`}
                    onClick={() => selectPatient(patient.key)}
                  >
                    <div className="patient-identity">
                      <strong>{patient.name || 'Paciente sem nome'}</strong>
                      <span>{patient.id || 'Sem ID'}</span>
                    </div>
                    <div className="patient-count" aria-label={`${patient.evaluations.length} avaliações`}>
                      {patient.evaluations.length}
                      {hasIssue && <span className="issue-dot" title="Há avaliação com pendência" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="result-panel card print-report">
            {!selectedPatient || !selectedEvaluation ? (
              <div className="empty-state">
                <img className="empty-logo" src="/icon.png" alt="" />
                <h2>Nenhuma avaliação selecionada</h2>
                <p>Carregue uma planilha e escolha o paciente para apurar a PCS.</p>
              </div>
            ) : (
              <>
                <div className="print-only print-title">
                  <img src="/icon.png" alt="" />
                  <div>
                    <strong>Clínica da Dor — UEPB</strong>
                    <span>Relatório de apuração da PCS</span>
                  </div>
                </div>

                <div className="patient-header">
                  <div>
                    <span className="eyebrow">Paciente</span>
                    <h2>{selectedPatient.name || 'Paciente sem nome'}</h2>
                    <p>ID: {selectedPatient.id || '—'}</p>
                  </div>
                  <div className="evaluation-select-wrap no-print">
                    <label htmlFor="evaluation">Avaliação</label>
                    <select
                      id="evaluation"
                      value={selectedEvaluation.rowNumber}
                      onChange={(event) => setSelectedEvaluationRow(Number(event.target.value))}
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
                    <ul>{selectedEvaluation.errors.map((item) => <li key={item}>{item}</li>)}</ul>
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

                    <div className="actions-row no-print">
                      <button className="button primary" onClick={() => window.print()}>
                        Imprimir / salvar PDF
                      </button>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </section>
        </section>

        {data && data.warnings.length > 0 && (
          <details className="warnings-card card no-print">
            <summary>Pendências encontradas ({data.warnings.length})</summary>
            <ul>{data.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </details>
        )}

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
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (score / max) * 100)}%` }} />
      </div>
    </div>
  );
}

export default App;
