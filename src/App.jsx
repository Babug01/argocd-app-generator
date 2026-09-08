import { useMemo, useState } from "react";
import Header from "./components/Header";

const REPO_URL = "https://github.com/Babug01/argocd-app-generator";

// Application resources are read by the ArgoCD controller, which only
// watches its own namespace (or whatever `application.namespaces` is
// widened to) — "argocd" is the default install namespace and the right
// value the vast majority of the time, so it's fixed rather than exposed
// as a field to fill in.
const ARGOCD_NAMESPACE = "argocd";

// Quotes a YAML scalar only when it actually needs it — plain unquoted
// values stay readable, anything with YAML-significant characters (colons,
// braces, leading/trailing space, etc.) or that would otherwise parse as a
// bool/null gets double-quoted. Double-quoted YAML accepts the same escapes
// as JSON, so JSON.stringify is a safe, correct quoting implementation.
function scalar(value) {
  const s = String(value ?? "");
  if (s === "") return '""';
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(s)) return JSON.stringify(s);
  if (/^[A-Za-z0-9_][A-Za-z0-9_./:\-]*$/.test(s) && !/^[-?:]$/.test(s[0])) return s;
  return JSON.stringify(s);
}

function indent(lines, spaces) {
  const pad = " ".repeat(spaces);
  return lines.map((l) => (l ? pad + l : l));
}

function buildApplicationYaml(state) {
  const lines = [];
  lines.push("apiVersion: argoproj.io/v1alpha1");
  lines.push("kind: Application");
  lines.push("metadata:");
  lines.push(`  name: ${scalar(state.name || "my-app")}`);
  lines.push(`  namespace: ${ARGOCD_NAMESPACE}`);
  lines.push("spec:");
  lines.push(`  project: ${scalar(state.project || "default")}`);
  lines.push("  source:");
  lines.push(`    repoURL: ${scalar(state.repoURL || "https://github.com/org/repo.git")}`);
  lines.push(`    targetRevision: ${scalar(state.targetRevision || "HEAD")}`);
  if (state.sourceType === "helm") {
    lines.push(`    chart: ${scalar(state.chart || "my-chart")}`);
  } else {
    lines.push(`    path: ${scalar(state.path || ".")}`);
  }
  const valueFiles = state.valueFiles.map((v) => v.trim()).filter(Boolean);
  if (valueFiles.length > 0) {
    lines.push("    helm:");
    lines.push("      valueFiles:");
    for (const vf of valueFiles) lines.push(`        - ${scalar(vf)}`);
  }
  lines.push("  destination:");
  lines.push(`    server: ${scalar(state.server || "https://kubernetes.default.svc")}`);
  lines.push(`    namespace: ${scalar(state.namespace || "default")}`);

  const syncOptions = Object.entries(state.syncOptions)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
  const hasSyncPolicy = state.automated || syncOptions.length > 0;
  if (hasSyncPolicy) {
    lines.push("  syncPolicy:");
    if (state.automated) {
      lines.push("    automated:");
      lines.push(`      prune: ${state.prune ? "true" : "false"}`);
      lines.push(`      selfHeal: ${state.selfHeal ? "true" : "false"}`);
    }
    if (syncOptions.length > 0) {
      lines.push("    syncOptions:");
      for (const opt of syncOptions) lines.push(`      - ${opt}`);
    }
  }

  return lines.join("\n") + "\n";
}

const SYNC_OPTION_DEFS = [
  { key: "CreateNamespace=true", label: "CreateNamespace=true", hint: "Creates the destination namespace automatically if it doesn't already exist." },
  { key: "PrunePropagationPolicy=foreground", label: "PrunePropagationPolicy=foreground", hint: "Waits for dependents to finish deleting before removing the owner (foreground cascade) instead of the default background policy." },
  { key: "ApplyOutOfSyncOnly=true", label: "ApplyOutOfSyncOnly=true", hint: "Only applies resources that are actually out of sync, instead of re-applying everything on every sync." },
];

const initialState = {
  name: "",
  project: "default",
  repoURL: "",
  sourceType: "git",
  path: "",
  chart: "",
  targetRevision: "",
  valueFiles: [""],
  server: "https://kubernetes.default.svc",
  namespace: "",
  automated: false,
  prune: false,
  selfHeal: false,
  syncOptions: { "CreateNamespace=true": false, "PrunePropagationPolicy=foreground": false, "ApplyOutOfSyncOnly=true": false },
};

