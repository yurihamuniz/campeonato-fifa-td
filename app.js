// ============================================================
// CAMPEONATO FIFA TD — Fase de grupos + mata-mata (14 participantes)
// ============================================================
// A página lê uma planilha Google publicada como CSV. Há dois tipos
// de linha (coluna "tipo"):
//   participante → posicao(id), nome, clube
//   jogo         → id, grupo, pos1, pos2, placar1, placar2, vencedor, status
//
// Fase de grupos: 2 grupos de 7 (A = posições ímpares, B = pares).
// Cada um joga 4 partidas. A classificação é calculada (Pts → saldo →
// gols → confronto direto → posição do sorteio).
// Mata-mata: semeado automaticamente da classificação (configurável).
// ============================================================

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjVVtDYXYTcfy2tevgpRII-NUmBMiVQ5-nZ0_9atvNjeu6ts8B418Vkc1iqCc_MxgsR29_ev8gQ-6R/pub?gid=278622039&single=true&output=csv";
const REFRESH_INTERVAL_MS = 20_000;
const FALLBACK_CSV_URL = "sample.csv";

// Semeia o mata-mata a partir da classificação calculada.
// Se false, os confrontos do mata-mata vêm só do que estiver na planilha
// (colunas pos1/pos2 das linhas QF/SF/etc).
const SEED_KNOCKOUT_FROM_STANDINGS = true;

// ============================================================
// CHAVEAMENTO FIXO DA FASE DE GRUPOS (por posição do sorteio)
// ============================================================
const GROUP_FIXTURES = {
  // Grupo A — posições ímpares 1,3,5,7,9,11,13
  GA1: [1, 3],  GA2: [1, 5],  GA3: [1, 7],  GA4: [1, 11],
  GA5: [3, 5],  GA6: [3, 7],  GA7: [3, 13], GA8: [5, 9],
  GA9: [5, 13], GA10:[7, 9],  GA11:[7, 11], GA12:[9, 11],
  GA13:[9, 13], GA14:[11, 13],
  // Grupo B — posições pares 2,4,6,8,10,12,14
  GB1: [2, 4],  GB2: [2, 6],  GB3: [2, 8],  GB4: [2, 12],
  GB5: [4, 6],  GB6: [4, 8],  GB7: [4, 14], GB8: [6, 10],
  GB9: [6, 14], GB10:[8, 10], GB11:[8, 12], GB12:[10, 12],
  GB13:[10, 14],GB14:[12, 14],
};
const GROUP_A_IDS = Object.keys(GROUP_FIXTURES).filter(id => id.startsWith("GA"));
const GROUP_B_IDS = Object.keys(GROUP_FIXTURES).filter(id => id.startsWith("GB"));

const KNOCKOUT_META = {
  QF1: { label: "QF1", phase: "quartas" },
  QF2: { label: "QF2", phase: "quartas" },
  QF3: { label: "QF3", phase: "quartas" },
  QF4: { label: "QF4", phase: "quartas" },
  SF1: { label: "Semi 1", phase: "semis" },
  SF2: { label: "Semi 2", phase: "semis" },
  TER: { label: "3º lugar", phase: "terceiro" },
  FINAL: { label: "Final", phase: "final" },
};

