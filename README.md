# Readwise Mastery Assistant

A Chrome extension that adds an AI assistant to Readwise's review pages. It does two things:

- **Suggest new flashcards** — on any highlight's Mastery card editor, switch to the **Question & Answer** tab and click **✨ Suggest Q&A cards** to get AI-generated flashcard suggestions based on the highlight and your note.
- **Improve existing flashcards** — when editing a card that already has a question and answer filled in, the panel shows **✨ Improve this card** instead, and suggests clearer, more testable rewrites of what you have.

> **Note:** This is an unofficial, personal project.

## Setup

1. Get an API key for at least one provider:
   - Anthropic: [console.anthropic.com](https://console.anthropic.com/settings/keys)
   - OpenAI: [platform.openai.com](https://platform.openai.com/api-keys)
2. Open `chrome://extensions`, enable **Developer mode** (top right), then
   click **Load unpacked** and select this project's folder.
3. Click the extension's toolbar icon → **Open settings**, paste your API
   key(s), pick a model for each provider, choose which provider is
   **Active**, and click **Save**.
   - Anthropic default: **Claude Haiku 4.5** (fast and cheap); **Claude
     Sonnet 4.6** is available for higher-quality suggestions.
   - OpenAI default: **GPT-4o mini** (fast and cheap); **GPT-4o** is
     available for higher-quality suggestions.

## Usage

### Creating a new flashcard

1. On a highlight, click **Master**, then switch to the **Question & Answer** tab.
2. Click **✨ Suggest Q&A cards**.
3. Review the suggestions:
   - Click **Use this** to fill the Question and Answer fields (you can still edit them), then click Readwise's **Save Flashcard** button to save.
   - Or click **Copy** to copy the suggestion to your clipboard.

### Improving an existing flashcard

1. Open a flashcard for editing — either from a highlight's Mastery editor or on the `readwise.io/master/due` review page.
2. When the Q&A tab already has text in the fields, the panel shows **✨ Improve this card** instead.
3. Click it to get 2–3 improved rewrites of the existing question and answer.
4. Use or copy any suggestion the same way as above.

## Privacy

- Your highlight text and note are sent only to the AI provider you choose
  (Anthropic or OpenAI), using the API key you provide.
- Your API key(s) are stored locally in your browser
  (`chrome.storage.local`) and are sent only to that provider's API.
- This extension has no backend — nothing is sent to any server operated by
  its developer.
