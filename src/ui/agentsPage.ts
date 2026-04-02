import { renderShell } from "./theme";

export function renderAgentsPage(): string {
  const body = `
    <section>
      <div class="eyebrow mono">Run Inventory</div>
      <h1 class="title">Deployed Agents</h1>
      <p class="subtitle">Profile-first table view of all created run agents tracked by the registry. Open a profile to inspect its latest payloads and full run history.</p>
    </section>

    <section class="panel" style="margin-top:24px">
      <div class="panel-title">
        <strong>Registry Table</strong>
        <span class="pill"><span class="pulse"></span> Durable Object Registry</span>
      </div>
      <div class="toolbar">
        <div class="grow"><input id="searchInput" type="search" placeholder="Search by profile id, status, or progress..." /></div>
        <select id="statusFilter" style="max-width:180px">
          <option value="">All Statuses</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <button id="refreshButton" class="secondary">Refresh Table</button>
      </div>
      <div id="status" class="status muted mono" style="margin-top:12px">Loading deployed agents.</div>
    </section>

    <section class="panel" style="margin-top:24px">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profile</th><th>Runs</th><th>Latest Status</th><th>Latest Progress</th><th>Last Updated</th></tr></thead>
          <tbody id="agentsRows"><tr><td colspan="5" class="muted mono">Loading.</td></tr></tbody>
        </table>
      </div>
      <div class="scroll-note" id="rowCount">0 rows</div>
    </section>
  `;

  const script = `
    const state = { agents: [] };
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");
    const refreshButton = document.getElementById("refreshButton");
    const status = document.getElementById("status");
    const agentsRows = document.getElementById("agentsRows");
    const rowCount = document.getElementById("rowCount");

    function groupedAgents() {
      const groups = new Map();
      for (const agent of state.agents) {
        const profileId = agent.profileId || "unassigned";
        const existing = groups.get(profileId) || {
          profileId,
          latestStatus: agent.status,
          latestProgress: agent.progress,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
          runs: [],
        };
        existing.runs.push(agent);
        if (agent.updatedAt > existing.updatedAt) {
          existing.latestStatus = agent.status;
          existing.latestProgress = agent.progress;
          existing.updatedAt = agent.updatedAt;
        }
        groups.set(profileId, existing);
      }
      return [...groups.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    }

    function filteredAgents() {
      const query = searchInput.value.trim().toLowerCase();
      const filter = statusFilter.value;
      return groupedAgents().filter((group) => {
        const matchesStatus = !filter || group.runs.some((agent) => agent.status === filter);
        const haystack = JSON.stringify([
          group.profileId,
          group.latestStatus,
          group.latestProgress,
        ]).toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        return matchesStatus && matchesQuery;
      });
    }

    function renderAgents() {
      const rows = filteredAgents();
      agentsRows.innerHTML = rows.length
        ? rows.map((group) => "<tr>" +
            "<td>" + (group.profileId === "unassigned"
              ? "<span class='mono muted'>unassigned</span>"
              : "<a class='button tertiary' style='min-height:30px' href='/agents/" + encodeURIComponent(group.profileId) + "'>" + group.profileId + "</a>") + "</td>" +
            "<td>" + group.runs.length + "</td>" +
            "<td>" + group.latestStatus + "</td>" +
            "<td>" + group.latestProgress + "</td>" +
            "<td>" + group.updatedAt + "</td>" +
          "</tr>").join("")
        : "<tr><td colspan='5' class='muted mono'>No agents match the current filters.</td></tr>";

      rowCount.textContent = rows.length + " rows";
    }

    async function loadAgents() {
      status.textContent = "Loading deployed agents.";
      status.className = "status mono";
      try {
        const response = await fetch("/api/agents");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load deployed agents.");
        state.agents = payload;
        const running = payload.filter((agent) => agent.status === "running").length;
        status.innerHTML = [
          "TOTAL RUNS: " + payload.length,
          "TOTAL PROFILES: " + groupedAgents().length,
          "RUNNING: " + running,
          "LAST UPDATED: " + (payload[0]?.updatedAt || "-")
        ].join("<br>");
        status.className = "status live mono";
        renderAgents();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Failed to load deployed agents.";
        status.className = "status error mono";
      }
    }

    searchInput.addEventListener("input", renderAgents);
    statusFilter.addEventListener("change", renderAgents);
    refreshButton.addEventListener("click", loadAgents);
    loadAgents();
  `;

  return renderShell("Fantopy Deployed Agents", "deployed-agents", body, script);
}