// ============================================================
// ESCUDOS
// ============================================================
const CLUBS = {
  "Real Madrid":"real-madrid","Barcelona":"barcelona","PSG":"psg",
  "Bayern de Munique":"bayern","Liverpool":"liverpool","Arsenal":"arsenal",
  "Manchester City":"man-city","Inter de Milão":"inter",
  "Atlético de Madrid":"atletico","Napoli":"napoli","Borussia Dortmund":"dortmund",
  "Milan":"milan","Newcastle United":"newcastle","Tottenham":"tottenham",
  "Juventus":"juventus","RB Leipzig":"leipzig","Bayer Leverkusen":"leverkusen",
  "Chelsea":"chelsea","Manchester United":"man-united","Galatasaray":"galatasaray",
};
// Seleções/países (nome PT-BR → código ISO para a bandeira via flagcdn.com)
const COUNTRIES = {
  "Brasil":"br","Argentina":"ar","França":"fr","Espanha":"es","Portugal":"pt",
  "Alemanha":"de","Inglaterra":"gb-eng","Itália":"it","Holanda":"nl","Países Baixos":"nl",
  "Bélgica":"be","Croácia":"hr","Uruguai":"uy","Colômbia":"co","México":"mx",
  "Estados Unidos":"us","Japão":"jp","Coreia do Sul":"kr","Marrocos":"ma","Senegal":"sn",
  "Gana":"gh","Nigéria":"ng","Camarões":"cm","Egito":"eg","Costa do Marfim":"ci",
  "Suíça":"ch","Dinamarca":"dk","Suécia":"se","Noruega":"no","Polônia":"pl",
  "Sérvia":"rs","Áustria":"at","Ucrânia":"ua","País de Gales":"gb-wls","Escócia":"gb-sct",
  "Equador":"ec","Peru":"pe","Chile":"cl","Paraguai":"py","Bolívia":"bo","Venezuela":"ve",
  "Canadá":"ca","Austrália":"au","Catar":"qa","Qatar":"qa","Arábia Saudita":"sa",
  "Irã":"ir","Iraque":"iq","Turquia":"tr","Grécia":"gr","República Tcheca":"cz","Tchéquia":"cz",
  "Hungria":"hu","Rússia":"ru","Romênia":"ro","Irlanda":"ie","Eslováquia":"sk","Eslovênia":"si",
  "Tunísia":"tn","Argélia":"dz","África do Sul":"za","Jamaica":"jm","Costa Rica":"cr",
  "Panamá":"pa","Honduras":"hn","Nova Zelândia":"nz","China":"cn","Índia":"in",
};

const _norm = s => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const CLUBS_NORM = Object.fromEntries(Object.entries(CLUBS).map(([n,s]) => [_norm(n), s]));
const COUNTRIES_NORM = Object.fromEntries(Object.entries(COUNTRIES).map(([n,c]) => [_norm(n), c]));

// Aceita clube (escudo local) ou seleção/país (bandeira do flagcdn).
function clubCrestURL(name) {
  if (!name) return null;
  const key = _norm(name);
  if (CLUBS_NORM[key]) return `assets/clubs/${CLUBS_NORM[key]}.png`;
  if (COUNTRIES_NORM[key]) return `https://flagcdn.com/w80/${COUNTRIES_NORM[key]}.png`;
  return null;
}

// ============================================================
// FETCH + PARSE CSV
// ============================================================
async function loadData() {
  const url = SHEET_CSV_URL || FALLBACK_CSV_URL;
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}_t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseCSV(await res.text());
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
function splitLine(line) {
  const out = []; let cur = "", inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === "," && !inQuote) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}

const num = v => (v === "" || v == null) ? null : Number(v);

// ============================================================
// MODELO
// ============================================================
// Retorna { participants: {pos: {pos,nome,clube,grupo}}, gamesById: {id: rawGame} }
function buildModel(rows) {
  const participants = {};
  const gamesById = {};

  for (const r of rows) {
    const tipo = (r.tipo || "").toLowerCase();
    if (tipo === "participante") {
      const pos = num(r.id ?? r.posicao);
      if (pos == null) continue;
      participants[pos] = {
        pos,
        nome: r.nome || "",
        clube: r.clube || "",
        grupo: (r.grupo || (pos % 2 === 1 ? "A" : "B")).toUpperCase(),
      };
    } else if (tipo === "jogo" || !tipo) {
      // aceita linhas sem tipo desde que tenham id (compat)
      const id = (r.id || r.jogo_id || "").trim();
      if (!id) continue;
      gamesById[id] = {
        id,
        grupo: (r.grupo || "").toUpperCase(),
        pos1: num(r.pos1),
        pos2: num(r.pos2),
        score1: num(r.placar1),
        score2: num(r.placar2),
        vencedorManual: String(r.vencedor || "").trim(),
        status: (r.status || "a_definir").toLowerCase(),
      };
    }
  }
  return { participants, gamesById };
}

function participantSide(participants, pos) {
  const p = pos != null ? participants[pos] : null;
  return p ? { nome: p.nome, clube: p.clube } : null;
}

