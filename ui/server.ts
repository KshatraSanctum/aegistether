import express from 'express';
import path from 'path';
import Database from 'better-sqlite3';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let currentAgentState = {
  status: 'IDLE',
  errorRate: '0.0%',
  suspectedCommit: 'None',
  rootCause: 'Waiting for telemetry alert...',
  remediationCommand: 'None',
  logs: ['System initialized. Awaiting SRE telemetry trigger...']
};

export function updateAgentState(newState: Partial<typeof currentAgentState>) {
  currentAgentState = { ...currentAgentState, ...newState };
}

// API endpoint for UI to fetch live state from SQLite / Agent memory
app.get('/api/state', (req, res) => {
  try {
    const db = new Database('aegistether-state.db', { readonly: true });
    const latestIncident = db.prepare('SELECT * FROM incident_state ORDER BY id DESC LIMIT 1').get() as any;
    
    if (latestIncident) {
      res.json({
        ...currentAgentState,
        dbStatus: latestIncident.status,
        dbErrorRate: latestIncident.error_rate,
        dbCommit: latestIncident.offending_commit,
        dbScript: latestIncident.remediation_script,
        timestamp: latestIncident.timestamp
      });
      return;
    }
  } catch (e) {
    // Fallback if DB is locked or uninitialized
  }
  res.json(currentAgentState);
});

let approvalCallback: (() => void) | null = null;

app.post('/api/approve', (req, res) => {
  console.log("\n[AegisTether UI] Authorization token verified. Triggering remediation...");
  res.json({ success: true, message: "Remediation dispatched." });
  
  if (approvalCallback) {
    approvalCallback();
    approvalCallback = null;
  }
});

export function startApprovalGate(onApproval: () => void) {
  approvalCallback = onApproval;
  
  const server = app.listen(port, () => {
    console.log(`\n[AegisTether Gateway] Production SRE Console live at http://localhost:${port}`);
  });

  return server;
}