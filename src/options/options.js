const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const form = document.getElementById("settings-form");
const apiKeyInput = document.getElementById("api-key");
const modelSelect = document.getElementById("model");
const status = document.getElementById("status");

async function loadSettings() {
  const { apiKey, model } = await chrome.storage.local.get([
    "apiKey",
    "model",
  ]);
  if (apiKey) apiKeyInput.value = apiKey;
  modelSelect.value = model || DEFAULT_MODEL;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
  });
  status.textContent = "Saved!";
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
});

loadSettings();
