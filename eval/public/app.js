const state = {
  highlights: [],
  filtered: [],
  index: 0,
};

const els = {
  refreshHighlights: document.getElementById("refresh-highlights"),
  sourceFilter: document.getElementById("source-filter"),
  highlightCount: document.getElementById("highlight-count"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  position: document.getElementById("position"),
  sourceTitle: document.getElementById("source-title"),
  sourceMeta: document.getElementById("source-meta"),
  highlightText: document.getElementById("highlight-text"),
  highlightNote: document.getElementById("highlight-note"),
  promptLabel: document.getElementById("prompt-label"),
  systemPrompt: document.getElementById("system-prompt"),
  generate: document.getElementById("generate"),
  generateStatus: document.getElementById("generate-status"),
  suggestions: document.getElementById("suggestions"),
  loadResults: document.getElementById("load-results"),
  resultsBody: document.querySelector("#results-table tbody"),
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function loadDefaultPrompt() {
  const res = await fetch("/api/default-prompt");
  const data = await res.json();
  els.systemPrompt.value = data.systemPrompt;
}

async function loadHighlights() {
  const res = await fetch("/api/highlights");
  const data = await res.json();
  state.highlights = data.highlights || [];
  populateSourceFilter();
  applyFilter();
}

async function refreshHighlights() {
  els.refreshHighlights.disabled = true;
  els.highlightCount.textContent = "Fetching from Readwise…";
  try {
    const res = await fetch("/api/highlights/refresh", { method: "POST" });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.highlights = data.highlights || [];
    populateSourceFilter();
    applyFilter();
  } catch (err) {
    els.highlightCount.textContent = `Error: ${err.message}`;
  } finally {
    els.refreshHighlights.disabled = false;
  }
}

function populateSourceFilter() {
  const counts = new Map();
  for (const h of state.highlights) {
    const key = h.title || "(untitled)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const sources = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const previous = els.sourceFilter.value;
  els.sourceFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = `All sources (${state.highlights.length})`;
  els.sourceFilter.appendChild(allOption);

  for (const [title, count] of sources) {
    const option = document.createElement("option");
    option.value = title;
    option.textContent = `${title} (${count})`;
    els.sourceFilter.appendChild(option);
  }

  if (sources.some(([title]) => title === previous)) {
    els.sourceFilter.value = previous;
  }
}

function applyFilter() {
  const selected = els.sourceFilter.value;
  state.filtered = selected
    ? state.highlights.filter((h) => (h.title || "(untitled)") === selected)
    : state.highlights;
  state.index = 0;
  renderHighlight();
}

function renderHighlight() {
  const total = state.filtered.length;
  els.highlightCount.textContent = `${state.highlights.length} highlights loaded`;
  els.suggestions.innerHTML = "";

  if (total === 0) {
    els.position.textContent = "0 / 0";
    els.sourceTitle.textContent = "";
    els.sourceMeta.textContent = "";
    els.highlightText.textContent = state.highlights.length === 0
      ? 'Click "Refresh highlights from Readwise" to load your library.'
      : "No highlights for this source.";
    els.highlightNote.textContent = "";
    return;
  }

  const h = state.filtered[state.index];
  els.position.textContent = `${state.index + 1} / ${total}`;
  els.sourceTitle.textContent = h.title || "(untitled)";
  els.sourceMeta.textContent = [h.author, h.category].filter(Boolean).join(" · ");
  els.highlightText.textContent = h.text;
  els.highlightNote.textContent = h.note ? `Note: ${h.note}` : "";
}

function showPrev() {
  if (state.filtered.length === 0) return;
  state.index = (state.index - 1 + state.filtered.length) % state.filtered.length;
  renderHighlight();
}

function showNext() {
  if (state.filtered.length === 0) return;
  state.index = (state.index + 1) % state.filtered.length;
  renderHighlight();
}

async function generateSuggestions() {
  const h = state.filtered[state.index];
  if (!h) return;

  els.generate.disabled = true;
  els.generateStatus.textContent = "Generating…";
  els.suggestions.innerHTML = "";

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ highlight: h, systemPrompt: els.systemPrompt.value }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderSuggestions(data.suggestions || []);
    els.generateStatus.textContent = "";
  } catch (err) {
    els.generateStatus.textContent = `Error: ${err.message}`;
  } finally {
    els.generate.disabled = false;
  }
}

function renderSuggestions(suggestions) {
  els.suggestions.innerHTML = "";

  if (suggestions.length === 0) {
    els.suggestions.textContent = "No suggestions returned.";
    return;
  }

  suggestions.forEach((s) => {
    const card = document.createElement("div");
    card.className = "suggestion-card";
    card.dataset.suggestion = JSON.stringify(s);
    card.innerHTML = `
      <p class="question"><strong>Q:</strong> ${escapeHtml(s.question)}</p>
      <p class="answer"><strong>A:</strong> ${escapeHtml(s.answer)}</p>
      <p class="rationale"><em>${escapeHtml(s.rationale)}</em></p>
      <div class="score-row">
        <label>Score
          <select class="score">
            <option value="">—</option>
            <option value="1">1 - not useful</option>
            <option value="2">2</option>
            <option value="3">3 - okay</option>
            <option value="4">4</option>
            <option value="5">5 - great card</option>
          </select>
        </label>
        <label class="notes-label">Notes
          <input class="notes" type="text" placeholder="optional notes" />
        </label>
      </div>
    `;
    els.suggestions.appendChild(card);
  });

  const saveBtn = document.createElement("button");
  saveBtn.id = "save-scores";
  saveBtn.textContent = "Save scores";
  saveBtn.addEventListener("click", saveScores);
  els.suggestions.appendChild(saveBtn);

  const saveStatus = document.createElement("span");
  saveStatus.id = "save-status";
  els.suggestions.appendChild(saveStatus);
}

async function saveScores() {
  const h = state.filtered[state.index];
  const cards = els.suggestions.querySelectorAll(".suggestion-card");
  const suggestions = Array.from(cards).map((card) => {
    const s = JSON.parse(card.dataset.suggestion);
    const score = card.querySelector(".score").value;
    const notes = card.querySelector(".notes").value;
    return { ...s, score: score ? Number(score) : null, notes };
  });

  await fetch("/api/scores", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      highlightId: h.id,
      highlightTitle: h.title,
      promptLabel: els.promptLabel.value,
      systemPrompt: els.systemPrompt.value,
      suggestions,
    }),
  });

  const status = document.getElementById("save-status");
  if (status) status.textContent = "Saved!";
  loadResults();
}

async function loadResults() {
  const res = await fetch("/api/scores");
  const data = await res.json();
  const scores = data.scores || [];

  const byLabel = {};
  for (const record of scores) {
    for (const s of record.suggestions || []) {
      if (typeof s.score !== "number") continue;
      const label = record.promptLabel || "(unlabeled)";
      byLabel[label] = byLabel[label] || { total: 0, count: 0 };
      byLabel[label].total += s.score;
      byLabel[label].count += 1;
    }
  }

  els.resultsBody.innerHTML = "";
  Object.entries(byLabel).forEach(([label, { total, count }]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(label)}</td><td>${(total / count).toFixed(2)}</td><td>${count}</td>`;
    els.resultsBody.appendChild(tr);
  });
}

els.refreshHighlights.addEventListener("click", refreshHighlights);
els.sourceFilter.addEventListener("change", applyFilter);
els.prev.addEventListener("click", showPrev);
els.next.addEventListener("click", showNext);
els.generate.addEventListener("click", generateSuggestions);
els.loadResults.addEventListener("click", loadResults);

loadDefaultPrompt();
loadHighlights();
loadResults();
