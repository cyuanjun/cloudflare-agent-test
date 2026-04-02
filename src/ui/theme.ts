export function renderShell(title: string, activeNav: "overview" | "load-dataset" | "player-data" | "create-agent" | "deployed-agents", body: string, script: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        --black: #0a0a0a;
        --surface: #111111;
        --surface-2: #151515;
        --border: #1e1e1e;
        --border-light: #2a2a2a;
        --accent: #00d4aa;
        --accent-dim: rgba(0, 212, 170, 0.12);
        --green: #22c55e;
        --red: #ef4444;
        --yellow: #eab308;
        --blue: #3b82f6;
        --text: #ffffff;
        --text-dim: #999999;
        --muted: #555555;
      }
      * { box-sizing: border-box; border-radius: 0 !important; }
      body {
        margin: 0;
        color: var(--text);
        background: var(--black);
        font-family: "DM Sans", Inter, system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 24px 24px;
        opacity: 0.75;
      }
      .nav {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 56px;
        padding: 0 24px;
        border-bottom: 1px solid var(--border);
        background: rgba(10, 10, 10, 0.94);
        backdrop-filter: blur(10px);
      }
      .brand {
        margin-right: 18px;
        color: var(--accent);
        font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .nav-link {
        display: inline-flex;
        align-items: center;
        height: 32px;
        padding: 0 12px;
        border: 1px solid var(--border);
        color: var(--text-dim);
        text-decoration: none;
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .nav-link.active {
        color: var(--accent);
        border-color: var(--accent);
        background: var(--accent-dim);
      }
      main {
        max-width: 1380px;
        margin: 0 auto;
        padding: 32px 24px 56px;
        position: relative;
        z-index: 1;
      }
      .eyebrow {
        color: var(--accent);
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      h1, h2, h3 {
        margin: 0;
      }
      .title {
        margin-top: 10px;
        font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
        font-size: clamp(40px, 7vw, 76px);
        font-weight: 800;
        line-height: 0.95;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .subtitle {
        max-width: 780px;
        margin-top: 14px;
        color: var(--text-dim);
        line-height: 1.7;
      }
      .grid {
        display: grid;
        gap: 18px;
      }
      .grid.two {
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
      }
      .grid.three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .panel {
        background: linear-gradient(180deg, rgba(17,17,17,0.98), rgba(12,12,12,0.98));
        border: 1px solid var(--border);
        padding: 18px;
      }
      .panel-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .panel-title strong {
        font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
        font-size: 24px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .mono {
        font-family: "IBM Plex Mono", Consolas, monospace;
      }
      .muted {
        color: var(--text-dim);
      }
      .metric-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .metric {
        border: 1px solid var(--border);
        background: var(--surface);
        padding: 14px;
      }
      .metric-label {
        color: var(--muted);
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .metric-value {
        margin-top: 8px;
        font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
        font-size: 30px;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      button, .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 0 16px;
        border: 1px solid var(--accent);
        background: var(--accent);
        color: var(--black);
        cursor: pointer;
        text-decoration: none;
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      button.secondary, .button.secondary {
        background: transparent;
        color: var(--accent);
      }
      button.tertiary, .button.tertiary {
        background: transparent;
        border-color: var(--border-light);
        color: var(--text-dim);
      }
      input[type="file"], input[type="search"], select {
        width: 100%;
        min-height: 38px;
        padding: 0 12px;
        border: 1px solid var(--border-light);
        background: var(--surface);
        color: var(--text);
      }
      .status {
        border: 1px solid var(--border);
        background: var(--surface);
        padding: 12px;
        min-height: 64px;
      }
      .status.error { color: var(--red); }
      .status.live {
        color: var(--accent);
        background: var(--accent-dim);
        border-color: rgba(0, 212, 170, 0.4);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid var(--border);
        background: var(--surface);
      }
      th, td {
        padding: 10px 12px;
        border-bottom: 1px solid var(--border);
        text-align: left;
        font-size: 13px;
        white-space: nowrap;
      }
      th {
        background: rgba(255,255,255,0.02);
        color: var(--text);
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      tbody tr:nth-child(even) { background: var(--surface-2); }
      .table-wrap {
        overflow: auto;
        border: 1px solid var(--border);
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 24px;
        padding: 0 10px;
        border: 1px solid rgba(0, 212, 170, 0.3);
        background: rgba(0, 212, 170, 0.09);
        color: var(--accent);
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .pulse {
        width: 6px;
        height: 6px;
        background: var(--green);
        border-radius: 50% !important;
        animation: pulse-dot 2s ease-in-out infinite;
      }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }
      .toolbar .grow {
        flex: 1 1 240px;
      }
      .split-tabs {
        display: inline-flex;
        border: 1px solid var(--border);
      }
      .split-tabs button {
        min-width: 120px;
        border: 0;
        border-right: 1px solid var(--border);
        background: transparent;
        color: var(--text-dim);
      }
      .split-tabs button:last-child { border-right: 0; }
      .split-tabs button.active {
        background: var(--accent-dim);
        color: var(--accent);
      }
      .scroll-note {
        margin-top: 8px;
        color: var(--muted);
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      pre {
        margin: 0;
        padding: 14px;
        overflow: auto;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-dim);
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 12px;
        line-height: 1.6;
      }
      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.2; }
      }
      @media (max-width: 980px) {
        .grid.two, .grid.three, .metric-strip { grid-template-columns: 1fr; }
        main { padding: 24px 16px 40px; }
      }
    </style>
  </head>
  <body>
    <nav class="nav">
      <span class="brand">Fantopy</span>
      <a class="nav-link${activeNav === "overview" ? " active" : ""}" href="/">Overview</a>
      <a class="nav-link${activeNav === "load-dataset" ? " active" : ""}" href="/data">Load Dataset</a>
      <a class="nav-link${activeNav === "player-data" ? " active" : ""}" href="/players">Player Data</a>
      <a class="nav-link${activeNav === "create-agent" ? " active" : ""}" href="/create-agent">Create Agent</a>
      <a class="nav-link${activeNav === "deployed-agents" ? " active" : ""}" href="/agents">Deployed Agents</a>
    </nav>
    <main>${body}</main>
    <script type="module">${script}</script>
  </body>
</html>`;
}
