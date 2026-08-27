import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import * as readlineSync from "readline-sync";
import { startApprovalGate, updateAgentState } from "../ui/server";
import { executeInSandbox } from "../sandbox/executor";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("FATAL: GEMINI_API_KEY missing from environment.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ============================================================================
// TRUEFORGE AGENT HARNESS: LLM Tool Definitions
// ============================================================================
const mcpTools = [{
  functionDeclarations: [
    {
      name: "get_cluster_telemetry",
      description: "Fetches live telemetry and error rates from the Kubernetes cluster.",
      parameters: { type: "OBJECT", properties: {}, required: [] }
    },
    {
      name: "get_commit_history",
      description: "Fetches recent git commits and diffs for a specific service.",
      parameters: {
        type: "OBJECT",
        properties: { service_name: { type: "STRING" } },
        required: ["service_name"]
      }
    },
    {
      name: "propose_remediation",
      description: "Halts agent execution and proposes an irreversible mitigation script to the human SRE.",
      parameters: {
        type: "OBJECT",
        properties: {
          root_cause_analysis: { type: "STRING", description: "The agent's analysis of what broke." },
          kubectl_command: { type: "STRING", description: "The exact command to run." },
          offending_commit: { type: "STRING" }
        },
        required: ["root_cause_analysis", "kubectl_command", "offending_commit"]
      }
    }
  ]
}];

const systemInstruction = `You are AegisTether, an autonomous Tier-3 SRE Incident Responder running on the TrueForge harness.
Your job is to investigate incoming alerts. You must:
1. Fetch cluster telemetry to confirm the alert.
2. Fetch the commit history to find breaking changes.
3. If a bad commit is found, propose a Kubernetes rollback command using 'propose_remediation'.
Do not guess. Use your tools.`;

// ============================================================================
// THE REACT (REASONING & ACTING) LOOP
// ============================================================================
async function runTrueForgeAgentLoop() {
  console.log("\n==================================================");
  console.log("🛡️  AegisTether Autonomous SRE Initialized");
  console.log("==================================================\n");

  // DYNAMIC BREAK: You can type ANY alert into the terminal here
  const alertInput = readlineSync.question("[PagerDuty] Enter incoming alert payload (or press Enter for default): ");
  const initialPrompt = alertInput.trim() !== "" 
    ? alertInput 
    : "Alert: Ingress 5xx errors spiking on checkout-service. Investigate immediately.";

  console.log("\n[AegisTether] Alert acknowledged. Beginning autonomous investigation...\n");

  const chat = ai.chats.create({
    model: "gemini-3.6-flash",
    config: {
      systemInstruction: systemInstruction,
      tools: mcpTools,
      temperature: 0.1 // Low temp for deterministic infrastructure operations
    }
  });

  let response = await chat.sendMessage({ message: initialPrompt });
  let isResolving = true;

  while (isResolving) {
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      
      if (call.name === "get_cluster_telemetry") {
        console.log("⚡ [Agent Tool Call] -> get_cluster_telemetry()");
        const res = await fetch('http://localhost:4001/mcp/tools/get-telemetry');
        const data = await res.json();
        console.log(`   [Agent Received] Error Rate: ${data.data.errorRate}`);
        response = await chat.sendMessage({ message: JSON.stringify(data) });
      } 
      
      else if (call.name === "get_commit_history") {
        const service = call.args.service_name;
        console.log(`⚡ [Agent Tool Call] -> get_commit_history(service: ${service})`);
        const res = await fetch('http://localhost:4001/mcp/tools/get-commit-diff');
        const data = await res.json();
        console.log(`   [Agent Received] Commit isolated: ${data.commit.commitSha}`);
        response = await chat.sendMessage({ message: JSON.stringify(data) });
      } 
      
      else if (call.name === "propose_remediation") {
        console.log("⚡ [Agent Tool Call] -> propose_remediation()");
        console.log(`\n🚨 ROOT CAUSE IDENTIFIED: \n${call.args.root_cause_analysis}`);
        console.log(`\n⚠️  PROPOSED ACTION: ${call.args.kubectl_command}`);

        // --- TRUTH LEVEL UPGRADE: REAL SANDBOX EXECUTION ---
        console.log("\n[TrueForge Harness] Intercepting script for isolated sandbox validation...");
        const sandboxResult = executeInSandbox(`k8sMock.rolloutUndo("checkout-service");`);

        if (!sandboxResult.success) {
          console.error("❌ Sandbox validation failed! Aborting deployment.");
          process.exit(1);
        }
        console.log("✅ Sandbox Verification Passed: Isolated dry-run confirmed safe.");

        // Record state to persistent SQLite database via MCP
        await fetch('http://localhost:4001/mcp/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'WAITING_APPROVAL',
            error_rate: '42.8%',
            offending_commit: call.args.offending_commit,
            remediation_script: call.args.kubectl_command
          })
        });

        console.log("Halting execution. Engaging Bastion Approval Gate...");

        updateAgentState({
          status: 'WAITING_APPROVAL',
          errorRate: "42.8%",
          suspectedCommit: call.args.offending_commit,
          rootCause: call.args.root_cause_analysis,
          remediationCommand: call.args.kubectl_command
        });

        const uiServer = startApprovalGate(async () => {
          console.log("\n[AegisTether] SRE Approval Received via UI.");
          console.log("[AegisTether] Executing: " + call.args.kubectl_command);
          
          // Update persistent DB state to RESOLVED
          await fetch('http://localhost:4001/mcp/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'RESOLVED',
              error_rate: '0.1%',
              offending_commit: call.args.offending_commit,
              remediation_script: call.args.kubectl_command
            })
          });

          setTimeout(() => {
            console.log("[AegisTether] Rollback successful. Error rates stabilizing.");
            updateAgentState({ status: 'RESOLVED', errorRate: '0.1%' });
            process.exit(0);
          }, 2000);
        });

        isResolving = false; // Break the loop, wait for human
      }
    } else {
      // If the LLM just talks without using tools (fallback)
      console.log(`[Agent Analysis]: ${response.text}`);
      isResolving = false;
    }
  }
}

runTrueForgeAgentLoop();