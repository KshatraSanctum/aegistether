import { config } from "dotenv";
import { startApprovalGate, updateAgentState } from "../ui/server";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY missing from environment.");
  process.exit(1);
}

async function runAegisTetherHarness() {
  console.log("[AegisTether] Starting TrueForge Autonomous SRE Agent...");
  
  // 1. Tool Call: Fetch Live Telemetry via MCP Server
  console.log("[AegisTether] Harness delegating to MCP tool: get-telemetry...");
  const telemetryRes = await fetch('http://localhost:4001/mcp/tools/get-telemetry');
  const telemetryData = await telemetryRes.json();
  
  // 2. Tool Call: Fetch Commit Diff via MCP Server
  console.log("[AegisTether] Harness delegating to MCP tool: get-commit-diff...");
  const diffRes = await fetch('http://localhost:4001/mcp/tools/get-commit-diff');
  const diffData = await diffRes.json();

  console.log(`[TrueForge] Suspected commit isolated: ${diffData.commit.commitSha}`);

  let uiServer: ReturnType<typeof startApprovalGate>;

  uiServer = startApprovalGate(() => {
    console.log("\n[AegisTether] SRE Approval Received via Bastion Console.");
    console.log("[AegisTether] Dispatching remediation script to cluster...");

    setTimeout(() => {
      console.log("[AegisTether] Rollback successfully completed. Pods healthy.");
      
      updateAgentState({
        status: 'RESOLVED',
        errorRate: '0.1%', // Simulating recovery
        logs: [
          "Ingress 5xx error rate dropped to nominal (0.1%)",
          `Kubernetes Deployment 'checkout-service' rolled back safely.`,
          "Telemetry verification complete. Incident INC-8904 marked RESOLVED."
        ]
      });

      console.log("[AegisTether] Session safely finalized.");
    }, 2000);
  });

  // Inject the dynamically fetched MCP data into the UI State
  updateAgentState({
    status: 'WAITING_APPROVAL',
    errorRate: telemetryData.data.errorRate,
    suspectedCommit: diffData.commit.commitSha,
    remediationCommand: `kubectl rollout undo deployment/checkout-service --namespace=production`
  });
}

runAegisTetherHarness();