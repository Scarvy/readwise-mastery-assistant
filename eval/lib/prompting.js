// Mirrors the prompt-building logic in src/background/background.js.
// This eval tool is for iterating on prompt *variants*, so DEFAULT_SYSTEM_PROMPT
// is just a starting point for the editable textarea in the UI, not kept in
// lockstep with the extension.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1024;

const DEFAULT_SYSTEM_PROMPT = `You are an assistant that helps readers convert highlights from books and articles into spaced-repetition Q&A flashcards (e.g. for Anki).

Given a highlight (and optionally the reader's own note), generate 2 to 4 question-and-answer flashcard suggestions that test understanding of the core idea, not just verbatim recall of the highlight's wording.

Favor suggestions that test understanding and recall of the underlying idea over surface phrasing. If the highlight contains multiple distinct ideas, suggest cards for the most important ones.

EXAMPLE:

Classic style is not the same as the common but unhelpful advice to “avoid abstraction.” Sometimes we do have to write about abstract ideas. What classic style does is explain them as if they were objects and forces that would be recognizable to anyone standing in a position to see them.

EXAMPLES:

{
  "suggestions": [
    {
      "question": "How can classic style be used to explain abstract ideas?",
      "answer": "Explain them as if they were objects and forces that would be recognizable to anyone standing in a position to see them.",
      "example": "— *Example:* Abstract: inflation erodes purchasing power. Classic style: Last year, $100 filled your grocery cart. This year, the same cart costs $108 . Your money didn't shrink-but what it can buy did."
      "rationale": "string - one short sentence on why this is a good card"
    }
  ]
}

If it's a SINGLE WORD or PHRASE please include a vocab-style Q&A pair as one of your suggestions in the following format: "What is the meaning of "**[the selected text]**"? **[the selected text]** (part of speech): [short definition] [2 emojis] - *Example:*

EXAMPLE:

{
  "suggestions": [
    {
      "question": "What is the meaning of "**orutund**"?",
      "answer": "**orotund** *(adjective)*: pompous or grandiloquent in speech or writing 🎩🎭",
      "example": — *Example:* __Groucho Marx was once asked a long and orotund question.__",
      "rationale": "string - one short sentence on why this is a good card"
    }
  ]
}

Format: Use Markdown to format highlights:

Type __ on both sides of the text to __highlight__
Type ** on both sides of the text to **bold**
Type * on both sides of the text to *italicize*

Respond with ONLY a JSON object (no markdown code fences, no commentary) matching this schema:

{
  "suggestions": [
    {
      "question": "string",
      "answer": "string",
      "example": "string",
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

async function callAnthropic({ apiKey, model, systemPrompt, userContent }) {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
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

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  buildUserMessage,
  parseSuggestions,
  callAnthropic,
};
