# pi-ez-session-name

A small Pi extension that names new sessions automatically with a cheap model.

## Behavior

- **Auto naming:** when you send your second message in an unnamed session, the extension asks the configured model for a 6-16 word title that names your goal, in the background, and sets it with `pi.setSessionName()`. The request contains only labeled text: your first prompt (`initial_request`, about 4000 characters), the assistant's reply text (`assistant_progress`, about 1000), and your second prompt (`follow_up`, about 1500). Expanded skill blocks are shortened to `[skill: name]` first, so your own text around them survives the caps. Tool calls, tool results, and thinking are never sent.
- **Titles:** the model is told to name the outcome you want and keep distinctive names (people, tools, projects, skills), and to ignore how-to steering such as which tool or profile to use. Titles are trimmed to one line and capped at 140 characters.
- **One attempt per session:** auto naming runs at most once per session. It never overwrites a name you set yourself (`/name`, `--name`), including one set while generation is running, and it never renames a session you switched away from.
- **`/ez-name`:** regenerates the name from the whole conversation (user and assistant text with skill blocks shortened, capped at about 12000 characters, keeping the first prompt and the newest messages). It always replaces the current name, including manual names.
- **Failures:** an invalid config, unknown model, missing auth, provider error, or empty title shows one warning. There is no retry.

The input itself is never changed or delayed.

## Configuration

Optional file: `~/.pi/agent/extensions/pi-ez-session-name/config.json` (the Pi agent directory honors `PI_CODING_AGENT_DIR`).

```json
{ "model": "anthropic/claude-haiku-5-5" }
```

The value is `provider/id`, split at the first `/`. Without the file the default is `anthropic/claude-haiku-5-5`. The file is read at every naming attempt, so edits apply without reloading. The model must be available in `pi --list-models` and have auth configured.

## Usage

```sh
pi -e ./src/index.ts            # try it once from this checkout
pi install /path/to/pi-ez-session-name   # or install the local package
```

## Development

```sh
npm install
npm test           # node --import tsx --test tests/*.test.ts
npm run typecheck  # tsc --noEmit
```

To check title quality against real sessions, replay their auto-naming point through headless Pi with the real model (this makes real model calls; session files are read in place and nothing is saved):

```sh
npm run eval:naming -- --check-isolation <session.jsonl>    # confirm the system prompt is isolated
npm run eval:naming -- --runs 5 <session.jsonl>...          # print titles, word and character counts
```
