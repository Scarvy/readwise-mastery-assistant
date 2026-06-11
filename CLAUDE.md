# CLAUDE.md

Developer/architecture notes for the Readwise Mastery Assistant Chrome
extension. See `README.md` for end-user setup/usage.

## Architecture

- **Content script** (`src/content/content.js`, `content.css`) — runs on
  `https://readwise.io/dailyreview*` and `https://readwise.io/reviews/*`. A
  `MutationObserver` on `document.body` watches for the Mastery card editor's
  `.qa-create-area` (appears once the user clicks **Master** →
  **Question & Answer**) and injects the suggestion panel directly above the
  "Save Flashcard" action row. The panel is removed when `.qa-create-area`
  disappears.
- **Background service worker** (`src/background/background.js`) — holds the
  Anthropic API key (from `chrome.storage.local`), builds the prompt, and
  calls `https://api.anthropic.com/v1/messages` directly from the browser
  (`anthropic-dangerous-direct-browser-access: true`). Default model
  `claude-haiku-4-5-20251001`; `claude-sonnet-4-6` is the alternative.
- **Options page** (`src/options/`) — API key + model picker, persisted to
  `chrome.storage.local`.
- **Popup** (`src/popup/`) — shows whether an API key is configured, links to
  options.

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

The background worker only generates Q&A suggestions (cloze deletion is
intentionally out of scope for now). `parseSuggestions` expects:

```json
{ "suggestions": [{ "question": "...", "answer": "...", "rationale": "..." }] }
```

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
- Multi-provider (OpenAI, etc.) support