// Constrói os objetos de jogo da fase de grupos a partir do fixture fixo.
function buildGroupGames(participants, gamesById) {
  const make = (ids) => ids.map(id => {
    const raw = gamesById[id] || {};
    const [defA, defB] = GROUP_FIXTURES[id];
    const pos1 = raw.pos1 ?? defA;
    const pos2 = raw.pos2 ?? defB;
    return normalizeGameObject({
      id, displayId: id, phase: "grupos",
      grupo: id.startsWith("GA") ? "A" : "B",
      s1: participantSide(participants, pos1),
      s2: participantSide(participants, pos2),
      pos1, pos2,
      score1: raw.score1 ?? null,
      score2: raw.score2 ?? null,
      vencedorManual: raw.vencedorManual || "",
      status: raw.status || "a_definir",
      groupGame: true,
    });
  });
  return { A: make(GROUP_A_IDS), B: make(GROUP_B_IDS) };
}

// Calcula vencedor (1/2/null). Em grupos, empate é válido (winner=null).
// Fora de grupos, usa override "vencedor" e não permite empate sem decisão.
function normalizeGameObject(g) {
  let winner = null;
  if (!g.groupGame && g.vencedorManual === "1") winner = 1;
  else if (!g.groupGame && g.vencedorManual === "2") winner = 2;
  else if (g.status === "finalizado" && g.score1 != null && g.score2 != null) {
    if (g.score1 > g.score2) winner = 1;
    else if (g.score2 > g.score1) winner = 2;
  }
  const isTie = g.score1 != null && g.score2 != null && g.score1 === g.score2;
  return { ...g, winner, isTie };
}

// ============================================================
// CLASSIFICAÇÃO DOS GRUPOS
// ============================================================
function computeStandings(participants, groupGames, grupo) {
  const rec = {};
  for (const p of Object.values(participants)) {
    if (p.grupo !== grupo) continue;
    rec[p.pos] = { ...p, J:0, V:0, E:0, D:0, GP:0, GC:0, SG:0, Pts:0 };
  }
  for (const g of groupGames) {
    if (g.status !== "finalizado" || g.score1 == null || g.score2 == null) continue;
    const a = rec[g.pos1], b = rec[g.pos2];
    if (!a || !b) continue;
    a.J++; b.J++;
    a.GP += g.score1; a.GC += g.score2;
    b.GP += g.score2; b.GC += g.score1;
    if (g.score1 > g.score2) { a.V++; b.D++; a.Pts += 3; }
    else if (g.score2 > g.score1) { b.V++; a.D++; b.Pts += 3; }
    else { a.E++; b.E++; a.Pts += 1; b.Pts += 1; }
  }
  for (const k in rec) rec[k].SG = rec[k].GP - rec[k].GC;
  return rankGroup(Object.values(rec), groupGames);
}

// Pts → SG → GP → confronto direto → posição (sorteio)
function rankGroup(arr, games) {
  arr.sort((a, b) => b.Pts - a.Pts || b.SG - a.SG || b.GP - a.GP || a.pos - b.pos);
  const out = []; let i = 0;
  while (i < arr.length) {
    let j = i + 1;
    while (j < arr.length &&
           arr[j].Pts === arr[i].Pts &&
           arr[j].SG === arr[i].SG &&
           arr[j].GP === arr[i].GP) j++;
    const cluster = arr.slice(i, j);
    if (cluster.length > 1) {
      const h2h = h2hPoints(cluster.map(c => c.pos), games);
      cluster.sort((a, b) => (h2h[b.pos] - h2h[a.pos]) || a.pos - b.pos);
    }
    out.push(...cluster); i = j;
  }
  return out;
}

function h2hPoints(positions, games) {
  const set = new Set(positions);
  const pts = {}; positions.forEach(p => pts[p] = 0);
  for (const g of games) {
    if (g.status !== "finalizado" || g.score1 == null || g.score2 == null) continue;
    if (set.has(g.pos1) && set.has(g.pos2)) {
      if (g.score1 > g.score2) pts[g.pos1] += 3;
      else if (g.score2 > g.score1) pts[g.pos2] += 3;
      else { pts[g.pos1] += 1; pts[g.pos2] += 1; }
    }
  }
  return pts;
}

function isGroupComplete(groupGames) {
  return groupGames.every(g => g.status === "finalizado" && g.score1 != null && g.score2 != null);
}

