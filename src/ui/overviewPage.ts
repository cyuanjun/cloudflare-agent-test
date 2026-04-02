import { renderShell } from "./theme";

export function renderOverviewPage(): string {
  const body = `
    <section>
      <div class="eyebrow mono">Mission Control</div>
      <h1 class="title">Overview</h1>
      <p class="subtitle">Top-level operational view for the shared FPL dataset, player corpus, and deployed run agents. Use this page to confirm the system is healthy before loading data or creating a new agent run.</p>
    </section>

    <section class="metric-strip" style="margin-top:24px">
      <div class="metric"><div class="metric-label">Dataset Status</div><div class="metric-value" id="metricDataset">Checking</div></div>
      <div class="metric"><div class="metric-label">Current GW</div><div class="metric-value" id="metricGw">-</div></div>
      <div class="metric"><div class="metric-label">Players</div><div class="metric-value" id="metricPlayers">-</div></div>
      <div class="metric"><div class="metric-label">Agents</div><div class="metric-value" id="metricAgents">-</div></div>
    </section>

    <section class="grid three" style="margin-top:24px">
      <div class="panel">
        <div class="panel-title"><strong>Dataset Info</strong><span class="pill"><span class="pulse"></span> Shared</span></div>
        <div id="datasetStatus" class="status muted mono">Loading dataset telemetry.</div>
        <div class="actions" style="margin-top:12px">
          <a class="button secondary" href="/data">Load Dataset</a>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title"><strong>Player Info</strong><span class="mono muted">Explorer</span></div>
        <div id="playerStatus" class="status muted mono">Loading player telemetry.</div>
        <div class="actions" style="margin-top:12px">
          <a class="button tertiary" href="/players">Open Player Data</a>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title"><strong>Agent Info</strong><span class="mono muted">Run inventory</span></div>
        <div id="agentStatus" class="status muted mono">Loading agent telemetry.</div>
        <div class="actions" style="margin-top:12px">
          <a class="button tertiary" href="/agents">Open Deployed Agents</a>
          <a class="button" href="/create-agent">Create Agent</a>
        </div>
      </div>
    </section>

    <section class="grid two" style="margin-top:24px">
      <div class="panel">
        <div class="panel-title"><strong>Latest Players</strong><span class="mono muted">Shared dataset sample</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Team</th><th>Pos</th><th>Price</th></tr></thead>
            <tbody id="latestPlayersRows"><tr><td colspan="4" class="muted mono">Loading.</td></tr></tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <div class="panel-title"><strong>Latest Agents</strong><span class="mono muted">Most recently updated</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Run Id</th><th>Profile</th><th>Status</th><th>Updated</th></tr></thead>
            <tbody id="latestAgentsRows"><tr><td colspan="4" class="muted mono">Loading.</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const script = `
    async function loadOverview() {
      const [dataResponse, agentsResponse] = await Promise.all([
        fetch("/api/data"),
        fetch("/api/agents"),
      ]);

      const dataPayload = await dataResponse.json().catch(() => ({}));
      const agentsPayload = await agentsResponse.json().catch(() => ([]));

      const datasetAvailable = Boolean(dataPayload.available);
      document.getElementById("metricDataset").textContent = datasetAvailable ? "Ready" : "Missing";
      document.getElementById("metricGw").textContent = dataPayload.currentGameweek ?? "-";
      document.getElementById("metricPlayers").textContent = dataPayload.playerCount ?? "-";
      document.getElementById("metricAgents").textContent = Array.isArray(agentsPayload) ? agentsPayload.length : "-";

      document.getElementById("datasetStatus").innerHTML = [
        "AVAILABLE: " + datasetAvailable,
        "VERSION: " + (dataPayload.datasetVersion || "-"),
        "REFRESHED: " + (dataPayload.refreshedAt || "-"),
        "SCHEMA: " + (dataPayload.schemaVersion ?? "-")
      ].join("<br>");
      document.getElementById("datasetStatus").className = datasetAvailable ? "status live mono" : "status mono";

      document.getElementById("playerStatus").innerHTML = [
        "PLAYER COUNT: " + (dataPayload.playerCount ?? "-"),
        "FEATURE COUNT: " + (dataPayload.dataset?.playerFeatures?.length ?? "-"),
        "FIXTURE WINDOWS: " + (dataPayload.dataset?.fixtureDifficultySummary?.length ?? "-")
      ].join("<br>");
      document.getElementById("playerStatus").className = "status mono";

      const running = Array.isArray(agentsPayload) ? agentsPayload.filter((agent) => agent.status === "running").length : 0;
      const completed = Array.isArray(agentsPayload) ? agentsPayload.filter((agent) => agent.status === "completed").length : 0;
      document.getElementById("agentStatus").innerHTML = [
        "TOTAL AGENTS: " + (Array.isArray(agentsPayload) ? agentsPayload.length : 0),
        "RUNNING: " + running,
        "COMPLETED: " + completed
      ].join("<br>");
      document.getElementById("agentStatus").className = "status mono";

      const latestPlayers = dataPayload.dataset?.players?.slice(0, 6) ?? [];
      document.getElementById("latestPlayersRows").innerHTML = latestPlayers.length
        ? latestPlayers.map((player) => "<tr><td>" + player.web_name + "</td><td>" + player.team_name + "</td><td>" + player.position + "</td><td>£" + Number(player.now_cost).toFixed(1) + "m</td></tr>").join("")
        : "<tr><td colspan='4' class='muted mono'>No shared dataset loaded yet.</td></tr>";

      const latestAgents = Array.isArray(agentsPayload) ? agentsPayload.slice(0, 8) : [];
      document.getElementById("latestAgentsRows").innerHTML = latestAgents.length
        ? latestAgents.map((agent) => "<tr><td>" + agent.runId.slice(0, 8) + "</td><td>" + (agent.profileId || "-") + "</td><td>" + agent.status + "</td><td>" + agent.updatedAt + "</td></tr>").join("")
        : "<tr><td colspan='4' class='muted mono'>No deployed agents yet.</td></tr>";
    }

    loadOverview();
  `;

  return renderShell("Fantopy Overview", "overview", body, script);
}
