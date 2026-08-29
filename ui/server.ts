import express from 'express';
import path from 'path';
import Database from 'better-sqlite3';
import { dispatchIncident } from '../agent/index';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let currentAgentState = {
  status: 'IDLE',
  errorRate: '0.0%',
  suspectedCommit: 'None',
  rootCause: 'Awaiting cluster telemetry stream...',
  remediationCommand: 'None',
  logs: ['System daemon online. Monitoring cluster telemetry...']
};

export function updateAgentState(newState: Partial<typeof currentAgentState>) {
  currentAgentState = { ...currentAgentState, ...newState };
}

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
  } catch (e) {}
  res.json(currentAgentState);
});

app.get('/api/history', (req, res) => {
  try {
    const db = new Database('aegistether-state.db', { readonly: true });
    const records = db.prepare('SELECT * FROM incident_state ORDER BY id DESC LIMIT 5').all();
    res.json(records);
  } catch (e) {
    res.json([]);
  }
});

// Webhook endpoint to trigger an incident live from the UI
app.post('/api/trigger-incident', async (req, res) => {
  const { alert } = req.body;
  const prompt = alert || "CRITICAL ALERT: Datadog APM has detected a 45.2% 5xx error rate spike on payment-gateway.";
  
  console.log(`\n[AegisTether Webhook] External alert received via API: "${prompt}"`);
  res.json({ success: true, message: "Incident investigation dispatched." });

  dispatchIncident(prompt);
});

let approvalCallback: ((approved: boolean) => void) | null = null;

app.post('/api/action', (req, res) => {
  const { action } = req.body;
  const isApproved = action === 'APPROVE';
  
  console.log(`\n[AegisTether UI] SRE Gate Action Received: ${action}`);
  res.json({ success: true, action });

  if (approvalCallback) {
    approvalCallback(isApproved);
    approvalCallback = null;
  }
});

export function startApprovalGate(onApproval: (approved: boolean) => void) {
  approvalCallback = onApproval;
}

// Automatically start the Express server when running ui/server.ts directly
app.listen(port, () => {
  console.log(`[AegisTether Gateway] Production SRE Bastion live at http://localhost:${port}`);
});