// ============================================================
// MATA-MATA
// ============================================================
function sideOfStanding(standing, idx) {
  const p = standing[idx];
  return p ? { nome: p.nome, clube: p.clube } : null;
}
function winnerSideKO(g) {
  if (!g || !g.winner) return null;
  return g.winner === 1 ? g.s1 : g.s2;
}
function loserSideKO(g) {
  if (!g || !g.winner) return null;
  return g.winner === 1 ? g.s2 : g.s1;
}

function buildKnockout(participants, gamesById, rankA, rankB, groupsDone) {
  const ko = {};
  for (const id of Object.keys(KNOCKOUT_META)) {
    const raw = gamesById[id] || {};
    ko[id] = normalizeGameObject({
      id, displayId: KNOCKOUT_META[id].label, phase: KNOCKOUT_META[id].phase,
      // override manual da planilha (pos1/pos2) tem prioridade
      s1: participantSide(participants, raw.pos1),
      s2: participantSide(participants, raw.pos2),
      score1: raw.score1 ?? null,
      score2: raw.score2 ?? null,
      vencedorManual: raw.vencedorManual || "",
      status: raw.status || "a_definir",
      groupGame: false,
    });
  }

  if (SEED_KNOCKOUT_FROM_STANDINGS && groupsDone) {
    // Quartas: 1ºA×4ºB, 2ºA×3ºB, 1ºB×4ºA, 2ºB×3ºA
    seedSlot(ko.QF1, 1, sideOfStanding(rankA, 0));
    seedSlot(ko.QF1, 2, sideOfStanding(rankB, 3));
    seedSlot(ko.QF2, 1, sideOfStanding(rankA, 1));
    seedSlot(ko.QF2, 2, sideOfStanding(rankB, 2));
    seedSlot(ko.QF3, 1, sideOfStanding(rankB, 0));
    seedSlot(ko.QF3, 2, sideOfStanding(rankA, 3));
    seedSlot(ko.QF4, 1, sideOfStanding(rankB, 1));
    seedSlot(ko.QF4, 2, sideOfStanding(rankA, 2));
  }

  // Semis a partir das quartas
  seedSlot(ko.SF1, 1, winnerSideKO(ko.QF1));
  seedSlot(ko.SF1, 2, winnerSideKO(ko.QF2));
  seedSlot(ko.SF2, 1, winnerSideKO(ko.QF3));
  seedSlot(ko.SF2, 2, winnerSideKO(ko.QF4));

  // 3º lugar e final
  seedSlot(ko.TER, 1, loserSideKO(ko.SF1));
  seedSlot(ko.TER, 2, loserSideKO(ko.SF2));
  seedSlot(ko.FINAL, 1, winnerSideKO(ko.SF1));
  seedSlot(ko.FINAL, 2, winnerSideKO(ko.SF2));

  return ko;
}

// Só preenche se o lado ainda estiver vazio (manual da planilha vence)
function seedSlot(game, side, src) {
  if (!game || !src || !src.nome) return;
  if (side === 1 && !game.s1) game.s1 = src;
  if (side === 2 && !game.s2) game.s2 = src;
}

// ============================================================
// RENDER
// ============================================================
const STATUS_LABEL = { a_definir: "a definir", ao_vivo: "ao vivo", finalizado: "finalizado" };

function crestImg(club, extraClass = "") {
  const url = clubCrestURL(club);
  return url
    ? `<img class="club-crest ${extraClass}" src="${url}" alt="${escapeHTML(club)}">`
    : `<span class="club-crest ${extraClass} crest-placeholder"></span>`;
}

