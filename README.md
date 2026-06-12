# Readwise Mastery Assistant

A Chrome extension that adds an AI assistant to Readwise's review pages
([Daily Review](https://readwise.io/dailyreview) and individual
`readwise.io/reviews/[id]` pages). When you open a highlight's Mastery card
editor and switch to the **Question & Answer** tab, it suggests Q&A
flashcards based on the highlight (and your note) and fills them in for you
with one click.

> **Note:** This is a personal project. The initial MVP was written with
> [Claude Code](https://claude.com/claude-code).

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

1. On a highlight, click **Master**, then switch to the
   **Question & Answer** tab.
2. Click **✨ Suggest Q&A cards**.
3. Review the suggestions:
   - Click **Use this** to fill the Question and Answer fields with that
     suggestion (you can still edit them), then click Readwise's
     **Save Flashcard** button to save it.
   - Or click **Copy** to copy the suggestion to your clipboard for use
     elsewhere (e.g. Anki).
