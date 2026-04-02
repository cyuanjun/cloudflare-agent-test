import { renderShell } from "./theme";

function escapeForTemplate(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("`", "\\`");
}

export function renderAgentProfilePage(profileId: string): string {
  const safeProfileId = escapeForTemplate(profileId);
  const body = `
    <section>
      <div class="eyebrow mono">Profile Detail</div>
      <h1 class="title">Agent Page</h1>
      <p class="subtitle">Profile-scoped view of the deployed agents attached to this profile. Inspect the latest profile and preferences payload plus the full run history for this profile id.</p>
    </section>

    <section class="metric-strip" style="margin-top:24px">
      <div class="metric"><div class="metric-label">Profile</div><div class="metric-value" id="metricProfile">-</div></div>
      <div class="metric"><div class="metric-label">Runs</div><div class="metric-value" id="metricRuns">-</div></div>
      <div class="metric"><div class="metric-label">Running</div><div class="metric-value" id="metricRunning">-</div></div>
      <div class="metric"><div class="metric-label">Last Updated</div><div class="metric-value" id="metricUpdated">-</div></div>
    </section>

    <section class="panel" style="margin-top:24px">
      <div class="panel-title">
        <strong>Latest Run Result</strong>
        <span class="pill"><span class="pulse"></span> Completed Output</span>
      </div>
      <div id="resultStatus" class="status muted mono">Loading latest run result.</div>
      <div class="metric-strip" style="margin-top:12px">
        <div class="metric"><div class="metric-label">Squad Size</div><div class="metric-value" id="metricSquadSize">-</div></div>
        <div class="metric"><div class="metric-label">Total Score</div><div class="metric-value" id="metricScore">-</div></div>
        <div class="metric"><div class="metric-label">Total Cost</div><div class="metric-value" id="metricCost">-</div></div>
        <div class="metric"><div class="metric-label">Bank Left</div><div class="metric-value" id="metricBank">-</div></div>
      </div>
      <div class="table-wrap" style="margin-top:12px">
        <table>
          <thead><tr><th>Player</th><th>Team</th><th>Pos</th><th>Price</th><th>Score</th><th>Rank</th></tr></thead>
          <tbody id="resultRows"><tr><td colspan="6" class="muted mono">Loading.</td></tr></tbody>
        </table>
      </div>
    </section>

    <section class="grid two" style="margin-top:24px">
      <div class="panel">
        <div class="panel-title">
          <strong>Profile Payload</strong>
          <span class="pill"><span class="pulse"></span> Latest Input</span>
        </div>
        <div id="profileStatus" class="status muted mono">Loading profile payload.</div>
        <pre id="profileJson" style="margin-top:12px">Waiting for data.</pre>
      </div>
      <div class="panel">
        <div class="panel-title">
          <strong>Preferences Payload</strong>
          <span class="mono muted">Latest Input</span>
        </div>
        <div id="preferencesStatus" class="status muted mono">Loading preferences payload.</div>
        <pre id="preferencesJson" style="margin-top:12px">Waiting for data.</pre>
      </div>
    </section>

    <section class="panel" style="margin-top:24px">
      <div class="panel-title">
        <strong>Run History</strong>
        <span class="mono muted">Profile-scoped timeline</span>
      </div>
      <div id="historyStatus" class="status muted mono">Loading run history.</div>
      <div class="table-wrap" style="margin-top:12px">
        <table>
          <thead><tr><th>Run ID</th><th>Status</th><th>Progress</th><th>Created</th><th>Last Updated</th><th>Error</th></tr></thead>
          <tbody id="historyRows"><tr><td colspan="6" class="muted mono">Loading.</td></tr></tbody>
        </table>
      </div>
    </section>
  `;

  const script = `
    const profileId = \`${safeProfileId}\`;
    const metricProfile = document.getElementById("metricProfile");
    const metricRuns = document.getElementById("metricRuns");
    const metricRunning = document.getElementById("metricRunning");
    const metricUpdated = document.getElementById("metricUpdated");
    const metricSquadSize = document.getElementById("metricSquadSize");
    const metricScore = document.getElementById("metricScore");
    const metricCost = document.getElementById("metricCost");
    const metricBank = document.getElementById("metricBank");
    const resultStatus = document.getElementById("resultStatus");
    const profileStatus = document.getElementById("profileStatus");
    const preferencesStatus = document.getElementById("preferencesStatus");
    const historyStatus = document.getElementById("historyStatus");
    const resultRows = document.getElementById("resultRows");
    const profileJson = document.getElementById("profileJson");
    const preferencesJson = document.getElementById("preferencesJson");
    const historyRows = document.getElementById("historyRows");

    function formatJson(value) {
      return value ? JSON.stringify(value, null, 2) : "No data available.";
    }

    async function loadProfilePage() {
      try {
        const response = await fetch("/api/profiles/" + encodeURIComponent(profileId));
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load profile detail.");

        metricProfile.textContent = payload.profileId;
        metricRuns.textContent = String(payload.summary.totalRuns);
        metricRunning.textContent = String(payload.summary.runningRuns);
        metricUpdated.textContent = payload.summary.lastUpdated || "-";

        if (payload.latestResult) {
          resultStatus.innerHTML = [
            "GENERATED: " + (payload.latestResult.generatedAt || "-"),
            "DATASET VERSION: " + (payload.latestResult.datasetVersion || "-"),
            "VIOLATIONS: " + ((payload.latestResult.constraintViolations || []).length)
          ].join("<br>");
          resultStatus.className = "status live mono";
          metricSquadSize.textContent = String(payload.latestResult.squad?.length ?? 0);
          metricScore.textContent = Number(payload.latestResult.totalScore ?? 0).toFixed(1);
          metricCost.textContent = "£" + Number(payload.latestResult.totalCost ?? 0).toFixed(1) + "m";
          metricBank.textContent = "£" + Number(payload.latestResult.budgetRemaining ?? 0).toFixed(1) + "m";
          resultRows.innerHTML = payload.latestResult.squad.length
            ? payload.latestResult.squad.map((player) => "<tr>" +
                "<td>" + player.name + "</td>" +
                "<td>" + player.teamName + "</td>" +
                "<td>" + player.position + "</td>" +
                "<td>£" + Number(player.price).toFixed(1) + "m</td>" +
                "<td>" + Number(player.score).toFixed(2) + "</td>" +
                "<td>" + player.rankWithinPosition + "</td>" +
              "</tr>").join("")
            : "<tr><td colspan='6' class='muted mono'>The latest result does not contain a squad.</td></tr>";
        } else {
          resultStatus.textContent = "No completed run result is available for this profile yet.";
          resultStatus.className = "status mono";
          metricSquadSize.textContent = "-";
          metricScore.textContent = "-";
          metricCost.textContent = "-";
          metricBank.textContent = "-";
          resultRows.innerHTML = "<tr><td colspan='6' class='muted mono'>No run result available yet.</td></tr>";
        }

        profileStatus.innerHTML = [
          "AGENT ID: " + (payload.latestInput?.userProfile?.agent_id || payload.profileId),
          "MODE: " + (payload.latestInput?.userProfile?.mode?.current || "-"),
          "CURRENT ARCHETYPE: " + (payload.latestInput?.userProfile?.identity?.primary_archetype || "-")
        ].join("<br>");
        profileStatus.className = "status live mono";

        preferencesStatus.innerHTML = [
          "LOCKED PLAYERS: " + (payload.latestInput?.userPreferences?.player_preferences?.locked_players?.length ?? 0),
          "BANNED PLAYERS: " + (payload.latestInput?.userPreferences?.player_preferences?.banned_players?.length ?? 0),
          "RESERVED BANK: " + (payload.latestInput?.userPreferences?.budget_preferences?.reserved_bank ?? 0)
        ].join("<br>");
        preferencesStatus.className = "status mono";

        profileJson.textContent = formatJson(payload.latestInput?.userProfile);
        preferencesJson.textContent = formatJson(payload.latestInput?.userPreferences);

        historyStatus.innerHTML = [
          "TOTAL RUNS: " + payload.summary.totalRuns,
          "QUEUED: " + payload.summary.queuedRuns,
          "COMPLETED: " + payload.summary.completedRuns,
          "FAILED: " + payload.summary.failedRuns
        ].join("<br>");
        historyStatus.className = "status mono";

        historyRows.innerHTML = payload.runs.length
          ? payload.runs.map((run) => "<tr>" +
              "<td class='mono'>" + run.runId + "</td>" +
              "<td>" + run.status + "</td>" +
              "<td>" + run.progress + "</td>" +
              "<td>" + run.createdAt + "</td>" +
              "<td>" + run.updatedAt + "</td>" +
              "<td>" + (run.error || "-") + "</td>" +
            "</tr>").join("")
          : "<tr><td colspan='6' class='muted mono'>No runs found for this profile.</td></tr>";
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load profile detail.";
        resultStatus.textContent = message;
        resultStatus.className = "status error mono";
        profileStatus.textContent = message;
        profileStatus.className = "status error mono";
        preferencesStatus.textContent = message;
        preferencesStatus.className = "status error mono";
        historyStatus.textContent = message;
        historyStatus.className = "status error mono";
        metricSquadSize.textContent = "-";
        metricScore.textContent = "-";
        metricCost.textContent = "-";
        metricBank.textContent = "-";
        resultRows.innerHTML = "<tr><td colspan='6' class='muted mono'>No result available.</td></tr>";
        profileJson.textContent = "No data available.";
        preferencesJson.textContent = "No data available.";
        historyRows.innerHTML = "<tr><td colspan='6' class='muted mono'>No history available.</td></tr>";
      }
    }

    loadProfilePage();
  `;

  return renderShell(`Fantopy Agent ${profileId}`, "deployed-agents", body, script);
}
