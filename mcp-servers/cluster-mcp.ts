import express from 'express';

const app = express();
const PORT = 4001;

// Mock enterprise cluster and git repository state
const clusterData = {
  service: "checkout-service",
  namespace: "production",
  activePods: 4,
  recentDeploys: [
    {
      commitSha: "4c21a8f",
      author: "sre-bot",
      message: "perf: optimize connection pool timeout",
      diff: "maxRetries: 3,\n- requestTimeoutMs: 5000,\n+ requestTimeoutMs: 50,\n  idleTimeoutMs: 10000"
    }
  ],
  telemetry: {
    errorRate: "42.8%",
    p99LatencyMs: "4800ms",
    status: "CRITICAL_SPIKE"
  }
};

app.get('/mcp/tools/get-telemetry', (req, res) => {
  res.json({ success: true, data: clusterData.telemetry });
});

app.get('/mcp/tools/get-commit-diff', (req, res) => {
  res.json({ success: true, commit: clusterData.recentDeploys[0] });
});

app.listen(PORT, () => {
  console.log(`[MCP Server] Cluster telemetry provider running on http://localhost:${PORT}`);
});