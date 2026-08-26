import express from 'express';

const app = express();
const port = 3000;

app.use(express.json());

export interface IncidentState {
  incidentId: string;
  service: string;
  severity: string;
  errorRate: string;
  triggerTime: string;
  suspectedCommit: string;
  rootCause: string;
  remediationCommand: string;
  status: 'INVESTIGATING' | 'SANDBOX_VALIDATING' | 'WAITING_APPROVAL' | 'EXECUTING' | 'RESOLVED';
  logs: string[];
}

let currentState: IncidentState = {
  incidentId: "INC-8904",
  service: "checkout-service",
  severity: "P0 - CRITICAL",
  errorRate: "42.8%",
  triggerTime: new Date().toISOString(),
  suspectedCommit: "4c21",
  rootCause: "Active request timeout decreased from 5000ms to 50ms in checkout.ts (Commit: 4c21). Causing cascading timeouts across ingress gateways.",
  remediationCommand: "kubectl rollout undo deployment/checkout-service --namespace=production",
  status: 'INVESTIGATING',
  logs: [
    "Alert received: Ingress 5xx error rate exceeded threshold (42.8% > 1.0%)",
    "Connecting to Kubernetes cluster via MCP provider...",
    "Querying git log history for deployment checkout-service:v2.1.4",
    "Isolating suspected commit 4c21: 'perf: optimize connection pool timeout'",
    "Spinning up TrueForge ephemeral isolated sandbox container...",
    "Executing dry-run rollback validation test in sandbox environment...",
    "Dry-run sanity checks PASSED (0 breaking changes detected, traffic routing verified)",
    "POLICY TRIGGERED: Rollback action marked irreversible. Halting execution loop.",
    "Awaiting Human On-Call SRE approval to dispatch mitigation."
  ]
};

export function updateAgentState(updates: Partial<IncidentState>) {
  currentState = { ...currentState, ...updates };
}

