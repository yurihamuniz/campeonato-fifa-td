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

// Ordem oficial das fases no bracket (13 participantes — Time M tem bye)
const PHASES = [
  { id: "primeira",        match_ids: ["J1","J2","J3","J4","J5","J6"] },
  { id: "repescagem_f1",   match_ids: ["RP1","RP2","RP3"] },
  { id: "repescagem_f2",   match_ids: ["RF1"] },
  { id: "repescagem_final",match_ids: ["FR"] },
  { id: "quartas",         match_ids: ["QF1","QF2","QF3","QF4"] },
  { id: "semis",           match_ids: ["SF1","SF2"] },
  { id: "final",           match_ids: ["FINAL"] },
];

// Mapa de clubes → arquivo do escudo em assets/clubs/<slug>.png
// O nome canônico (chave) deve ser usado nas colunas clube1/clube2 da planilha.
const CLUBS = {
  "Real Madrid":         "real-madrid",
  "Barcelona":           "barcelona",
  "PSG":                 "psg",
  "Bayern de Munique":   "bayern",
  "Liverpool":           "liverpool",
  "Arsenal":             "arsenal",
  "Manchester City":     "man-city",
  "Inter de Milão":      "inter",
  "Atlético de Madrid":  "atletico",
  "Napoli":              "napoli",
  "Borussia Dortmund":   "dortmund",
  "Milan":               "milan",
  "Newcastle United":    "newcastle",
  "Tottenham":           "tottenham",
  "Juventus":            "juventus",
  "RB Leipzig":          "leipzig",
  "Bayer Leverkusen":    "leverkusen",
  "Chelsea":             "chelsea",
  "Manchester United":   "man-united",
  "Galatasaray":         "galatasaray",
};

// Tolera variações de grafia/acentuação (PSG, psg, "Atletico Madrid", etc)
const _normalizeClub = s => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const CLUBS_NORM = Object.fromEntries(
  Object.entries(CLUBS).map(([name, slug]) => [_normalizeClub(name), slug])
);

function clubCrestURL(clubeName) {
  if (!clubeName) return null;
  const slug = CLUBS_NORM[_normalizeClub(clubeName)];
  return slug ? `assets/clubs/${slug}.png` : null;
}

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

  // Vencedor: manual override (coluna "vencedor" = 1 ou 2) tem prioridade,
  // útil em caso de empate decidido por pênaltis / decisão.
  // Se não houver override, detecta pelo placar.
  let winner = null;
  const manualWinner = String(row.vencedor || "").trim();
  if (manualWinner === "1") winner = 1;
  else if (manualWinner === "2") winner = 2;
  else if (status === "finalizado" && p1 != null && p2 != null) {
    if (p1 > p2) winner = 1;
    else if (p2 > p1) winner = 2;
    // empate sem override = sem vencedor definido (saldo 0, mas ninguém avança)
  }

  const isTie = p1 != null && p2 != null && p1 === p2 && winner != null;

  // Aceita os schemas antigo (time1/time2) e novo (jogador1/jogador2 + clube1/clube2)
  return {
    id: row.jogo_id,
    phase: (row.fase || "").toLowerCase(),
    player1: row.jogador1 || row.time1 || "",
    player2: row.jogador2 || row.time2 || "",
    club1:   row.clube1 || "",
    club2:   row.clube2 || "",
    score1: p1,
    score2: p2,
    status,
    winner,
    isTie,
  };
}

function computeLosersRanking(matches) {
  const primeira = matches.filter(m => m.phase === "primeira" && m.status === "finalizado" && m.winner);
  const losers = primeira.map(m => {
    const loserIsP1 = m.winner === 2;
    const name = loserIsP1 ? m.player1 : m.player2;
    const club = loserIsP1 ? m.club1 : m.club2;
    const scoreFor = loserIsP1 ? m.score1 : m.score2;
    const scoreAgainst = loserIsP1 ? m.score2 : m.score1;
    return {
      name,
      club,
      saldo: scoreFor - scoreAgainst,
      feitos: scoreFor,
      sourceMatch: m.id,
    };
  });
  return rankBySaldo(losers);
}

