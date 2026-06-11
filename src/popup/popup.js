const statusEl = document.getElementById("status");
const openOptionsBtn = document.getElementById("open-options");

async function refreshStatus() {
  const { apiKey } = await chrome.storage.local.get(["apiKey"]);
  if (apiKey) {
    statusEl.textContent = "✅ API key configured";
    statusEl.classList.add("ok");
  } else {
    statusEl.textContent = "⚠️ No Anthropic API key set yet";
    statusEl.classList.add("warn");
  }
}

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshStatus();