const styles = {
  root: { minHeight: "100dvh", display: "flex", flexDirection: "column" },
  content: { fontFamily: "system-ui, sans-serif", padding: "20px 24px", flex: 1, minHeight: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", background: "var(--bg-subtle, #f0efed)" },
  head: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, margin: 0, color: "var(--text, #1a1a1a)" },
  subtitle: { fontSize: 13, opacity: 0.6, margin: "4px 0 0", color: "var(--text, #1a1a1a)", maxWidth: 760 },
  body: { display: "flex", gap: 20, flex: 1, minHeight: 0, minWidth: 0, alignItems: "flex-start" },
  formPane: { flex: "1 1 0", minWidth: 0, overflow: "auto", paddingRight: 4 },
  outputPane: { flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", position: "sticky", top: 0 },
  fieldset: { border: "1px solid var(--border, #e5e7eb)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, background: "var(--bg, #fff)" },
  legend: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6, padding: "0 4px", color: "var(--text, #1a1a1a)" },
  field: { marginBottom: 12 },
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text, #1a1a1a)" },
  input: {
    width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 13, boxSizing: "border-box",
    fontFamily: "'SFMono-Regular', Consolas, monospace",
  },
  hint: { fontSize: 12, opacity: 0.6, margin: "4px 0 0", color: "var(--text, #1a1a1a)", lineHeight: 1.4 },
  row: { display: "flex", gap: 10 },
  radioRow: { display: "flex", gap: 16, marginBottom: 4 },
  radioLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "var(--text, #1a1a1a)" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--text, #1a1a1a)", marginBottom: 6 },
  valueFileRow: { display: "flex", gap: 6, marginBottom: 6 },
  smallBtn: {
    padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "transparent",
    color: "var(--text, #1a1a1a)", cursor: "pointer", fontSize: 12,
  },
  addBtn: {
    padding: "6px 12px", borderRadius: 6, border: "1px dashed var(--border, #e5e7eb)", background: "transparent",
    color: "var(--text, #1a1a1a)", cursor: "pointer", fontSize: 12,
  },
  paneHeader: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--text, #1a1a1a)" },
  iconBtn: {
    padding: "2px 10px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)", background: "transparent",
    color: "var(--text, #1a1a1a)", cursor: "pointer", fontSize: 11, textTransform: "none", fontWeight: 400,
  },
  yamlBox: {
    fontFamily: "'SFMono-Regular', Consolas, monospace", fontSize: 12, padding: 14, borderRadius: 8,
    border: "1px solid var(--border, #e5e7eb)", background: "var(--input-bg, #f9fafb)", whiteSpace: "pre",
    overflow: "auto", margin: 0, color: "var(--text, #1a1a1a)", maxHeight: "calc(100dvh - 180px)",
  },
};

export default function App() {
  const [state, setState] = useState(initialState);
  const [copied, setCopied] = useState(false);

  function set(patch) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  function setSyncOption(key, value) {
    setState((prev) => ({ ...prev, syncOptions: { ...prev.syncOptions, [key]: value } }));
  }

  function setValueFile(idx, value) {
    setState((prev) => {
      const next = [...prev.valueFiles];
      next[idx] = value;
      return { ...prev, valueFiles: next };
    });
  }

  function addValueFile() {
    setState((prev) => ({ ...prev, valueFiles: [...prev.valueFiles, ""] }));
  }

  function removeValueFile(idx) {
    setState((prev) => ({ ...prev, valueFiles: prev.valueFiles.filter((_, i) => i !== idx) }));
  }

  const yaml = useMemo(() => buildApplicationYaml(state), [state]);

  function copyYaml() {
    navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={styles.root}>
      <Header repoUrl={REPO_URL} />
      <div style={styles.content}>
        <div style={styles.head}>
          <h1 style={styles.title}>ArgoCD Application Generator</h1>
          <p style={styles.subtitle}>
            Fill in the fields you need and get the exact <code>argoproj.io/v1alpha1</code> Application YAML shape —
            for when you already know ArgoCD but don't want to hand-type the indentation from memory. Nothing leaves
            your browser.
          </p>
        </div>

        <div style={styles.body}>
          <div style={styles.formPane}>
            <div style={styles.fieldset}>
              <div style={styles.legend}>Metadata</div>
              <div style={styles.field}>
                <label style={styles.label}>Name</label>
                <input style={styles.input} value={state.name} onChange={(e) => set({ name: e.target.value })} placeholder="my-app" />
                <p style={styles.hint}>Application resource name — must be unique within the {ARGOCD_NAMESPACE} namespace ArgoCD runs in.</p>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Project</label>
                <input style={styles.input} value={state.project} onChange={(e) => set({ project: e.target.value })} placeholder="default" />
                <p style={styles.hint}>AppProject this Application belongs to — controls RBAC and which repos/destinations are allowed.</p>
              </div>
            </div>

            <div style={styles.fieldset}>
              <div style={styles.legend}>Source</div>
              <div style={styles.field}>
                <label style={styles.label}>Repo URL</label>
                <input style={styles.input} value={state.repoURL} onChange={(e) => set({ repoURL: e.target.value })} placeholder="https://github.com/org/repo.git" />
                <p style={styles.hint}>Git repository URL, or a Helm chart repository URL (OCI or HTTP(S)) when using a Helm chart source below.</p>
              </div>
              <div style={styles.field}>
                <div style={styles.radioRow}>
                  <label style={styles.radioLabel}>
                    <input type="radio" checked={state.sourceType === "git"} onChange={() => set({ sourceType: "git" })} />
                    Git path
                  </label>
                  <label style={styles.radioLabel}>
                    <input type="radio" checked={state.sourceType === "helm"} onChange={() => set({ sourceType: "helm" })} />
                    Helm chart repo
                  </label>
                </div>
                <p style={styles.hint}>Git path syncs a directory of manifests/a chart from the Git repo above. Helm chart repo syncs a packaged chart pulled directly from a Helm chart repository instead.</p>
              </div>
              {state.sourceType === "helm" ? (
                <div style={styles.field}>
                  <label style={styles.label}>Chart</label>
                  <input style={styles.input} value={state.chart} onChange={(e) => set({ chart: e.target.value })} placeholder="my-chart" />
                  <p style={styles.hint}>Chart name as published in the Helm chart repository above.</p>
                </div>
              ) : (
                <div style={styles.field}>
                  <label style={styles.label}>Path</label>
                  <input style={styles.input} value={state.path} onChange={(e) => set({ path: e.target.value })} placeholder="charts/my-app" />
                  <p style={styles.hint}>Path within the Git repo to the manifests or chart directory.</p>
                </div>
              )}
              <div style={styles.field}>
                <label style={styles.label}>Target Revision</label>
                <input style={styles.input} value={state.targetRevision} onChange={(e) => set({ targetRevision: e.target.value })} placeholder={state.sourceType === "helm" ? "1.2.3" : "HEAD"} />
                <p style={styles.hint}>{state.sourceType === "helm" ? "Chart version to sync." : "Git branch, tag, or commit SHA to sync."}</p>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Value Files (optional)</label>
                {state.valueFiles.map((vf, idx) => (
                  <div key={idx} style={styles.valueFileRow}>
                    <input style={styles.input} value={vf} onChange={(e) => setValueFile(idx, e.target.value)} placeholder="values-prod.yaml" />
                    <button style={styles.smallBtn} onClick={() => removeValueFile(idx)} aria-label="Remove value file" type="button">×</button>
                  </div>
                ))}
                <button style={styles.addBtn} onClick={addValueFile} type="button">+ Add value file</button>
                <p style={styles.hint}>Extra Helm values files layered over the chart's defaults, relative to the source root. Rendered under <code>source.helm.valueFiles</code>.</p>
              </div>
            </div>

            <div style={styles.fieldset}>
              <div style={styles.legend}>Destination</div>
              <div style={styles.field}>
                <label style={styles.label}>Server</label>
                <input style={styles.input} value={state.server} onChange={(e) => set({ server: e.target.value })} placeholder="https://kubernetes.default.svc" />
                <p style={styles.hint}>Destination cluster's API server — the in-cluster default targets the same cluster ArgoCD itself runs on.</p>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Namespace</label>
                <input style={styles.input} value={state.namespace} onChange={(e) => set({ namespace: e.target.value })} placeholder="my-app-ns" />
                <p style={styles.hint}>Namespace the application's manifests get applied into on the destination cluster.</p>
              </div>
            </div>

            <div style={styles.fieldset}>
              <div style={styles.legend}>Sync Policy</div>
              <div style={styles.field}>
                <label style={styles.checkboxLabel}>
                  <input type="checkbox" checked={state.automated} onChange={(e) => set({ automated: e.target.checked })} />
                  Automated sync
                </label>
                <p style={styles.hint}>Enables auto-sync — ArgoCD reconciles automatically on drift instead of waiting for a manual sync.</p>
                {state.automated && (
                  <div style={{ marginLeft: 22, marginTop: 8 }}>
                    <label style={styles.checkboxLabel}>
                      <input type="checkbox" checked={state.prune} onChange={(e) => set({ prune: e.target.checked })} />
                      Prune
                    </label>
                    <p style={styles.hint}>Deletes resources that were removed from the source. Off by default because it's destructive.</p>
                    <label style={styles.checkboxLabel}>
                      <input type="checkbox" checked={state.selfHeal} onChange={(e) => set({ selfHeal: e.target.checked })} />
                      Self Heal
                    </label>
                    <p style={styles.hint}>Reverts manual or out-of-band cluster changes back to the Git-declared state automatically.</p>
                  </div>
                )}
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Sync Options</label>
                {SYNC_OPTION_DEFS.map((opt) => (
                  <div key={opt.key}>
                    <label style={styles.checkboxLabel}>
                      <input type="checkbox" checked={state.syncOptions[opt.key]} onChange={(e) => setSyncOption(opt.key, e.target.checked)} />
                      {opt.label}
                    </label>
                    <p style={{ ...styles.hint, marginLeft: 22, marginTop: -4 }}>{opt.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.outputPane}>
            <div style={styles.paneHeader}>
              <span>Application YAML</span>
              <button style={styles.iconBtn} onClick={copyYaml} type="button">{copied ? "Copied" : "Copy"}</button>
            </div>
            <pre style={styles.yamlBox}>{yaml}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
