import { renderShell } from "./theme";

export function renderCreateAgentPage(): string {
  const body = `
    <section>
      <div class="eyebrow mono">Run Launcher</div>
      <h1 class="title">Agent Control</h1>
    </section>

    <section class="grid two" style="margin-top:24px">
      <div class="panel">
        <div class="panel-title">
          <strong>Create Agent</strong>
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
          <button id="runButton">Create Agent Instance</button>
          <a class="button secondary" href="/api/templates/user_profile.json" download>Sample Profile</a>
          <a class="button secondary" href="/api/templates/user_preferences.json" download>Sample Preferences</a>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">
          <strong>Run Telemetry</strong>
          <span class="mono muted">Current run only</span>
        </div>
        <div id="runStatus" class="status muted mono">No run started yet.</div>
        <div class="actions" style="margin-top:12px">
          <button id="refreshButton" class="secondary">Refresh Status</button>
          <a class="button tertiary" href="/agents">Deployed Agents</a>
        </div>
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

    async function readJsonFile(file) {
      if (!file) return null;
      return JSON.parse(await file.text());
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
          body: JSON.stringify({ userProfile: state.parsedProfile, userPreferences: state.parsedPreferences })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Run creation failed.");
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
  `;

  return renderShell("Fantopy Agent Control", "create-agent", body, script);
}
