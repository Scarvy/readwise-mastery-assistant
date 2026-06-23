const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

const form = document.getElementById("settings-form");
const anthropicKeyInput = document.getElementById("anthropic-api-key");
const anthropicModelSelect = document.getElementById("anthropic-model");
const openaiKeyInput = document.getElementById("openai-api-key");
const openaiModelSelect = document.getElementById("openai-model");
const saveButton = document.getElementById("save-button");
const status = document.getElementById("status");
const providerPanels = document.querySelectorAll("[data-provider-panel]");
let activeProvider = DEFAULT_PROVIDER;
let savedState = null;

function getCurrentSettingsState() {
  return {
    provider: activeProvider,
    anthropicApiKey: anthropicKeyInput.value.trim(),
    anthropicModel: anthropicModelSelect.value,
    openaiApiKey: openaiKeyInput.value.trim(),
    openaiModel: openaiModelSelect.value,
  };
}

function statesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function syncSaveButtonState() {
  if (!savedState) {
    saveButton.disabled = true;
    return;
  }

  saveButton.disabled = statesMatch(getCurrentSettingsState(), savedState);
}

function syncActiveProviderUI(activeProvider) {
  providerPanels.forEach((panel) => {
    const isActive = panel.dataset.providerPanel === activeProvider;
    panel.classList.toggle("is-active", isActive);

    const card = panel.querySelector(".provider-card");
    if (card) {
      card.setAttribute("aria-pressed", String(isActive));
    }
  });
}

function setPanelExpanded(providerName, isExpanded) {
  const panel = document.querySelector(`[data-provider-panel="${providerName}"]`);
  if (!panel) return;

  const toggle = panel.querySelector(".provider-toggle");
  const fields = panel.querySelector(".provider-fields");
  if (!toggle || !fields) return;

  toggle.setAttribute("aria-expanded", String(isExpanded));
  fields.hidden = !isExpanded;
}

function setActiveProvider(providerName) {
  activeProvider = providerName;
  syncActiveProviderUI(providerName);
  syncSaveButtonState();
}

function bindProviderPanels() {
  providerPanels.forEach((panel) => {
    const providerName = panel.dataset.providerPanel;
    const toggle = panel.querySelector(".provider-toggle");
    const card = panel.querySelector(".provider-card");
    if (!providerName || !toggle) return;

    toggle.addEventListener("click", () => {
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      setPanelExpanded(providerName, !isExpanded);
    });

    if (card) {
      const activateProvider = () => setActiveProvider(providerName);

      card.addEventListener("click", (event) => {
        if (event.target.closest(".provider-control")) return;
        activateProvider();
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target.closest(".provider-control")) return;
        event.preventDefault();
        activateProvider();
      });
    }
  });
}

async function loadSettings() {
  const settings = await chrome.storage.local.get([
    "provider",
    "anthropicApiKey",
    "anthropicModel",
    "openaiApiKey",
    "openaiModel",
    // legacy keys from the Anthropic-only MVP
    "apiKey",
    "model",
    "stats_suggest",
    "stats_improve",
    "stats_use_this",
  ]);

  const anthropicApiKey = settings.anthropicApiKey || settings.apiKey;
  if (anthropicApiKey) anthropicKeyInput.value = anthropicApiKey;
  anthropicModelSelect.value =
    settings.anthropicModel || settings.model || DEFAULT_MODELS.anthropic;

  if (settings.openaiApiKey) openaiKeyInput.value = settings.openaiApiKey;
  openaiModelSelect.value = settings.openaiModel || DEFAULT_MODELS.openai;

  setPanelExpanded("anthropic", false);
  setPanelExpanded("openai", false);
  setActiveProvider(settings.provider || DEFAULT_PROVIDER);
  savedState = getCurrentSettingsState();
  syncSaveButtonState();

  document.getElementById("stat-suggest").textContent = settings.stats_suggest ?? 0;
  document.getElementById("stat-improve").textContent = settings.stats_improve ?? 0;
  document.getElementById("stat-use-this").textContent = settings.stats_use_this ?? 0;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextState = getCurrentSettingsState();
  await chrome.storage.local.set(nextState);
  savedState = nextState;
  syncSaveButtonState();
  status.textContent = "Saved!";
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
});

[
  anthropicKeyInput,
  anthropicModelSelect,
  openaiKeyInput,
  openaiModelSelect,
].forEach((element) => {
  element.addEventListener("input", syncSaveButtonState);
  element.addEventListener("change", syncSaveButtonState);
});

bindProviderPanels();
loadSettings();
