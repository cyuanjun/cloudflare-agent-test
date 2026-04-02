import { renderShell } from "./theme";

export function renderDataPage(): string {
  const body = `
    <section>
      <div class="eyebrow mono">Shared Objective Layer</div>
      <h1 class="title">Dataset Control Room</h1>
      <p class="subtitle">This is the backend-style shared data layer from your earlier repo, collapsed into Cloudflare. Refresh it here, inspect dataset health, and preview the stored derived artifact that all user runs consume.</p>
    </section>

    <section class="grid two" style="margin-top:24px">
      <div class="panel">
        <div class="panel-title">
          <strong>Refresh Control</strong>
          <span class="pill"><span class="pulse"></span> Shared Cache</span>
        </div>
        <div class="actions">
          <button id="refreshButton">Refresh Shared Dataset</button>
          <a class="button secondary" href="/players">Open Players</a>
          <a class="button tertiary" href="/">Back To Overview</a>
        </div>
        <div id="status" class="status muted mono" style="margin-top:12px">Loading dataset metadata.</div>
      </div>

      <div class="panel">
        <div class="panel-title">
          <strong>Dataset Snapshot</strong>
          <span class="mono muted">Meta only</span>
        </div>
        <div class="metric-strip">
          <div class="metric"><div class="metric-label">Available</div><div class="metric-value" id="mAvailable">-</div></div>
          <div class="metric"><div class="metric-label">Current GW</div><div class="metric-value" id="mGw">-</div></div>
          <div class="metric"><div class="metric-label">Players</div><div class="metric-value" id="mPlayers">-</div></div>
          <div class="metric"><div class="metric-label">Version</div><div class="metric-value" id="mVersion">-</div></div>
        </div>
      </div>
    </section>

    <section class="panel" style="margin-top:24px">
      <div class="panel-title">
        <strong>Stored Dataset Preview</strong>
        <span class="mono muted">JSON excerpt</span>
      </div>
      <pre id="preview">No dataset loaded yet.</pre>
    </section>
  `;

  const script = `
    const status = document.getElementById("status");
    const preview = document.getElementById("preview");
    const refreshButton = document.getElementById("refreshButton");

    function setMetrics(payload) {
      document.getElementById("mAvailable").textContent = payload.available ? "YES" : "NO";
      document.getElementById("mGw").textContent = payload.currentGameweek ?? "-";
      document.getElementById("mPlayers").textContent = payload.playerCount ?? "-";
      document.getElementById("mVersion").textContent = payload.datasetVersion ? payload.datasetVersion.slice(11, 19) : "-";
    }

    async function loadMeta() {
      const response = await fetch("/api/data");
      const payload = await response.json();
      if (!response.ok) {
        status.textContent = payload.error || "Failed to load dataset metadata.";
        status.className = "status error mono";
        preview.textContent = "";
        return;
      }

      setMetrics(payload);
      status.innerHTML = [
        "AVAILABLE: " + payload.available,
        "DATASET VERSION: " + (payload.datasetVersion || "-"),
        "REFRESHED AT: " + (payload.refreshedAt || "-"),
        "CURRENT GW: " + (payload.currentGameweek ?? "-"),
        "PLAYER COUNT: " + payload.playerCount
      ].join("<br>");
      status.className = payload.available ? "status live mono" : "status mono";

      const excerpt = payload.dataset ? {
        datasetVersion: payload.dataset.datasetVersion,
        refreshedAt: payload.dataset.refreshedAt,
        currentGameweek: payload.dataset.currentGameweek,
        playerCount: payload.dataset.playerCount,
        firstPlayers: payload.dataset.players.slice(0, 3),
        firstFeatures: payload.dataset.playerFeatures.slice(0, 3),
        firstFixtureSummary: payload.dataset.fixtureDifficultySummary.slice(0, 3)
      } : null;

      preview.textContent = JSON.stringify(excerpt, null, 2);
    }

    async function refreshDataset() {
      refreshButton.disabled = true;
      status.textContent = "Refreshing shared dataset. This may take a bit.";
      status.className = "status mono";
      try {
        const response = await fetch("/api/data/refresh", { method: "POST" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Refresh failed.");
        }
        await loadMeta();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Refresh failed.";
        status.className = "status error mono";
      } finally {
        refreshButton.disabled = false;
      }
    }

    refreshButton.addEventListener("click", refreshDataset);
    loadMeta();
  `;

  return renderShell("Fantopy Dataset", body, script);
}
