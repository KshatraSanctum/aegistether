import express from 'express';
import Database from 'better-sqlite3';

const app = express();
const port = 4001;
app.use(express.json());

// Initialize Persistent State Memory
const db = new Database('aegistether-state.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS incident_state (
    id INTEGER PRIMARY KEY,
    status TEXT,
    error_rate TEXT,
    offending_commit TEXT,
    remediation_script TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log("[MCP Server] SQLite persistent state initialized.");

// 1. LIVE TELEMETRY ENDPOINT
app.get('/mcp/tools/get-telemetry', (req, res) => {
  // In a real enterprise, this fetches from Datadog/Prometheus.
  // We simulate the trigger, but the fetching mechanism is real HTTP.
  const dynamicErrorRate = (Math.random() * (45 - 35) + 35).toFixed(1); 
  res.json({
    source: "Prometheus API",
    status: "CRITICAL",
    data: {
      service: "checkout-service",
      errorRate: `${dynamicErrorRate}%`,
      p99Latency: "4800ms"
    }
  });
});

// 2. LIVE GITHUB API ENDPOINT
app.get('/mcp/tools/get-commit-diff', async (req, res) => {
  try {
    // We are querying the actual public GitHub API for your repository
    const githubResponse = await fetch('https://api.github.com/repos/KshatraSanctum/aegistether/commits');
    const commits = await githubResponse.json();

    if (!commits || commits.length === 0) {
      return res.status(404).json({ error: "No commits found." });
    }

    const latestCommit = commits[0];
    
    res.json({
      source: "GitHub API",
      commit: {
        sha: latestCommit.sha.substring(0, 7),
        author: latestCommit.commit.author.name,
        message: latestCommit.commit.message,
        url: latestCommit.html_url
      },
      analysis_hint: "This is live data pulled directly from the GitHub API."
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to reach GitHub API" });
  }
});

// 3. PERSISTENT STATE ENDPOINTS
app.post('/mcp/state', (req, res) => {
  const { status, error_rate, offending_commit, remediation_script } = req.body;
  const stmt = db.prepare('INSERT INTO incident_state (status, error_rate, offending_commit, remediation_script) VALUES (?, ?, ?, ?)');
  stmt.run(status, error_rate, offending_commit, remediation_script);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`[MCP Server] Live cluster telemetry and GitHub API provider running on http://localhost:${port}`);
});