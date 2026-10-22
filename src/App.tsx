import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { downloadGoogleSheet } from "./services/googleSheets";
import { calculatePcs } from "./services/pcs";
import { groupPatients, mergeSpreadsheet, parseSpreadsheet } from "./services/spreadsheet";
import { normalize, ScaleId, SCALE_NAMES } from "./services/forms";
import { SpreadsheetParseResult, Evaluation } from "./types";
import { EvaluationReport } from "./EvaluationReport";
import { PromisReport } from "./PromisReport";
import { Sf36Report } from "./Sf36Report";
import { PatientBasics, PatientRecord } from "./PatientRecord";
import { ExportPanel } from "./ExportPanel";
import { SOURCE_LABELS, SourceKind, validateSource } from "./services/sources";

type View = "dashboard" | "patients" | "patient" | "record" | "overview" | "details";
type Route = { view: View; patient?: string; row?: string; scale?: ScaleId };
const HOME: Route = { view: "dashboard" };
const kinds: SourceKind[] = ["combined", "sf36", "initial"];
const sourceType = (e: Evaluation) =>
  !e.scales.length ? "Avaliação inicial" : e.scales.map((s) => SCALE_NAMES[s]).join(" e ");

function App() {
  const [data, setData] = useState<SpreadsheetParseResult | null>(null);
  const [loading, setLoading] = useState<SourceKind[]>([]);
  const [errors, setErrors] = useState<Record<SourceKind, string>>({
    combined: "",
    sf36: "",
    initial: "",
  });
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([HOME]);
  const [exportRequest, setExportRequest] = useState<{
    patientKey: string;
    scale?: ScaleId;
    recordKey?: string;
  } | null>(null);
  const loadedOnce = useRef(false);
  const route = routes[routes.length - 1],
    scale = route.scale ?? "pcs";
  const activeNav = route.view === "dashboard" ? "dashboard" : "patients";
  const titles: Record<View, string> = {
    dashboard: "Clínica da Dor",
    patients: "Pacientes",
    patient: "Ficha do paciente",
    record: "Prontuário do paciente",
    overview: `${SCALE_NAMES[scale]} · Resultados`,
    details: "PCS · Respostas",
  };
  useEffect(() => {
    window.history.replaceState({ clinicalRoutes: [HOME] }, "");
    const pop = (event: PopStateEvent) => {
      setRoutes(event.state?.clinicalRoutes ?? [HOME]);
      setMenuOpen(false);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);
  const navigate = (next: Route, root = false) => {
    const stack = root ? (next.view === "dashboard" ? [HOME] : [HOME, next]) : [...routes, next];
    window.history.pushState({ clinicalRoutes: stack }, "");
    setRoutes(stack);
    setMenuOpen(false);
    setQuery("");
    window.scrollTo(0, 0);
  };
  const back = () => {
    const stack = routes.length > 1 ? routes.slice(0, -1) : [HOME];
    window.history.replaceState({ clinicalRoutes: stack }, "");
    setRoutes(stack);
    window.scrollTo(0, 0);
  };
  const patients = useMemo(() => groupPatients(data?.evaluations ?? []), [data]);
  const patient = patients.find((p) => p.key === route.patient);
  const inScale = route.view === "overview" || route.view === "details";
  const relevant = patient?.evaluations.filter((e) => e.scales.includes(scale)) ?? [];
  const evaluation =
    (inScale ? relevant : (patient?.evaluations ?? [])).find((e) => e.recordKey === route.row) ??
    (inScale ? relevant : (patient?.evaluations ?? []))[0];
  const result =
    evaluation && scale === "pcs" && evaluation.scales.includes("pcs") && !evaluation.errors.length
      ? calculatePcs(evaluation)
      : null;
  const filtered = patients.filter((p) =>
    normalize(`${p.id} ${p.name}`).includes(normalize(query)),
  );
  const selectRow = (row: string) => {
    const stack = [...routes.slice(0, -1), { ...route, row }];
    setRoutes(stack);
    window.history.replaceState({ clinicalRoutes: stack }, "");
  };
  const sync = async (kind: SourceKind) => {
    setLoading((prev) => [...prev.filter((k) => k !== kind), kind]);
    setErrors((prev) => ({ ...prev, [kind]: "" }));
    try {
      const parsed = parseSpreadsheet(
        await downloadGoogleSheet(kind),
        `google:${kind}`,
        SOURCE_LABELS[kind],
        kind === "initial" ? "initial" : "auto",
      );
      validateSource(parsed, kind);
      setData((prev) => mergeSpreadsheet(prev, parsed));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [kind]: err instanceof Error ? err.message : "Falha ao sincronizar planilha.",
      }));
    } finally {
      setLoading((prev) => prev.filter((k) => k !== kind));
    }
  };
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    for (const kind of kinds) void sync(kind);
  }, []); // .env configura as três fontes; links não são solicitados no formulário.
  const localFile = async (event: ChangeEvent<HTMLInputElement>, kind: SourceKind) => {
    const input = event.currentTarget,
      files = Array.from(input.files ?? []);
    if (!files.length) return;
    setLoading((prev) => [...prev, kind]);
    const failures: string[] = [];
    for (const file of files) {
      try {
        const parsed = parseSpreadsheet(
          await file.arrayBuffer(),
          `file:${kind}:${file.name}`,
          SOURCE_LABELS[kind],
          kind === "initial" ? "initial" : "auto",
        );
        validateSource(parsed, kind);
        setData((prev) => mergeSpreadsheet(prev, parsed));
      } catch (err) {
        failures.push(
          `${file.name}: ${err instanceof Error ? err.message : "Falha ao abrir arquivo."}`,
        );
      }
    }
    setErrors((prev) => ({ ...prev, [kind]: failures.join(" ") }));
    setLoading((prev) => prev.filter((k) => k !== kind));
    input.value = "";
  };
  const empty = (
    <div className="empty-state">
      <h2>Nenhum registro disponível</h2>
      <p>
        Os dados são lidos automaticamente das três planilhas configuradas no .env. Confira a
        configuração ou a conexão.
      </p>
      <button className="button secondary" onClick={() => navigate(HOME, true)}>
        Ver fontes de dados
      </button>
    </div>
  );
  const initial = patient?.evaluations.find((e) => !e.scales.length);
  const exporting = patients.find((p) => p.key === exportRequest?.patientKey);
  return (
    <>
      <div className="layout">
        <aside className={`sidebar no-print ${menuOpen ? "open" : ""}`}>
          <div className="brand-logos">
            <img className="nutes-logo" src="/logo-nutes.svg" alt="NUTES" />
            <img className="uepb-logo" src="/logo-uepb.svg" alt="UEPB" />
          </div>
          <div className="brand-name">
            <strong>Clínica da Dor</strong>
            <span>Núcleo de Tecnologias Estratégicas em Saúde</span>
          </div>
          <nav id="mobile-nav" aria-label="Menu principal">
            {(
              [
                ["dashboard", "Página inicial"],
                ["patients", "Pacientes"],
              ] as const
            ).map(([view, label], index) => (
              <button
                key={view}
                aria-current={activeNav === view ? "page" : undefined}
                onClick={() => navigate({ view }, true)}
              >
                <span className="nav-index" aria-hidden="true">
                  0{index + 1}
                </span>
                {label}
              </button>
            ))}
          </nav>
          <div className="institution">
            <span>
              UNIVERSIDADE ESTADUAL
              <br />
              DA PARAÍBA - NUTES
            </span>
          </div>
        </aside>
        {menuOpen && (
          <button
            className="menu-scrim no-print"
            aria-label="Fechar menu"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <div className="main-area">
          <header className="page-top no-print">
            <button
              className="mobile-menu button secondary"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              Menu
            </button>
            <span>
              Clínica da Dor<span className="top-divider">/</span>
              {route.view === "dashboard" ? "Acompanhamento" : titles[route.view]}
            </span>
            <span className="top-badge">NUTES / UEPB</span>
          </header>
          <main className="page-grid">
            <div className="page-heading no-print">
              <div>
                <span className="eyebrow">
                  {route.view === "dashboard" ? "Acompanhamento clínico" : "Clínica da Dor"}
                </span>
                <h1>{titles[route.view]}</h1>
              </div>
              {route.view !== "dashboard" && (
                <button className="button secondary" onClick={back}>
                  ← Voltar
                </button>
              )}
            </div>
            {route.view === "dashboard" && (
              <>
                <div className="dashboard-stats">
                  <div className="stat">
                    <span>Pacientes</span>
                    <strong>{patients.length}</strong>
                  </div>
                  <div className="stat">
                    <span>Registros de avaliação</span>
                    <strong>{data?.evaluations.length ?? 0}</strong>
                  </div>
                  <div className="stat">
                    <span>Escalas disponíveis</span>
                    <strong>3</strong>
                  </div>
                </div>
                <div className="dashboard-body">
                  <section className="source-card">
                    <div className="section-heading">
                      <h2>Fontes de dados</h2>
                      <span className="source-pill">Sincronização automática</span>
                    </div>
                    <p className="helper">
                      Links configurados no servidor por variáveis de ambiente. Não é necessário
                      informá-los a cada acesso.
                    </p>
                    {kinds.map((kind) => {
                      const count =
                        data?.evaluations.filter(
                          (e) =>
                            e.sourceId === `google:${kind}` ||
                            e.sourceId.startsWith(`file:${kind}:`),
                        ).length ?? 0;
                      return (
                        <div className="source-status-row" key={kind}>
                          <div>
                            <strong>{SOURCE_LABELS[kind]}</strong>
                            <span>
                              {loading.includes(kind)
                                ? "Carregando…"
                                : errors[kind]
                                  ? "Erro de sincronização"
                                  : count
                                    ? `${count} registro(s) carregado(s)`
                                    : "Nenhum registro carregado"}
                            </span>
                            {errors[kind] && (
                              <p className="source-error" role="alert">
                                {errors[kind]}
                              </p>
                            )}
                          </div>
                          <button
                            className="button secondary"
                            disabled={loading.includes(kind)}
                            onClick={() => void sync(kind)}
                          >
                            Atualizar
                          </button>
                        </div>
                      );
                    })}
                  </section>
                  <div className="quick-grid">
                    <button className="quick-card" onClick={() => navigate({ view: "patients" })}>
                      <span className="eyebrow">Consulta</span>
                      <h2>
                        Pacientes <span>→</span>
                      </h2>
                      <p>Consulte fichas, prontuários e resultados das avaliações.</p>
                    </button>
                  </div>
                </div>
                {!!data?.warnings.length && (
                  <details className="warnings-card">
                    <summary>Avisos de importação ({data.warnings.length})</summary>
                    <ul>
                      {data.warnings.map((w, index) => (
                        <li key={index}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
            {route.view === "patients" && (
              <section className="patient-directory">
                {!patients.length ? (
                  empty
                ) : (
                  <>
                    <label className="field-label" htmlFor="patient-search">
                      Buscar por nome ou identificação
                    </label>
                    <input
                      id="patient-search"
                      className="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Nome ou identificação"
                    />
                    <p className="helper">{filtered.length} paciente(s)</p>
                    <div className="directory-list">
                      {filtered.map((p) => (
                        <article className="directory-row" key={p.key}>
                          <button
                            className="patient-link"
                            onClick={() => navigate({ view: "patient", patient: p.key })}
                          >
                            <span className="avatar" aria-hidden="true">
                              {(p.name || "?").charAt(0).toUpperCase()}
                            </span>
                            <span>
                              <strong>{p.name || "Paciente sem nome"}</strong>
                              <small>
                                ID: {p.id || "Não informado"} · {p.evaluations.length}{" "}
                                avaliação(ões)
                              </small>
                            </span>
                          </button>
                          <button
                            className="button secondary"
                            onClick={() => navigate({ view: "patient", patient: p.key })}
                          >
                            Abrir ficha →
                          </button>
                        </article>
                      ))}
                    </div>
                    {!filtered.length && <p className="empty-small">Nenhum paciente encontrado.</p>}
                  </>
                )}
              </section>
            )}
            {route.view === "patient" &&
              (patient ? (
                <section className="patient-profile">
                  <span className="eyebrow">Ficha do paciente</span>
                  <h2>{patient.name || "Paciente sem nome"}</h2>
                  <p className="helper">ID: {patient.id || "Não informado"}</p>
                  <PatientBasics patient={patient} initial={initial} />
                  <h3 className="subheading">Avaliações cadastradas</h3>
                  <div className="table-scroll patient-evaluation-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Tipo da avaliação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patient.evaluations.map((e) => (
                          <tr key={e.recordKey}>
                            <td>{e.date || "—"}</td>
                            <td>{sourceType(e)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="actions-row">
                    <button
                      className="button primary"
                      onClick={() => navigate({ view: "record", patient: patient.key })}
                    >
                      Abrir prontuário do paciente →
                    </button>
                  </div>
                </section>
              ) : (
                empty
              ))}
            {route.view === "record" &&
              (patient ? (
                <PatientRecord
                  patient={patient}
                  onScale={(chosenScale, e) =>
                    navigate({
                      view: "overview",
                      patient: patient.key,
                      scale: chosenScale,
                      row: e.recordKey,
                    })
                  }
                  onExport={() => setExportRequest({ patientKey: patient.key })}
                />
              ) : (
                empty
              ))}
            {inScale &&
              (patient && evaluation ? (
                scale === "pcs" ? (
                  <EvaluationReport
                    selectedPatient={{ ...patient, evaluations: relevant }}
                    selectedEvaluation={evaluation}
                    pcsResult={result}
                    setSelectedEvaluationRow={selectRow}
                    detailed={route.view === "details"}
                    onDetails={() =>
                      navigate({ ...route, view: "details", row: evaluation.recordKey })
                    }
                    onExport={() =>
                      setExportRequest({
                        patientKey: patient.key,
                        scale,
                        recordKey: evaluation.recordKey,
                      })
                    }
                  />
                ) : scale === "promis" ? (
                  <PromisReport
                    selectedPatient={{ ...patient, evaluations: relevant }}
                    selectedEvaluation={evaluation}
                    setSelectedEvaluationRow={selectRow}
                    onExport={() =>
                      setExportRequest({
                        patientKey: patient.key,
                        scale,
                        recordKey: evaluation.recordKey,
                      })
                    }
                  />
                ) : (
                  <Sf36Report
                    selectedPatient={{ ...patient, evaluations: relevant }}
                    selectedEvaluation={evaluation}
                    setSelectedEvaluationRow={selectRow}
                    onExport={() =>
                      setExportRequest({
                        patientKey: patient.key,
                        scale,
                        recordKey: evaluation.recordKey,
                      })
                    }
                  />
                )
              ) : (
                empty
              ))}
            <footer className="clinical-note">
              A ferramenta organiza registros e calcula escores de PCS, PROMIS-29 e SF-36. A
              interpretação deve ser realizada por profissionais em conjunto com a avaliação
              clínica.
            </footer>
          </main>
        </div>
      </div>
      {exporting && (
        <ExportPanel
          patient={exporting}
          defaultScale={exportRequest?.scale}
          defaultRecordKey={exportRequest?.recordKey}
          onClose={() => setExportRequest(null)}
        />
      )}
    </>
  );
}
export default App;
