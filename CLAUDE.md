# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Manifest V3 Chrome extension ("Readwise Mastery Assistant") that injects an
AI assistant into Readwise's review pages. It has two modes:

- **Suggest** — when the Q&A fields are empty, suggests new flashcards based on
  the highlight and the reader's note.
- **Improve** — when the Q&A fields already have content (editing an existing
  card), suggests improved rewrites of the existing question and answer.

Both modes use the Anthropic or OpenAI API (user's choice) and fill results into
Readwise's own question/answer fields with one click. See `README.md` for
end-user setup/usage.

## Development

- Plain vanilla JS/HTML/CSS — no dependencies, no package manager, no build
  step.
- **Load/reload**: `chrome://extensions` → enable **Developer mode** →
  **Load unpacked** → select the repo root. After editing source files,
  click the reload icon on the extension card and refresh the Readwise tab.
- **Syntax check** (no test suite exists): `node --check src/background/background.js`
  and `node --check src/content/content.js`.
- **Package for the Chrome Web Store**: `./scripts/build.sh` zips
  `manifest.json`, `src/`, and `public/` into
  `dist/readwise-mastery-assistant-<version>.zip`.
- There is no automated test suite — verification is manual in a real Chrome
  profile signed into Readwise (see "Testing constraints" below).

## Architecture

- **Content script** (`src/content/content.js`, `content.css`) — runs on
  `https://readwise.io/dailyreview*`, `https://readwise.io/review/*` (e.g.
  streak-recovery URLs like `/review/2026-06-14?isStreakRecovery=true`),
  `https://readwise.io/reviews/*`, `https://readwise.io/bookreview/*`,
  `https://readwise.io/master/due*`, and `https://readwise.io/master/all*`. A
  `MutationObserver` on `document.body` watches for the Mastery card editor's
  `.qa-create-area` (appears once the user clicks **Master** →
  **Question & Answer**) and injects the suggestion panel directly above the
  "Save Flashcard" action row. At injection time, `injectPanel` checks whether
  `.question-input` and `.answer-input` already have text; if so, it sets
  `panel.dataset.mode = "improve"` (otherwise `"suggest"`). The mode drives
  the button label and the payload sent to the background worker. The panel is
  removed when `.qa-create-area` disappears.
- **Background service worker** (`src/background/background.js`) — two prompt
  pairs, selected by `payload.mode`:
  - **Suggest** (`mode === "suggest"` or absent): `SUGGESTION_SYSTEM_PROMPT` +
    `SUGGESTION_USER_PROMPT` (instructions/examples/schema), assembled by
    `buildUserMessage` with the highlight and note appended.
  - **Improve** (`mode === "improve"`): `IMPROVE_SYSTEM_PROMPT` +
    `IMPROVE_USER_PROMPT` (improvement instructions/schema), assembled by
    `buildImproveMessage` with the existing question/answer appended.

  Both modes dispatch to `callAnthropic` (`https://api.anthropic.com/v1/messages`,
  with `anthropic-dangerous-direct-browser-access: true`) or `callOpenAI`
  (`https://api.openai.com/v1/chat/completions`, with
  `response_format: {type: "json_object"}`) based on the stored `provider`.
  Default models: `claude-haiku-4-5-20251001` (Anthropic) / `gpt-4o-mini`
  (OpenAI); `claude-sonnet-4-6` / `gpt-4o` are the higher-quality alternatives.
  Communicates with the content script via `chrome.runtime.onMessage`
  (`"generate-suggestions"`, `"open-settings"`).

- **Settings page** (`src/settings/`) — lets the user enter an API key + model
  for each provider and pick the active `provider`, persisted to
  `chrome.storage.local` as `provider`, `anthropicApiKey`,
  `anthropicModel`, `openaiApiKey`, `openaiModel`. (Legacy keys `apiKey`/
  `model` from the Anthropic-only MVP are read as a fallback if the new
  Anthropic keys aren't set yet.)
- **Popup** (`src/popup/`) — shows whether an API key is configured, links to
  settings.

## Key DOM selectors (Readwise review pages)

- `.highlight-detail-review.is-visible` — the active highlight slide.
- `.highlight-text` / `.highlight-title` / `.highlight-author` — highlight
  content and source metadata, used to build the prompt.
- `.note-box-text` — the reader's note (has `use-placeholder` class when
  empty).
- `.qa-create-area` — the Question & Answer create form, only present after
  Master → Question & Answer is open.
- `.question-input` / `.answer-input` — `contenteditable` Q&A fields.
- `.columns` (direct child of `.qa-create-area`) — the action row containing
  "Use highlight text as Answer" and "Save Flashcard"; the suggestion panel
  is inserted immediately before this.

These are React-controlled `contenteditable` divs — filling them with
`fillContentEditable()` uses `document.execCommand("selectAll"/"insertText"/
"insertLineBreak")` plus a dispatched `input` event, since plain
`.textContent =` assignment doesn't trigger React's state update.

If Readwise changes this markup, the content script will need updated
selectors.

## Suggestion format

Both suggest and improve modes return the same schema. `parseSuggestions` expects:

```json
{
  "suggestions": [
    { "question": "...", "answer": "...", "example": "...", "rationale": "..." }
  ]
}
```

`example` is optional — the content script renders it below the answer when present and appends it to the answer text on "Use this" and "Copy". Cloze deletion is intentionally out of scope.

## Testing constraints

- **Use this** fills the question/answer fields but does not click
  "Save Flashcard" — the user reviews and saves manually.
- Do not perform live writes (filling/saving flashcards, editing notes) on
  the user's real Readwise account via automated browser tools without
  explicit consent — this risks corrupting real flashcard/review data. Verify
  changes via `node --check` and static/structural review; rely on the user's
  own manual testing in their normal Chrome profile for write-path
  verification.

## Out of scope (for now)

- Cloze deletion suggestions
- Auto-generation (suggestions are on-demand only)
- Anki/AnkiConnect export
- Providers other than Anthropic and OpenAI
