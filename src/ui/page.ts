import { renderShell } from "./theme";

export function renderHomePage(): string {
  const body = `
    <section>
      <div class="eyebrow mono">Cloudflare Agent Frontend</div>
      <h1 class="title">Agent Overview</h1>
      <p class="subtitle">Upload a profile JSON and preferences JSON, trigger a Cloudflare agent run, then inspect rankings, squad output, raw player data, and derived features in the linked data explorer pages.</p>
    </section>

    <section class="metric-strip" style="margin-top:24px">
      <div class="metric">
        <div class="metric-label">Run Model</div>
        <div class="metric-value">Async DO</div>
      </div>
      <div class="metric">
        <div class="metric-label">Shared Dataset</div>
        <div class="metric-value" id="metricDataset">Checking</div>
      </div>
      <div class="metric">
        <div class="metric-label">Current GW</div>
        <div class="metric-value" id="metricGw">-</div>
      </div>
      <div class="metric">
        <div class="metric-label">Player Count</div>
        <div class="metric-value" id="metricPlayers">-</div>
      </div>
    </section>

    <section class="grid two" style="margin-top:24px">
      <div class="panel">
        <div class="panel-title">
          <strong>Run Inputs</strong>
          <span class="pill"><span class="pulse"></span> Profile Aware</span>
        </div>
        <label class="mono muted" for="profileFile">User profile JSON</label>
        <label for="profileFile" style="display:block; margin:8px 0 14px; cursor:pointer;">
          <input id="profileFile" type="file" accept=".json,application/json" style="position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;" />
          <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:62px; padding:14px 16px; border:1px solid var(--border-light); background:linear-gradient(180deg, rgba(0,212,170,0.08), rgba(255,255,255,0.01));">
            <div>
              <div class="mono" style="color:var(--accent); font-size:11px; letter-spacing:0.08em; text-transform:uppercase;">Choose Profile File</div>
              <div id="profileFileName" class="muted" style="margin-top:6px;">No file selected.</div>
            </div>
            <span class="button secondary" style="pointer-events:none;">Browse</span>
          </div>
        </label>
        <label class="mono muted" for="preferencesFile">User preferences JSON</label>
        <label for="preferencesFile" style="display:block; margin:8px 0 14px; cursor:pointer;">
          <input id="preferencesFile" type="file" accept=".json,application/json" style="position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;" />
          <div style="display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:62px; padding:14px 16px; border:1px solid var(--border-light); background:linear-gradient(180deg, rgba(0,212,170,0.08), rgba(255,255,255,0.01));">
            <div>
              <div class="mono" style="color:var(--accent); font-size:11px; letter-spacing:0.08em; text-transform:uppercase;">Choose Preferences File</div>
              <div id="preferencesFileName" class="muted" style="margin-top:6px;">No file selected.</div>
            </div>
            <span class="button secondary" style="pointer-events:none;">Browse</span>
          </div>
        </label>
        <div id="validation" class="status muted mono">Select both files to begin.</div>
        <div class="actions" style="margin-top:12px">
          <button id="runButton">Run Agent</button>
          <a class="button secondary" href="/api/templates/user_profile.json" download>Sample Profile</a>
          <a class="button secondary" href="/api/templates/user_preferences.json" download>Sample Preferences</a>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">
          <strong>Run Telemetry</strong>
          <span class="pill"><span class="pulse"></span> Live Status</span>
        </div>
        <div id="runStatus" class="status muted mono">No run started yet.</div>
        <div class="actions" style="margin-top:12px">
          <button id="refreshButton" class="secondary">Refresh Status</button>
          <a class="button tertiary" href="/players">Open Players</a>
          <a class="button tertiary" href="/data">Open Dataset</a>
        </div>
      </div>
    </section>

    <section class="grid two" style="margin-top:24px">
      <div class="panel">
        <div class="panel-title">
          <strong>Selected Squad</strong>
          <span class="mono muted">Result artifact</span>
        </div>
        <div id="squadSummary" class="status muted mono">Results will appear here.</div>
        <div class="table-wrap" style="margin-top:12px">
          <table>
            <thead>
              <tr><th>Pos</th><th>Name</th><th>Team</th><th>Price</th><th>Score</th></tr>
            </thead>
            <tbody id="squadTableRows">
              <tr><td colspan="5" class="muted mono">No squad yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">
          <strong>Top Rankings</strong>
          <span class="mono muted">Top 5 by position</span>
        </div>
        <div id="rankingTables" class="grid two"></div>
      </div>
    </section>
  `;

  const script = `
    const state = { runId: null, pollHandle: null, parsedProfile: null, parsedPreferences: null };
    const profileFile = document.getElementById("profileFile");
    const preferencesFile = document.getElementById("preferencesFile");
    const validation = document.getElementById("validation");
    const profileFileName = document.getElementById("profileFileName");
    const preferencesFileName = document.getElementById("preferencesFileName");
    const runButton = document.getElementById("runButton");
    const refreshButton = document.getElementById("refreshButton");
    const runStatus = document.getElementById("runStatus");
    const squadSummary = document.getElementById("squadSummary");
    const squadTableRows = document.getElementById("squadTableRows");
    const rankingTables = document.getElementById("rankingTables");

    async function readJsonFile(file) {
      if (!file) return null;
      return JSON.parse(await file.text());
    }

    async function loadDatasetMetrics() {
      try {
        const response = await fetch("/api/data");
        const payload = await response.json();
        document.getElementById("metricDataset").textContent = payload.available ? "Ready" : "Missing";
        document.getElementById("metricGw").textContent = payload.currentGameweek ?? "-";
        document.getElementById("metricPlayers").textContent = payload.playerCount ?? "-";
      } catch {
        document.getElementById("metricDataset").textContent = "Error";
      }
    }

    async function validateLocalFiles() {
      profileFileName.textContent = profileFile.files[0] ? profileFile.files[0].name : "No file selected.";
      preferencesFileName.textContent = preferencesFile.files[0] ? preferencesFile.files[0].name : "No file selected.";
      try {
        state.parsedProfile = await readJsonFile(profileFile.files[0]);
        state.parsedPreferences = await readJsonFile(preferencesFile.files[0]);
        if (!state.parsedProfile || !state.parsedPreferences) {
          validation.textContent = "Both JSON files are required.";
          validation.className = "status muted mono";
          return false;
        }
        validation.textContent = "Local JSON parse succeeded. Server-side schema validation will run on submit.";
        validation.className = "status live mono";
        return true;
      } catch (error) {
        validation.textContent = error instanceof Error ? error.message : "Failed to parse JSON.";
        validation.className = "status error mono";
        return false;
      }
    }

    function renderResult(result) {
      if (!result) {
        squadSummary.textContent = "Results will appear here.";
        squadSummary.className = "status muted mono";
        squadTableRows.innerHTML = '<tr><td colspan="5" class="muted mono">No squad yet.</td></tr>';
        rankingTables.innerHTML = "";
        return;
      }

      squadSummary.innerHTML = [
        "PROFILE: " + result.profileId,
        "DATASET: " + result.datasetVersion,
        "TOTAL COST: £" + result.totalCost.toFixed(1) + "m",
        "BANK LEFT: £" + result.budgetRemaining.toFixed(1) + "m",
        "TOTAL SCORE: " + result.totalScore.toFixed(2),
        result.constraintViolations.length ? "WARNINGS: " + result.constraintViolations.map((item) => item.detail).join("; ") : "WARNINGS: NONE"
      ].join("<br>");
      squadSummary.className = "status mono";

      squadTableRows.innerHTML = result.squad.map((player) =>
        "<tr><td>" + player.position + "</td><td>" + player.name + "</td><td>" + player.teamName + "</td><td>£" + player.price.toFixed(1) + "m</td><td>" + player.score.toFixed(2) + "</td></tr>"
      ).join("");

      rankingTables.innerHTML = Object.entries(result.rankings).map(([position, rows]) => {
        const topFive = rows.slice(0, 5);
        return "<div class='panel'><div class='panel-title'><strong>" + position + "</strong><span class='mono muted'>Ranking</span></div><div class='table-wrap'><table><thead><tr><th>Name</th><th>Team</th><th>Score</th></tr></thead><tbody>" +
          topFive.map((row) => "<tr><td>" + row.name + "</td><td>" + row.teamName + "</td><td>" + row.score.toFixed(2) + "</td></tr>").join("") +
          "</tbody></table></div></div>";
      }).join("");
    }

    async function loadRunStatus() {
      if (!state.runId) return;
      const response = await fetch("/api/runs/" + encodeURIComponent(state.runId));
      const payload = await response.json();
      if (!response.ok) {
        runStatus.textContent = payload.error || "Failed to load run status.";
        runStatus.className = "status error mono";
        return;
      }
      runStatus.innerHTML = [
        "RUN ID: " + payload.runId,
        "STATUS: " + payload.status,
        "PROGRESS: " + payload.progress,
        payload.error ? "ERROR: " + payload.error : "UPDATED: " + payload.updatedAt
      ].join("<br>");
      runStatus.className = payload.status === "failed" ? "status error mono" : payload.status === "completed" ? "status live mono" : "status mono";
      renderResult(payload.result || null);
      if (payload.status === "completed" || payload.status === "failed") {
        if (state.pollHandle) clearInterval(state.pollHandle);
        state.pollHandle = null;
      }
    }

    async function startRun() {
      const ready = await validateLocalFiles();
      if (!ready) return;
      runButton.disabled = true;
      try {
        const response = await fetch("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userProfile: state.parsedProfile,
            userPreferences: state.parsedPreferences
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Run creation failed.");
        }
        state.runId = payload.runId;
        runStatus.textContent = "Run created. Waiting for first status update.";
        runStatus.className = "status mono";
        await loadRunStatus();
        if (state.pollHandle) clearInterval(state.pollHandle);
        state.pollHandle = setInterval(loadRunStatus, 2500);
      } catch (error) {
        runStatus.textContent = error instanceof Error ? error.message : "Run creation failed.";
        runStatus.className = "status error mono";
      } finally {
        runButton.disabled = false;
      }
    }

    profileFile.addEventListener("change", validateLocalFiles);
    preferencesFile.addEventListener("change", validateLocalFiles);
    runButton.addEventListener("click", startRun);
    refreshButton.addEventListener("click", loadRunStatus);
    loadDatasetMetrics();
  `;

  return renderShell("Fantopy Overview", body, script);
}
