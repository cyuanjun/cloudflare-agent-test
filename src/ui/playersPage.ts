import { renderShell } from "./theme";

export function renderPlayersPage(): string {
  const body = `
    <section>
      <div class="eyebrow mono">Shared Dataset Explorer</div>
      <h1 class="title">Player Data</h1>
      <p class="subtitle">This mirrors the split from your earlier repo: a standard raw player table and a separate derived-features table. Both read from the shared cached dataset, not from per-run artifacts.</p>
    </section>

    <section class="panel" style="margin-top:24px">
      <div class="panel-title">
        <strong>Explorer Controls</strong>
        <span class="pill"><span class="pulse"></span> Dataset Backed</span>
      </div>
      <div class="toolbar">
        <div class="split-tabs">
          <button id="rawTab" class="active">Raw Data</button>
          <button id="featuresTab">Derived Features</button>
        </div>
        <div class="grow">
          <input id="searchInput" type="search" placeholder="Search player or team..." />
        </div>
        <select id="positionFilter" style="max-width:170px">
          <option value="">All Positions</option>
          <option value="GKP">GKP</option>
          <option value="DEF">DEF</option>
          <option value="MID">MID</option>
          <option value="FWD">FWD</option>
        </select>
        <button id="refreshButton" class="secondary">Reload Tables</button>
      </div>
      <div id="status" class="status muted mono" style="margin-top:12px">Loading players and features.</div>
    </section>

    <section class="panel" style="margin-top:24px">
      <div class="panel-title">
        <strong id="tableTitle">Raw Player Data</strong>
        <span id="tableMeta" class="mono muted">Table view</span>
      </div>
      <div class="table-wrap">
        <table id="dataTable">
          <thead id="dataHead"></thead>
          <tbody id="dataBody"></tbody>
        </table>
      </div>
      <div class="scroll-note" id="rowCount">0 rows</div>
    </section>
  `;

  const script = `
    const state = { dataset: null, view: "raw", rawSort: { key: "total_points", order: "desc" }, featureSort: { key: "xGI_per90", order: "desc" } };
    const rawTab = document.getElementById("rawTab");
    const featuresTab = document.getElementById("featuresTab");
    const searchInput = document.getElementById("searchInput");
    const positionFilter = document.getElementById("positionFilter");
    const refreshButton = document.getElementById("refreshButton");
    const status = document.getElementById("status");
    const tableTitle = document.getElementById("tableTitle");
    const tableMeta = document.getElementById("tableMeta");
    const dataHead = document.getElementById("dataHead");
    const dataBody = document.getElementById("dataBody");
    const rowCount = document.getElementById("rowCount");

    const rawColumns = [
      ["position", "Pos"],
      ["web_name", "Name"],
      ["team_name", "Team"],
      ["now_cost", "Price"],
      ["total_points", "Points"],
      ["form", "Form"],
      ["ict_index", "ICT"],
      ["selected_by_percent", "Selected%"],
      ["status", "Status"]
    ];

    const featureColumns = [
      ["position", "Pos"],
      ["name", "Name"],
      ["team_name", "Team"],
      ["price", "Price"],
      ["form_3gw", "Form 3GW"],
      ["rolling_avg_5gw", "Avg 5GW"],
      ["xGI_per90", "xGI/90"],
      ["xG_per90", "xG/90"],
      ["xA_per90", "xA/90"],
      ["points_per_90", "Pts/90"],
      ["starts_rate", "Starts%"],
      ["availability_risk", "Risk"]
    ];

    function fmtNumber(value, digits = 2) {
      return typeof value === "number" ? value.toFixed(digits) : value;
    }

    function enrichFeatures(dataset) {
      const playerById = new Map(dataset.players.map((player) => [player.id, player]));
      return dataset.playerFeatures.map((feature) => {
        const player = playerById.get(feature.player_id);
        return {
          ...feature,
          position: player ? player.position : "-",
          name: player ? player.web_name : String(feature.player_id),
          team_name: player ? player.team_name : String(feature.team_id)
        };
      });
    }

    function activeSort() {
      return state.view === "raw" ? state.rawSort : state.featureSort;
    }

    function setSort(key) {
      const target = state.view === "raw" ? state.rawSort : state.featureSort;
      if (target.key === key) {
        target.order = target.order === "asc" ? "desc" : "asc";
      } else {
        target.key = key;
        target.order = "desc";
      }
      renderTable();
    }

    function comparableValue(row, key) {
      const value = row[key];
      if (key === "form" || key === "ict_index") {
        const parsed = Number.parseFloat(String(value ?? "0"));
        return Number.isNaN(parsed) ? -Infinity : parsed;
      }
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isNaN(parsed) ? value.toLowerCase() : parsed;
      }
      return String(value ?? "").toLowerCase();
    }

    function filteredRows() {
      if (!state.dataset) return [];
      const query = searchInput.value.trim().toLowerCase();
      const position = positionFilter.value;
      const rows = state.view === "raw" ? state.dataset.players : enrichFeatures(state.dataset);
      return rows.filter((row) => {
        const rowPosition = row.position || "";
        const matchesPosition = !position || rowPosition === position;
        const haystack = JSON.stringify([row.web_name || row.name, row.team_name, row.position]).toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        return matchesPosition && matchesQuery;
      }).sort((left, right) => {
        const sort = activeSort();
        const leftValue = comparableValue(left, sort.key);
        const rightValue = comparableValue(right, sort.key);

        let comparison = 0;
        if (typeof leftValue === "number" && typeof rightValue === "number") {
          comparison = leftValue - rightValue;
        } else {
          comparison = String(leftValue).localeCompare(String(rightValue));
        }
        return sort.order === "desc" ? -comparison : comparison;
      });
    }

    function renderTable() {
      const rows = filteredRows();
      const columns = state.view === "raw" ? rawColumns : featureColumns;
      const sort = activeSort();
      tableTitle.textContent = state.view === "raw" ? "Raw Player Data" : "Derived Feature Data";
      tableMeta.textContent = (state.view === "raw" ? "Standard view" : "Feature view") + " • Sorted by " + sort.key + " " + sort.order.toUpperCase();

      dataHead.innerHTML = "<tr>" + columns.map(([key, label]) => {
        const indicator = sort.key === key ? (sort.order === "desc" ? " ↓" : " ↑") : "";
        return "<th data-sort='" + key + "' style='cursor:pointer'>" + label + indicator + "</th>";
      }).join("") + "</tr>";
      dataBody.innerHTML = rows.length === 0
        ? "<tr><td colspan='" + columns.length + "' class='muted mono'>No rows match the current filters.</td></tr>"
        : rows.map((row) => "<tr>" + columns.map(([key]) => {
            const value = row[key];
            if (key === "now_cost" || key === "price") return "<td>£" + fmtNumber(value, 1) + "m</td>";
            if (key === "selected_by_percent") return "<td>" + fmtNumber(value, 1) + "%</td>";
            if (key === "starts_rate") return "<td>" + fmtNumber(value * 100, 0) + "%</td>";
            if (typeof value === "number") return "<td>" + fmtNumber(value, key === "availability_risk" ? 2 : 2) + "</td>";
            return "<td>" + String(value ?? "-") + "</td>";
          }).join("") + "</tr>").join("");

      dataHead.querySelectorAll("th[data-sort]").forEach((header) => {
        header.addEventListener("click", () => setSort(header.getAttribute("data-sort")));
      });

      rowCount.textContent = rows.length + " rows";
    }

    function activateTab(view) {
      state.view = view;
      rawTab.classList.toggle("active", view === "raw");
      featuresTab.classList.toggle("active", view === "features");
      renderTable();
    }

    async function loadDataset() {
      status.textContent = "Loading players and features from the shared dataset.";
      status.className = "status mono";
      try {
        const response = await fetch("/api/data");
        const payload = await response.json();
        if (!response.ok || !payload.dataset) {
          throw new Error(payload.error || "No shared dataset is available yet. Refresh it from the Dataset page first.");
        }
        state.dataset = payload.dataset;
        status.innerHTML = [
          "DATASET VERSION: " + payload.dataset.datasetVersion,
          "REFRESHED AT: " + payload.dataset.refreshedAt,
          "CURRENT GW: " + payload.dataset.currentGameweek,
          "PLAYER COUNT: " + payload.dataset.playerCount
        ].join("<br>");
        status.className = "status live mono";
        renderTable();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Failed to load shared dataset.";
        status.className = "status error mono";
        dataHead.innerHTML = "";
        dataBody.innerHTML = "";
        rowCount.textContent = "0 rows";
      }
    }

    rawTab.addEventListener("click", () => activateTab("raw"));
    featuresTab.addEventListener("click", () => activateTab("features"));
    searchInput.addEventListener("input", renderTable);
    positionFilter.addEventListener("change", renderTable);
    refreshButton.addEventListener("click", loadDataset);
    loadDataset();
  `;

  return renderShell("Fantopy Player Data", "player-data", body, script);
}
