// ============================================================
// CONFIGURAÇÃO
// ============================================================
// Cole aqui a URL da planilha Google publicada como CSV.
// Como gerar: Arquivo > Compartilhar > Publicar na web > formato CSV > publicar.
// A URL fica no formato: https://docs.google.com/spreadsheets/d/e/<id>/pub?output=csv
//
// Enquanto a planilha não estiver pronta, deixe vazio para usar o sample.csv local.
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjVVtDYXYTcfy2tevgpRII-NUmBMiVQ5-nZ0_9atvNjeu6ts8B418Vkc1iqCc_MxgsR29_ev8gQ-6R/pub?gid=0&single=true&output=csv";
const REFRESH_INTERVAL_MS = 20_000;
const FALLBACK_CSV_URL = "sample.csv";

// Ordem oficial das fases no bracket
const PHASES = [
  { id: "primeira",        match_ids: ["J1","J2","J3","J4","J5","J6"] },
  { id: "repescagem_f1",   match_ids: ["RP1","RP2"] },
  { id: "repescagem_final",match_ids: ["RF1","RF2"] },
  { id: "quartas",         match_ids: ["QF1","QF2","QF3","QF4"] },
  { id: "semis",           match_ids: ["SF1","SF2"] },
  { id: "final",           match_ids: ["FINAL"] },
];

// ============================================================
// FETCH + PARSE
// ============================================================
async function loadData() {
  const url = SHEET_CSV_URL || FALLBACK_CSV_URL;
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}_t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (!lines.length) return [];
  const header = splitLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = splitLine(line);
    const obj = {};
    header.forEach((h, i) => { obj[h] = (cells[i] ?? "").trim(); });
    return obj;
  });
}

// CSV split that handles quoted cells with commas
function splitLine(line) {
  const out = [];
  let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === "," && !inQuote) {
      out.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// ============================================================
// MODELO
// ============================================================
function buildMatch(row) {
  const p1 = row.placar1 === "" ? null : Number(row.placar1);
  const p2 = row.placar2 === "" ? null : Number(row.placar2);
  const status = (row.status || "a_definir").toLowerCase();
  let winner = null;
  if (status === "finalizado" && p1 != null && p2 != null) {
    if (p1 > p2) winner = 1;
    else if (p2 > p1) winner = 2;
  }
  return {
    id: row.jogo_id,
    phase: (row.fase || "").toLowerCase(),
    team1: row.time1 || "",
    team2: row.time2 || "",
    score1: p1,
    score2: p2,
    status,
    winner,
  };
}

function computeLosersRanking(matches) {
  const primeira = matches.filter(m => m.phase === "primeira" && m.status === "finalizado" && m.winner);
  const losers = primeira.map(m => {
    const loserIsTeam1 = m.winner === 2;
    const name = loserIsTeam1 ? m.team1 : m.team2;
    const scoreFor = loserIsTeam1 ? m.score1 : m.score2;
    const scoreAgainst = loserIsTeam1 ? m.score2 : m.score1;
    return {
      name,
      saldo: scoreFor - scoreAgainst,
      feitos: scoreFor,
      sourceMatch: m.id,
    };
  });
  // Desempate: saldo (desc) → gols feitos (desc) → ordem original (asc)
  return losers
    .map((l, idx) => ({ ...l, _idx: idx }))
    .sort((a, b) => {
      if (b.saldo !== a.saldo) return b.saldo - a.saldo;
      if (b.feitos !== a.feitos) return b.feitos - a.feitos;
      return a._idx - b._idx;
    });
}

// ============================================================
// RENDER
// ============================================================
const STATUS_LABEL = {
  a_definir: "a definir",
  ao_vivo: "ao vivo",
  finalizado: "finalizado",
};

function renderBracket(matches) {
  const byId = Object.fromEntries(matches.map(m => [m.id, m]));
  const tpl = document.getElementById("match-template");

  for (const phase of PHASES) {
    const container = document.getElementById(`matches-${phase.id}`);
    container.innerHTML = "";
    for (const matchId of phase.match_ids) {
      const m = byId[matchId] || {
        id: matchId, phase: phase.id, team1: "", team2: "",
        score1: null, score2: null, status: "a_definir", winner: null,
      };
      container.appendChild(renderMatch(m, tpl));
    }
  }
}

function renderMatch(m, tpl) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.status = m.status;
  node.dataset.matchId = m.id;
  node.querySelector(".match-id").textContent = m.id;
  node.querySelector(".match-status").textContent = STATUS_LABEL[m.status] || m.status;

  const t1 = node.querySelector(".team-1");
  const t2 = node.querySelector(".team-2");

  t1.querySelector(".team-name").textContent = m.team1 || "a definir";
  t2.querySelector(".team-name").textContent = m.team2 || "a definir";
  t1.querySelector(".team-score").textContent = m.score1 != null ? m.score1 : "–";
  t2.querySelector(".team-score").textContent = m.score2 != null ? m.score2 : "–";

  if (m.status === "finalizado" && m.winner) {
    (m.winner === 1 ? t1 : t2).classList.add("winner");
    (m.winner === 1 ? t2 : t1).classList.add("loser");
  }
  return node;
}

function renderRanking(losers) {
  const ol = document.getElementById("ranking-derrotados");
  ol.innerHTML = "";
  if (!losers.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Aguardando jogos da 1ª fase…";
    ol.appendChild(li);
    return;
  }
  for (const l of losers) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="name">${escapeHTML(l.name)}</span>
      <span class="stat">saldo ${l.saldo >= 0 ? "+" : ""}${l.saldo}</span>
      <span class="stat">${l.feitos} GP</span>
    `;
    ol.appendChild(li);
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ============================================================
// CICLO PRINCIPAL
// ============================================================
async function refresh() {
  const lastUpdate = document.getElementById("last-update");
  try {
    const rows = await loadData();
    const matches = rows.filter(r => r.jogo_id).map(buildMatch);
    renderBracket(matches);
    renderRanking(computeLosersRanking(matches));
    const now = new Date();
    lastUpdate.textContent = `atualizado ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch (err) {
    console.error("[bracket] falha ao carregar:", err);
    lastUpdate.textContent = "erro ao atualizar — verifique a planilha";
  }
}

document.getElementById("refresh-now").addEventListener("click", e => {
  e.preventDefault();
  refresh();
});

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
