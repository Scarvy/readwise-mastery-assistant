const DEFAULT_PROVIDER = "anthropic";

const statusEl = document.getElementById("status");
const openOptionsBtn = document.getElementById("open-options");

async function refreshStatus() {
  const settings = await chrome.storage.local.get([
    "provider",
    "anthropicApiKey",
    "openaiApiKey",
    // legacy key from the Anthropic-only MVP
    "apiKey",
  ]);

  const provider = settings.provider || DEFAULT_PROVIDER;
  const apiKey =
    provider === "openai" ? settings.openaiApiKey : settings.anthropicApiKey || settings.apiKey;
  const providerName = provider === "openai" ? "OpenAI" : "Anthropic";

  if (apiKey) {
    statusEl.textContent = `✅ ${providerName} API key configured`;
    statusEl.classList.add("ok");
  } else {
    statusEl.textContent = `⚠️ No ${providerName} API key set yet`;
    statusEl.classList.add("warn");
  }
}

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshStatus();