// Ranking dos 3 vencedores da Repescagem F1 (RP1, RP2, RP3)
// Mesmo critério: saldo → gols feitos → ordem (RP1 < RP2 < RP3 em caso de empate).
function computeRepescagemWinnersRanking(matches) {
  const rpMatches = ["RP1","RP2","RP3"]
    .map(id => matches.find(m => m.id === id))
    .filter(m => m && m.status === "finalizado" && m.winner);
  const winners = rpMatches.map(m => {
    const winnerIsP1 = m.winner === 1;
    const name = winnerIsP1 ? m.player1 : m.player2;
    const club = winnerIsP1 ? m.club1 : m.club2;
    const scoreFor = winnerIsP1 ? m.score1 : m.score2;
    const scoreAgainst = winnerIsP1 ? m.score2 : m.score1;
    return {
      name,
      club,
      saldo: scoreFor - scoreAgainst,
      feitos: scoreFor,
      sourceMatch: m.id,
    };
  });
  return rankBySaldo(winners);
}

function rankBySaldo(items) {
  return items
    .map((it, idx) => ({ ...it, _idx: idx }))
    .sort((a, b) => {
      if (b.saldo !== a.saldo) return b.saldo - a.saldo;
      if (b.feitos !== a.feitos) return b.feitos - a.feitos;
      return a._idx - b._idx;
    });
}

// ============================================================
// AUTO-PROPAGAÇÃO ENTRE FASES (13 participantes — Time M tem bye)
// ============================================================
// Regras determinísticas que o JS preenche sozinho. Valores
// manualmente preenchidos têm prioridade — só auto-preenche se a
// célula correspondente estiver vazia.
//
// Repescagem F1 (todos os 6 derrotados, pareados melhor × pior):
//   RP1 = 1º melhor derrotado × 6º melhor derrotado
//   RP2 = 2º melhor × 5º melhor
//   RP3 = 3º melhor × 4º melhor
//
// Repescagem F2 (3 vencedores da F1 ranqueados por saldo):
//   RF1 = 2º melhor vencedor F1 × 3º melhor vencedor F1
//   (o 1º melhor vencedor F1 vai direto pra Final da Repescagem)
//
// Final da Repescagem:
//   FR = 1º melhor vencedor F1 × vencedor RF1
//
// Quartas:
//   QF1.jogador2 = vencedor FR (Time M em QF1.jogador1 é manual)
//   QF2, QF3, QF4: manuais (sorteio entre os 6 vencedores da 1ª fase)
//
// Semis: SF1 = QF1 × QF2, SF2 = QF3 × QF4
// Final: vencedor SF1 × vencedor SF2
function winnerSide(m) {
  if (!m || m.status !== "finalizado" || !m.winner) return null;
  return m.winner === 1
    ? { player: m.player1, club: m.club1 }
    : { player: m.player2, club: m.club2 };
}

function fillSide(match, side, source) {
  if (!match || !source || !source.player) return;
  if (side === 1) {
    if (!match.player1) { match.player1 = source.player; match.player1Auto = true; }
    if (!match.club1)   match.club1   = source.club || "";
  } else {
    if (!match.player2) { match.player2 = source.player; match.player2Auto = true; }
    if (!match.club2)   match.club2   = source.club || "";
  }
}

