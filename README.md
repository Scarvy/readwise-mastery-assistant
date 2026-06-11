# Readwise Mastery Assistant

A Chrome extension that adds an AI assistant to Readwise's review pages
([Daily Review](https://readwise.io/dailyreview) and individual
`readwise.io/reviews/[id]` pages). When you open a highlight's
**Mastery card editor** (click **Master**) and switch to the
**Question & Answer** tab, it suggests **Q&A** flashcards based on the
highlight (and your note), and lets you fill in the question and answer
fields with one click.

## Setup

1. Get an Anthropic API key from
   [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Open `chrome://extensions`, enable **Developer mode** (top right), then
   click **Load unpacked** and select this project's folder.
3. Click the extension's toolbar icon → **Open settings**, paste your API
   key, choose a model, and click **Save**.
   - Default model: **Claude Haiku 4.5** (fast and cheap).
   - **Claude Sonnet 4.6** is available for higher-quality suggestions.

## Usage

1. Go to [readwise.io/dailyreview](https://readwise.io/dailyreview) (or any
   `readwise.io/reviews/[id]` page).
2. On a highlight, click **Master**, then switch to the
   **Question & Answer** tab.
3. Click **✨ Suggest Q&A cards**.
4. Review the suggested Q&A pairs:
   - Click **Use this** to fill the Question and Answer fields with that
     suggestion (you can still edit them), then click Readwise's
     **Save Flashcard** button to save it.
   - Or click **Copy** to copy the suggestion to your clipboard for use
     elsewhere (e.g. Anki).

## How it works

- **Content script** (`src/content/`) watches Readwise's review pages for the
  Mastery card editor's Question & Answer create area and injects the
  assistant UI there.
- **Background service worker** (`src/background/`) holds your API key,
  builds the prompt, and calls the Anthropic Messages API directly from the
  browser (using the `anthropic-dangerous-direct-browser-access` header).
- **Options page** (`src/options/`) stores your API key and model choice in
  `chrome.storage.local`.

## Known limitations (MVP)

- Suggestions are only generated on demand (no auto-generation).
- Only Q&A flashcards are supported; cloze deletion suggestions are not
  generated.
- **Use this** fills the question/answer fields but doesn't save the
  flashcard — click Readwise's **Save Flashcard** button to save it.
- Only the Anthropic API is supported.
- No Anki/AnkiConnect export yet.
- Selectors target Readwise's current Master Q&A form markup
  (`.qa-create-area`, `.question-input`, `.answer-input`, etc.) — if Readwise
  changes its UI, the content script may need updated selectors.
