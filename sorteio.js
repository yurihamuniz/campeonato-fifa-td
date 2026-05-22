// ============================================================
// SORTEIO DAS QUARTAS — Campeonato FIFA TD
// Lê os 6 vencedores da 1ª fase da mesma planilha e sorteia
// QF2, QF3 e QF4 com animação. QF1 é fixa (Time M × Venc. FR).
// ============================================================

// IMPORTANTE: mantenha esta URL idêntica à do app.js
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjVVtDYXYTcfy2tevgpRII-NUmBMiVQ5-nZ0_9atvNjeu6ts8B418Vkc1iqCc_MxgsR29_ev8gQ-6R/pub?gid=0&single=true&output=csv";
const FALLBACK_CSV_URL = "sample.csv";

// Mapa idêntico ao app.js — mantém duplicado por simplicidade
const CLUBS = {
  "Real Madrid":"real-madrid","Barcelona":"barcelona","PSG":"psg",
  "Bayern de Munique":"bayern","Liverpool":"liverpool","Arsenal":"arsenal",
  "Manchester City":"man-city","Inter de Milão":"inter",
  "Atlético de Madrid":"atletico","Napoli":"napoli","Borussia Dortmund":"dortmund",
  "Milan":"milan","Newcastle United":"newcastle","Tottenham":"tottenham",
  "Juventus":"juventus","RB Leipzig":"leipzig","Bayer Leverkusen":"leverkusen",
  "Chelsea":"chelsea","Manchester United":"man-united","Galatasaray":"galatasaray",
};
const _norm = s => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const CLUBS_NORM = Object.fromEntries(Object.entries(CLUBS).map(([n,s])=>[_norm(n),s]));
function clubCrestURL(name) {
  if (!name) return null;
  const slug = CLUBS_NORM[_norm(name)];
  return slug ? `assets/clubs/${slug}.png` : null;
}