export function startApprovalGate(onApprove: () => void) {
  app.get('/api/state', (req, res) => {
    res.json(currentState);
  });

  app.post('/api/approve', (req, res) => {
    currentState.status = 'EXECUTING';
    currentState.logs.push("Authorization token verified. On-call SRE triggered production remediation.");
    res.json({ success: true, status: currentState.status });
    onApprove();
  });

  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AegisTether | SRE Incident Bastion</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg: #090d16;
            --surface: #111726;
            --surface-border: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent-red: #ef4444;
            --accent-green: #10b981;
            --accent-amber: #f59e0b;
            --accent-blue: #3b82f6;
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            line-height: 1.5;
            padding: 24px;
          }
          .mono { font-family: 'JetBrains Mono', monospace; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--surface-border);
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .logo-group { display: flex; align-items: center; gap: 12px; }
          .badge {
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .badge-critical { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.3); }
          .badge-status { background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); border: 1px solid rgba(245, 158, 11, 0.3); }
          .badge-resolved { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); border: 1px solid rgba(16, 185, 129, 0.3); }
          .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
          .card {
            background: var(--surface);
            border: 1px solid var(--surface-border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
          }
          .card-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 16px;
          }
          .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
          .stat-box { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); }
          .stat-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
          .stat-val { font-size: 18px; font-weight: 700; }
          .diff-viewer {
            background: #050811;
            border-radius: 6px;
            border: 1px solid var(--surface-border);
            overflow: hidden;
            font-size: 12px;
          }
          .diff-header {
            background: rgba(255,255,255,0.03);
            padding: 8px 12px;
            border-bottom: 1px solid var(--surface-border);
            color: var(--text-muted);
            font-weight: 500;
          }
          .diff-content { padding: 12px; line-height: 1.6; }
          .diff-del { color: #f87171; background: rgba(239, 68, 68, 0.1); display: block; padding: 0 4px; }
          .diff-add { color: #4ade80; background: rgba(16, 185, 129, 0.1); display: block; padding: 0 4px; }
          .log-console {
            background: #050811;
            border: 1px solid var(--surface-border);
            border-radius: 6px;
            padding: 12px;
            height: 320px;
            overflow-y: auto;
            font-size: 12px;
            color: #cbd5e1;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .log-entry { display: flex; gap: 8px; }
          .log-ts { color: var(--text-muted); }
          .action-panel {
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%);
            border: 1px solid var(--accent-amber);
            border-radius: 8px;
            padding: 20px;
          }
          .btn {
            display: block;
            width: 100%;
            padding: 12px 16px;
            font-weight: 600;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            transition: all 0.2s ease;
            text-align: center;
          }
          .btn-approve {
            background: var(--accent-green);
            color: #ffffff;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
          }
          .btn-approve:hover { background: #059669; }
          .btn-approve:disabled { background: var(--surface-border); color: var(--text-muted); cursor: not-allowed; }
          .stepper { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
          .step-item { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-muted); }
          .step-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--surface-border); }
          .step-dot.done { background: var(--accent-green); }
          .step-dot.active { background: var(--accent-amber); animation: pulse 1.5s infinite; }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-group">
            <h2 style="letter-spacing: -0.02em;">AEGIS<span style="color: var(--accent-blue);">TETHER</span></h2>
            <span class="badge badge-critical mono">INCIDENT #INC-8904</span>
          </div>
          <div>
            <span id="global-status-badge" class="badge badge-status mono">AWAITING APPROVAL</span>
          </div>
        </div>

        <div class="grid">
          <div>
            <div class="card">
              <div class="card-title">Telemetry & Incident Dossier</div>
              <div class="stats-row">
                <div class="stat-box">
                  <div class="stat-label">TARGET SERVICE</div>
                  <div class="stat-val mono" id="service-name">checkout-service</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">ERROR RATE SPIKE</div>
                  <div class="stat-val mono" style="color: var(--accent-red);" id="error-rate">42.8%</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">OFFENDING COMMIT</div>
                  <div class="stat-val mono" style="color: var(--accent-amber);" id="commit-sha">4c21a8f</div>
                </div>
              </div>
              <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;" id="root-cause-text">
                Timeout threshold reduced below upstream database response SLA in checkout.ts. Causing connection starvation.
              </p>

              <div class="card-title" style="margin-top: 20px;">Isolated Commit Diff (MCP Inspected)</div>
              <div class="diff-viewer mono">
                <div class="diff-header">services/checkout/src/config/timeout.ts</div>
                <div class="diff-content">
                  <span style="color: var(--text-muted);">@@ -14,5 +14,5 @@ export const ConnectionConfig = {</span>
                  <span>   maxRetries: 3,</span>
                  <span class="diff-del">-  requestTimeoutMs: 5000,</span>
                  <span class="diff-add">+  requestTimeoutMs: 50,</span>
                  <span>   idleTimeoutMs: 10000</span>
                </div>
              </div>
            </div>

            <div class="card">
              <div class="card-title">TrueForge Harness Execution Log</div>
              <div class="log-console mono" id="log-console"></div>
            </div>
          </div>

          <div>
            <div class="action-panel" id="action-panel">
              <div class="card-title" style="color: var(--accent-amber);">Irreversible Gate</div>
              <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
                TrueForge paused execution. The proposed remediation will perform a live Kubernetes rollback in production.
              </p>
              
              <div style="background: #050811; padding: 12px; border-radius: 6px; border: 1px solid var(--surface-border); margin-bottom: 16px;">
                <div class="stat-label">COMMAND TO DISPATCH</div>
                <div class="mono" style="font-size: 11px; color: #38bdf8; word-break: break-all;" id="cmd-preview">
                  kubectl rollout undo deployment/checkout-service
                </div>
              </div>

              <button class="btn btn-approve" id="approve-btn" onclick="authorizeAction()">Authorize Production Rollback</button>
            </div>

            <div class="card" style="margin-top: 20px;">
              <div class="card-title">Lifecycle State Machine</div>
              <div class="stepper">
                <div class="step-item"><div class="step-dot done"></div> Ingress Telemetry Alert Fired</div>
                <div class="step-item"><div class="step-dot done"></div> MCP Commit & Cluster Triage</div>
                <div class="step-item"><div class="step-dot done"></div> TrueForge Sandbox Dry-Run Passed</div>
                <div class="step-item"><div class="step-dot active" id="step-gate-dot"></div> Human Authorization Gate</div>
                <div class="step-item"><div class="step-dot" id="step-exec-dot"></div> Production Rollback Dispatched</div>
              </div>
            </div>
          </div>
        </div>

        <script>
          async function fetchState() {
            try {
              const res = await fetch('/api/state');
              const data = await res.json();
              
              document.getElementById('service-name').innerText = data.service;
              document.getElementById('error-rate').innerText = data.errorRate;
              document.getElementById('commit-sha').innerText = data.suspectedCommit;
              document.getElementById('root-cause-text').innerText = data.rootCause;
              document.getElementById('cmd-preview').innerText = data.remediationCommand;

              const logBox = document.getElementById('log-console');
              logBox.innerHTML = data.logs.map(log => 
                '<div class="log-entry"><span class="log-ts">[' + new Date().toLocaleTimeString() + ']</span><span>' + log + '</span></div>'
              ).join('');
              logBox.scrollTop = logBox.scrollHeight;

              if (data.status === 'RESOLVED' || data.status === 'EXECUTING') {
                const badge = document.getElementById('global-status-badge');
                badge.className = 'badge badge-resolved mono';
                badge.innerText = 'RESOLVED';
                
                document.getElementById('step-gate-dot').className = 'step-dot done';
                document.getElementById('step-exec-dot').className = 'step-dot done';
                
                const btn = document.getElementById('approve-btn');
                btn.disabled = true;
                btn.innerText = 'Rollback Executed in Production';
              }
            } catch (err) {
              console.error(err);
            }
          }

          async function authorizeAction() {
            const btn = document.getElementById('approve-btn');
            btn.disabled = true;
            btn.innerText = 'Executing Remediation...';
            await fetch('/api/approve', { method: 'POST' });
            setTimeout(fetchState, 500);
          }

          fetchState();
          setInterval(fetchState, 2000);
        </script>
      </body>
      </html>
    `);
  });

  const server = app.listen(port, () => {
    console.log(`[AegisTether Gateway] Production SRE Console live at http://localhost:${port}`);
  });

  return server;
}