function renderStandings(containerId, standing, complete) {
  const el = document.getElementById(containerId);
  const rows = standing.map((p, i) => {
    const qualified = i < 4 ? "qualified" : "";
    return `
      <tr class="${qualified}">
        <td class="pos">${i + 1}</td>
        <td class="player">
          ${crestImg(p.clube, "crest-xs")}
          <span class="pl-name">${escapeHTML(p.nome || "—")}</span>
        </td>
        <td>${p.J}</td>
        <td>${p.V}</td>
        <td>${p.E}</td>
        <td>${p.D}</td>
        <td class="hide-sm">${p.GP}</td>
        <td class="hide-sm">${p.GC}</td>
        <td>${p.SG >= 0 ? "+" : ""}${p.SG}</td>
        <td class="pts">${p.Pts}</td>
      </tr>`;
  }).join("");

  el.innerHTML = `
    <table class="standings">
      <thead>
        <tr>
          <th class="pos">#</th>
          <th class="player">Jogador</th>
          <th title="Jogos">J</th>
          <th title="Vitórias">V</th>
          <th title="Empates">E</th>
          <th title="Derrotas">D</th>
          <th class="hide-sm" title="Gols pró">GP</th>
          <th class="hide-sm" title="Gols contra">GC</th>
          <th title="Saldo de gols">SG</th>
          <th class="pts" title="Pontos">Pts</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${complete ? "" : `<p class="standings-note">Classificação provisória — atualiza conforme os jogos terminam</p>`}
  `;
}

function renderMatchCards(containerId, games, tpl) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  for (const g of games) el.appendChild(renderMatch(g, tpl));
}

function applySide(sideEl, side) {
  const nameEl = sideEl.querySelector(".team-name");
  const img = sideEl.querySelector(".club-crest");
  nameEl.textContent = side?.nome || "a definir";
  sideEl.classList.toggle("empty", !side?.nome);
  const url = clubCrestURL(side?.clube);
  if (url) { img.src = url; img.alt = side.clube; img.hidden = false; }
  else { img.hidden = true; img.removeAttribute("src"); img.alt = ""; }
}

function renderMatch(g, tpl) {
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.status = g.status;
  node.dataset.matchId = g.id;
  if (g.isTie && g.status === "finalizado") node.dataset.tie = "true";
  node.querySelector(".match-id").textContent = g.displayId || g.id;
  const tie = g.isTie && g.status === "finalizado" && !g.groupGame;
  node.querySelector(".match-status").textContent =
    tie ? "decisão" : (STATUS_LABEL[g.status] || g.status);

  const t1 = node.querySelector(".team-1");
  const t2 = node.querySelector(".team-2");
  applySide(t1, g.s1);
  applySide(t2, g.s2);
  t1.querySelector(".team-score").textContent = g.score1 != null ? g.score1 : "–";
  t2.querySelector(".team-score").textContent = g.score2 != null ? g.score2 : "–";

  if (g.status === "finalizado" && g.winner) {
    (g.winner === 1 ? t1 : t2).classList.add("winner");
    (g.winner === 1 ? t2 : t1).classList.add("loser");
  }
  return node;
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// ============================================================
// CICLO PRINCIPAL
// ============================================================
async function refresh() {
  const lastUpdate = document.getElementById("last-update");
  try {
    const rows = await loadData();
    const { participants, gamesById } = buildModel(rows);
    const groupGames = buildGroupGames(participants, gamesById);
    const tpl = document.getElementById("match-template");

    const rankA = computeStandings(participants, groupGames.A, "A");
    const rankB = computeStandings(participants, groupGames.B, "B");
    const completeA = isGroupComplete(groupGames.A);
    const completeB = isGroupComplete(groupGames.B);

    renderStandings("standings-A", rankA, completeA);
    renderStandings("standings-B", rankB, completeB);
    renderMatchCards("games-A", groupGames.A, tpl);
    renderMatchCards("games-B", groupGames.B, tpl);

    const ko = buildKnockout(participants, gamesById, rankA, rankB, completeA && completeB);
    renderMatchCards("matches-quartas", [ko.QF1, ko.QF2, ko.QF3, ko.QF4], tpl);
    renderMatchCards("matches-semis", [ko.SF1, ko.SF2], tpl);
    renderMatchCards("matches-final", [ko.FINAL], tpl);
    renderMatchCards("matches-terceiro", [ko.TER], tpl);

    const now = new Date();
    lastUpdate.textContent = `atualizado ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  } catch (err) {
    console.error("[campeonato] falha ao carregar:", err);
    lastUpdate.textContent = "erro ao atualizar — verifique a planilha";
  }
}

document.getElementById("refresh-now").addEventListener("click", e => {
  e.preventDefault();
  refresh();
});

refresh();
setInterval(refresh, REFRESH_INTERVAL_MS);
