const PANEL_CLASS = "rma-panel";

let cachedSourceTitle = "";
let cachedSourceAuthor = "";

function incrementStat(key) {
  chrome.storage.local.get(key, (result) => {
    chrome.storage.local.set({ [key]: (result[key] || 0) + 1 });
  });
}

function getActiveSlide() {
  return document.querySelector(".highlight-detail-review.is-visible");
}

function getQACreateArea() {
  return document.querySelector(".qa-create-area");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Field interaction -------------------------------------------------------

function fillContentEditable(el, text) {
  el.focus();
  document.execCommand("selectAll", false, null);

  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    document.execCommand("insertText", false, line);
    if (idx < lines.length - 1) {
      document.execCommand("insertLineBreak");
    }
  });

  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// --- Panel rendering ---------------------------------------------------------

function renderIdleState(panel) {
  panel.innerHTML = "";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rma-suggest-button";
  button.textContent =
    panel.dataset.mode === "improve" ? "✨ Improve this card" : "✨ Suggest Q&A cards";
  button.addEventListener("click", () => onSuggestClick(panel));
  panel.appendChild(button);
}

function renderLoadingState(panel) {
  panel.innerHTML = "";
  const loading = document.createElement("div");
  loading.className = "rma-loading";
  loading.textContent = "Generating suggestions…";
  panel.appendChild(loading);
}

function renderErrorState(panel, response) {
  panel.innerHTML = "";
  const error = document.createElement("div");
  error.className = "rma-error";

  if (response?.error === "missing-api-key") {
    const providerName = response.provider === "openai" ? "OpenAI" : "Anthropic";
    error.innerHTML = `No ${providerName} API key configured. <button type="button" class="rma-link-button">Open settings</button>`;
    error.querySelector("button").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "open-settings" });
    });
  } else {
    error.textContent = `Couldn't generate suggestions: ${
      response?.message || "unknown error"
    }`;
  }

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "rma-suggest-button rma-retry-button";
  retry.textContent = "Try again";
  retry.addEventListener("click", () => onSuggestClick(panel));

  panel.appendChild(error);
  panel.appendChild(retry);
}

function renderSuggestions(panel, suggestions, qaArea) {
  panel.innerHTML = "";

  if (!suggestions.length) {
    const empty = document.createElement("div");
    empty.className = "rma-error";
    empty.textContent = "No suggestions came back. Try again?";
    panel.appendChild(empty);

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "rma-suggest-button rma-retry-button";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => onSuggestClick(panel));
    panel.appendChild(retry);
    return;
  }

  const list = document.createElement("div");
  list.className = "rma-suggestion-list";

  suggestions.forEach((suggestion) => {
    const card = document.createElement("div");
    card.className = "rma-suggestion";

    const body = document.createElement("div");
    body.className = "rma-suggestion-body";
    const q = document.createElement("p");
    q.innerHTML = `<strong>Q:</strong> ${escapeHtml(suggestion.question)}`;
    const a = document.createElement("p");
    a.innerHTML = `<strong>A:</strong> ${escapeHtml(suggestion.answer)}`;
    body.appendChild(q);
    body.appendChild(a);

    if (suggestion.example) {
      const example = document.createElement("p");
      example.className = "rma-example";
      example.innerHTML = `<strong>Example:</strong> ${escapeHtml(suggestion.example)}`;
      body.appendChild(example);
    }

    card.appendChild(body);

    const answerText = suggestion.example
      ? `${suggestion.answer}\n\n${suggestion.example}`
      : suggestion.answer;

    if (suggestion.rationale) {
      const rationale = document.createElement("p");
      rationale.className = "rma-rationale";
      rationale.textContent = suggestion.rationale;
      card.appendChild(rationale);
    }

    const actions = document.createElement("div");
    actions.className = "rma-actions";

    const useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "rma-action-button rma-insert-button";
    useBtn.textContent = "Use this";
    useBtn.addEventListener("click", () => {
      const questionEl = qaArea.querySelector(".question-input");
      const answerEl = qaArea.querySelector(".answer-input");
      if (!questionEl || !answerEl) return;

      fillContentEditable(questionEl, suggestion.question);
      fillContentEditable(answerEl, answerText);
      incrementStat("stats_use_this");

      const original = useBtn.textContent;
      useBtn.textContent = "Filled ✓";
      setTimeout(() => {
        useBtn.textContent = original;
      }, 1500);
    });

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "rma-action-button rma-copy-button";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(`Q: ${suggestion.question}\nA: ${answerText}`);
      incrementStat("stats_copy");
      const original = copyBtn.textContent;
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1500);
    });

    actions.appendChild(useBtn);
    actions.appendChild(copyBtn);
    card.appendChild(actions);

    list.appendChild(card);
  });

  panel.appendChild(list);

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "rma-suggest-button rma-retry-button";
  retry.textContent = "Suggest more";
  retry.addEventListener("click", () => onSuggestClick(panel));
  panel.appendChild(retry);
}