function deriveMatches(matches, losers, repWinners) {
  const byId = Object.fromEntries(matches.map(m => [m.id, m]));

  // Repescagem F1: precisa dos 6 derrotados ranqueados (best × worst)
  if (losers.length === 6) {
    const asSrc = i => ({ player: losers[i].name, club: losers[i].club });
    fillSide(byId.RP1, 1, asSrc(0)); // 1º melhor
    fillSide(byId.RP1, 2, asSrc(5)); // 6º
    fillSide(byId.RP2, 1, asSrc(1)); // 2º
    fillSide(byId.RP2, 2, asSrc(4)); // 5º
    fillSide(byId.RP3, 1, asSrc(2)); // 3º
    fillSide(byId.RP3, 2, asSrc(3)); // 4º
  }

  // Repescagem F2 (RF1) e Final da Repescagem (FR):
  // precisam dos 3 vencedores da F1 ranqueados
  if (repWinners.length === 3) {
    const asSrc = i => ({ player: repWinners[i].name, club: repWinners[i].club });
    // RF1 = 2º melhor × 3º melhor vencedor F1
    fillSide(byId.RF1, 1, asSrc(1));
    fillSide(byId.RF1, 2, asSrc(2));
    // FR = 1º melhor vencedor F1 × vencedor RF1
    fillSide(byId.FR, 1, asSrc(0));
  }
  // FR.jogador2 = vencedor de RF1 (mesmo se repWinners ainda não estiver completo,
  // se RF1 for finalizado o vencedor já está definido)
  fillSide(byId.FR, 2, winnerSide(byId.RF1));

  // Quartas — apenas QF1.jogador2 (Time M em QF1.jogador1 é manual)
  fillSide(byId.QF1, 2, winnerSide(byId.FR));

  // Semis
  fillSide(byId.SF1, 1, winnerSide(byId.QF1));
  fillSide(byId.SF1, 2, winnerSide(byId.QF2));
  fillSide(byId.SF2, 1, winnerSide(byId.QF3));
  fillSide(byId.SF2, 2, winnerSide(byId.QF4));

  // Final
  fillSide(byId.FINAL, 1, winnerSide(byId.SF1));
  fillSide(byId.FINAL, 2, winnerSide(byId.SF2));

  return matches;
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
        id: matchId, phase: phase.id, player1: "", player2: "",
        club1: "", club2: "",
        score1: null, score2: null, status: "a_definir", winner: null,
      };
      container.appendChild(renderMatch(m, tpl));
    }
  }
}

function applyTeamSide(sideEl, playerName, clubName, isAuto) {
  sideEl.querySelector(".team-name").textContent = playerName || "a definir";
  const info = sideEl.querySelector(".team-info");
  info.classList.toggle("auto-derived", !!isAuto && !!playerName);
  const img = sideEl.querySelector(".club-crest");
  const url = clubCrestURL(clubName);
  if (url) {
    img.src = url;
    img.alt = clubName;
    img.hidden = false;
  } else {
    img.hidden = true;
    img.removeAttribute("src");
    img.alt = "";
  }
}

function renderMatch(m, tpl) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.status = m.status;
  node.dataset.matchId = m.id;
  if (m.isTie) node.dataset.tie = "true";
  node.querySelector(".match-id").textContent = m.id;
  const statusLabel = m.isTie && m.status === "finalizado"
    ? "finalizado · decisão"
    : (STATUS_LABEL[m.status] || m.status);
  node.querySelector(".match-status").textContent = statusLabel;

  const t1 = node.querySelector(".team-1");
  const t2 = node.querySelector(".team-2");

  applyTeamSide(t1, m.player1, m.club1, m.player1Auto);
  applyTeamSide(t2, m.player2, m.club2, m.player2Auto);
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
    const crest = clubCrestURL(l.club);
    const crestHTML = crest
      ? `<img class="club-crest crest-sm" src="${crest}" alt="${escapeHTML(l.club)}">`
      : `<span class="crest-sm crest-placeholder"></span>`;
    li.innerHTML = `
      ${crestHTML}
      <span class="name">${escapeHTML(l.name || "—")}</span>
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
    const losers = computeLosersRanking(matches);
    const repWinners = computeRepescagemWinnersRanking(matches);
    deriveMatches(matches, losers, repWinners);
    renderBracket(matches);
    renderRanking(losers);
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
