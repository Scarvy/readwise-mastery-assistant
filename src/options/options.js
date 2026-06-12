const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

const form = document.getElementById("settings-form");
const providerSelect = document.getElementById("provider");
const anthropicKeyInput = document.getElementById("anthropic-api-key");
const anthropicModelSelect = document.getElementById("anthropic-model");
const openaiKeyInput = document.getElementById("openai-api-key");
const openaiModelSelect = document.getElementById("openai-model");
const status = document.getElementById("status");

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
  ]);

  providerSelect.value = settings.provider || DEFAULT_PROVIDER;

  const anthropicApiKey = settings.anthropicApiKey || settings.apiKey;
  if (anthropicApiKey) anthropicKeyInput.value = anthropicApiKey;
  anthropicModelSelect.value =
    settings.anthropicModel || settings.model || DEFAULT_MODELS.anthropic;

  if (settings.openaiApiKey) openaiKeyInput.value = settings.openaiApiKey;
  openaiModelSelect.value = settings.openaiModel || DEFAULT_MODELS.openai;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({
    provider: providerSelect.value,
    anthropicApiKey: anthropicKeyInput.value.trim(),
    anthropicModel: anthropicModelSelect.value,
    openaiApiKey: openaiKeyInput.value.trim(),
    openaiModel: openaiModelSelect.value,
  });
  status.textContent = "Saved!";
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
});

loadSettings();