// ============================================================
// CSV LOADER
// ============================================================
async function loadCSV() {
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

// ============================================================
// MATCH MODEL (subset do app.js, suficiente pra detectar vencedor)
// ============================================================
function buildMatch(row) {
  const p1 = row.placar1 === "" ? null : Number(row.placar1);
  const p2 = row.placar2 === "" ? null : Number(row.placar2);
  const status = (row.status || "a_definir").toLowerCase();
  let winner = null;
  const manual = String(row.vencedor || "").trim();
  if (manual === "1") winner = 1;
  else if (manual === "2") winner = 2;
  else if (status === "finalizado" && p1 != null && p2 != null) {
    if (p1 > p2) winner = 1;
    else if (p2 > p1) winner = 2;
  }
  return {
    id: row.jogo_id,
    phase: (row.fase || "").toLowerCase(),
    player1: row.jogador1 || row.time1 || "",
    player2: row.jogador2 || row.time2 || "",
    club1: row.clube1 || "",
    club2: row.clube2 || "",
    status, winner,
  };
}

// ============================================================
// ESTADO / RENDER DOS ESTADOS
// ============================================================
function showState(id) {
  for (const el of document.querySelectorAll(".sorteio-state")) el.hidden = true;
  document.getElementById(id).hidden = false;
}

function renderSlot(el, player) {
  const img = el.querySelector(".slot-crest");
  const name = el.querySelector(".slot-name");
  name.textContent = player?.name || "—";
  const url = clubCrestURL(player?.club);
  if (url) { img.src = url; img.alt = player.club || ""; img.hidden = false; }
  else { img.hidden = true; img.removeAttribute("src"); }
}

function renderClassifiedList(players) {
  const ul = document.getElementById("classified-list");
  ul.innerHTML = "";
  for (const p of players) {
    const li = document.createElement("li");
    const url = clubCrestURL(p.club);
    li.innerHTML = `
      ${url ? `<img class="mini-crest" src="${url}" alt="">` : `<span class="mini-crest mini-empty"></span>`}
      <span class="mini-name">${escapeHTML(p.name)}</span>
      <span class="mini-source">via ${p.sourceMatch}</span>
    `;
    ul.appendChild(li);
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// ============================================================
// LÓGICA DE SORTEIO
// ============================================================
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Anima um slot: faz nomes cycling com easing (rápido → devagar), termina no nome final
function spinSlot(slotEl, finalPlayer, pool) {
  slotEl.classList.remove("pending");
  slotEl.classList.add("spinning");
  const totalMs = 1800;
  const startInterval = 60;
  const endInterval = 280;
  const startTime = performance.now();
  return new Promise(resolve => {
    function tick() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / totalMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      if (t >= 1) {
        renderSlot(slotEl, finalPlayer);
        slotEl.classList.remove("spinning");
        slotEl.classList.add("revealed");
        slotEl.dispatchEvent(new CustomEvent("revealed"));
        resolve();
        return;
      }
      const random = pool[Math.floor(Math.random() * pool.length)];
      renderSlot(slotEl, random);
      const interval = startInterval + (endInterval - startInterval) * eased;
      setTimeout(tick, interval);
    }
    tick();
  });
}

async function animateDraw(pairings, pool) {
  showState("state-drawing");
  document.getElementById("drawing-title").textContent = "Sorteando…";
  document.getElementById("after-draw").hidden = true;

  // reset all slots
  for (const id of ["QF2-a","QF2-b","QF3-a","QF3-b","QF4-a","QF4-b"]) {
    const el = document.getElementById(id);
    el.classList.remove("revealed","spinning");
    el.classList.add("pending");
    renderSlot(el, { name: "?", club: "" });
  }

  // pequena pausa antes de começar pra criar suspense
  await wait(600);

  for (const p of pairings) {
    await spinSlot(document.getElementById(`${p.id}-a`), p.a, pool);
    await wait(180);
    await spinSlot(document.getElementById(`${p.id}-b`), p.b, pool);
    await wait(420);
  }

  // mostrar instruções finais
  document.getElementById("drawing-title").textContent = "Sorteio concluído ✓";
  const list = document.getElementById("instructions-list");
  list.innerHTML = "";
  for (const p of pairings) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${p.id}</strong>: <span>${escapeHTML(p.a.name)}</span> <em>(${escapeHTML(p.a.club || "—")})</em> × <span>${escapeHTML(p.b.name)}</span> <em>(${escapeHTML(p.b.club || "—")})</em>`;
    list.appendChild(li);
  }
  document.getElementById("after-draw").hidden = false;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// INICIALIZAÇÃO
// ============================================================
async function init() {
  let matches = [];
  try {
    const rows = await loadCSV();
    matches = rows.filter(r => r.jogo_id).map(buildMatch);
  } catch (e) {
    console.error("[sorteio] falha ao carregar planilha:", e);
    showState("state-waiting");
    document.getElementById("finished-count").textContent = "?";
    document.getElementById("missing-matches").innerHTML = `<p class="error">Não foi possível ler a planilha. Verifique a URL no <code>sorteio.js</code>.</p>`;
    return;
  }

  // Vencedores da 1ª fase
  const primeira = matches.filter(m => m.phase === "primeira");
  const finalizados = primeira.filter(m => m.status === "finalizado" && m.winner);

  // QF1 (display)
  const qf1 = matches.find(m => m.id === "QF1");
  const qf1Display = document.getElementById("qf1-display");
  if (qf1) {
    const slots = qf1Display.querySelectorAll(".slot");
    renderSlot(slots[0], { name: qf1.player1 || "Time M", club: qf1.club1 });
    renderSlot(slots[1], { name: qf1.player2 || "Vencedor da Repescagem", club: qf1.club2 });
  }

  if (finalizados.length < 6) {
    showState("state-waiting");
    document.getElementById("finished-count").textContent = String(finalizados.length);
    const missingIds = primeira
      .filter(m => m.status !== "finalizado" || !m.winner)
      .map(m => m.id);
    const missingEl = document.getElementById("missing-matches");
    missingEl.innerHTML = missingIds.length
      ? `<p>Falta finalizar: <strong>${missingIds.join(", ")}</strong></p>`
      : "";
    return;
  }

  // Lista de vencedores prontos pro sorteio
  const vencedores = finalizados.map(m => {
    const w1 = m.winner === 1;
    return {
      name: w1 ? m.player1 : m.player2,
      club: w1 ? m.club1 : m.club2,
      sourceMatch: m.id,
    };
  });

  renderClassifiedList(vencedores);
  showState("state-ready");

  // Botão sortear
  document.getElementById("btn-sortear").addEventListener("click", () => runSorteio(vencedores));
}

function runSorteio(vencedores) {
  const shuffled = shuffle(vencedores);
  const pairings = [
    { id: "QF2", a: shuffled[0], b: shuffled[1] },
    { id: "QF3", a: shuffled[2], b: shuffled[3] },
    { id: "QF4", a: shuffled[4], b: shuffled[5] },
  ];
  animateDraw(pairings, vencedores);

  // Botão "sortear de novo" depois que estiver visível
  const reBtn = document.getElementById("btn-resortear");
  reBtn.onclick = () => runSorteio(vencedores);
}

init();
