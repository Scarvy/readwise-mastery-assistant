const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MAX_TOKENS = 1024;

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

const SYSTEM_PROMPT = `You are an assistant that helps readers convert highlights from books and articles into spaced-repetition Q&A flashcards (e.g. for Anki).

Given a highlight (and optionally the reader's own note), generate 2 to 4 question-and-answer flashcard suggestions that test understanding of the core idea, not just verbatim recall of the highlight's wording.

Favor suggestions that test understanding and recall of the underlying idea over surface phrasing. If the highlight contains multiple distinct ideas, suggest cards for the most important ones.

Respond with ONLY a JSON object (no markdown code fences, no commentary) matching this schema:

{
  "suggestions": [
    {
      "question": "string",
      "answer": "string",
      "rationale": "string - one short sentence on why this is a good card"
    }
  ]
}`;

function buildUserMessage({ highlightText, noteText, sourceTitle, sourceAuthor }) {
  const lines = [];
  if (sourceTitle) {
    lines.push(`Source: "${sourceTitle}"${sourceAuthor ? ` by ${sourceAuthor}` : ""}`);
  }
  lines.push(`Highlight: "${highlightText}"`);
  if (noteText && noteText.trim()) {
    lines.push(`Existing note: "${noteText.trim()}"`);
  }
  lines.push("", "Generate Q&A flashcard suggestions for this highlight.");
  return lines.join("\n");
}

function parseSuggestions(rawText) {
  let text = rawText.trim();
  // Strip markdown code fences if the model added them despite instructions.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Could not parse model response as JSON: ${err.message}`);
  }

  if (!parsed || !Array.isArray(parsed.suggestions)) {
    throw new Error("Model response did not contain a 'suggestions' array.");
  }

  return parsed.suggestions.filter(
    (suggestion) =>
      typeof suggestion?.question === "string" && typeof suggestion?.answer === "string",
  );
}

async function extractErrorDetail(response) {
  const errorBody = await response.text().catch(() => "");
  try {
    return JSON.parse(errorBody)?.error?.message || errorBody;
  } catch {
    return errorBody;
  }
}

async function callAnthropic({ apiKey, model, userContent }) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error (${response.status}): ${await extractErrorDetail(response)}`);
  }

  const data = await response.json();
  return (data.content || [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

async function callOpenAI({ apiKey, model, userContent }) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error (${response.status}): ${await extractErrorDetail(response)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function generateSuggestions({
  provider,
  apiKey,
  model,
  highlightText,
  noteText,
  sourceTitle,
  sourceAuthor,
}) {
  const userContent = buildUserMessage({ highlightText, noteText, sourceTitle, sourceAuthor });

  const text =
    provider === "openai"
      ? await callOpenAI({ apiKey, model, userContent })
      : await callAnthropic({ apiKey, model, userContent });

  return parseSuggestions(text);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "open-settings") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/settings/settings.html") });
    return undefined;
  }

  if (message?.type !== "generate-suggestions") return undefined;

  (async () => {
    try {
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

      const provider = settings.provider || DEFAULT_PROVIDER;
      const apiKey =
        provider === "openai"
          ? settings.openaiApiKey
          : settings.anthropicApiKey || settings.apiKey;
      const model =
        (provider === "openai" ? settings.openaiModel : settings.anthropicModel || settings.model) ||
        DEFAULT_MODELS[provider];

      if (!apiKey) {
        sendResponse({ ok: false, error: "missing-api-key", provider });
        return;
      }

      const suggestions = await generateSuggestions({
        provider,
        apiKey,
        model,
        ...message.payload,
      });

      sendResponse({ ok: true, suggestions });
    } catch (err) {
      sendResponse({
        ok: false,
        error: "request-failed",
        message: String(err?.message || err),
      });
    }
  })();

  return true; // keep the message channel open for the async response
});