function onSuggestClick(panel) {
  const slide = getActiveSlide();
  const qaArea = getQACreateArea();
  const mode = panel.dataset.mode || "suggest";

  if (!qaArea) return;
  if (mode !== "improve" && !slide) return;

  incrementStat(mode === "improve" ? "stats_improve" : "stats_suggest");
  renderLoadingState(panel);

  const highlightText = slide?.querySelector(".highlight-text")?.textContent.trim() || "";
  const noteEl = slide?.querySelector(".note-box-text");
  const noteText =
    noteEl && !noteEl.classList.contains("use-placeholder")
      ? noteEl.textContent.trim()
      : "";
  const sourceTitle = cachedSourceTitle;
  const sourceAuthor = cachedSourceAuthor;

  const payload = { mode, highlightText, noteText, sourceTitle, sourceAuthor };

  if (mode === "improve") {
    payload.existingQuestion =
      qaArea.querySelector(".question-input")?.textContent.trim() || "";
    payload.existingAnswer =
      qaArea.querySelector(".answer-input")?.textContent.trim() || "";
  }

  chrome.runtime.sendMessage(
    { type: "generate-suggestions", payload },
    (response) => {
      if (chrome.runtime.lastError) {
        renderErrorState(panel, {
          error: "request-failed",
          message: chrome.runtime.lastError.message,
        });
        return;
      }
      if (!response?.ok) {
        renderErrorState(panel, response);
        return;
      }
      renderSuggestions(panel, response.suggestions, qaArea);
    },
  );
}

// --- Injection / sync --------------------------------------------------------

function injectPanel(qaArea) {
  const questionEl = qaArea.querySelector(".question-input");
  const answerEl = qaArea.querySelector(".answer-input");
  const isEdit = !!(questionEl?.textContent.trim() && answerEl?.textContent.trim());

  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.dataset.mode = isEdit ? "improve" : "suggest";
  renderIdleState(panel);

  const actionsRow = qaArea.querySelector(".columns");
  if (actionsRow) {
    actionsRow.insertAdjacentElement("beforebegin", panel);
  } else {
    qaArea.appendChild(panel);
  }
}

function syncPanel() {
  const qaArea = getQACreateArea();
  const slide = getActiveSlide();
  const existing = document.querySelector(`.${PANEL_CLASS}`);

  // Cache source metadata while the slide still has it (before Q&A editor opens and removes them)
  if (slide && !qaArea) {
    const title = slide.querySelector(".highlight-title")?.textContent.trim();
    const author = slide.querySelector(".highlight-author")?.textContent.trim();
    if (title) cachedSourceTitle = title;
    if (author) cachedSourceAuthor = author;
  }

  if (!qaArea) {
    existing?.remove();
    return;
  }

  if (existing && qaArea.contains(existing)) {
    return; // already injected for this Q&A form
  }

  existing?.remove();
  injectPanel(qaArea);
}

let scheduled = false;
function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    syncPanel();
  });
}

const observer = new MutationObserver(scheduleSync);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "aria-hidden"],
});

scheduleSync();
