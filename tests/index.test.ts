import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import ezSessionName, {
  AUTO_PART_CAP,
  DEFAULT_MODEL,
  FULL_CONTEXT_CAP,
  SYSTEM_PROMPT,
  TITLE_CAP,
  buildAutoContext,
  buildFullContext,
  configPath,
  extractText,
  loadConfig,
  normalizeTitle,
  parseModelRef,
  type BranchEntry,
  type Turn,
} from "../src/index.js";

// ---------- fakes ----------

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type FakeReply = { text?: string; stopReason?: string; errorMessage?: string; throws?: unknown };
type ModelCall = { provider: string; modelId: string; context: { systemPrompt?: string; messages: { content: string }[] }; options: unknown };

function reply(r: FakeReply): unknown {
  return {
    role: "assistant",
    content: r.text === undefined ? [] : [{ type: "text", text: r.text }],
    stopReason: r.stopReason ?? "stop",
    ...(r.errorMessage === undefined ? {} : { errorMessage: r.errorMessage }),
  };
}

class Harness {
  sessionName: string | undefined;
  branch: BranchEntry[] = [];
  notifications: { message: string; type: string | undefined }[] = [];
  calls: ModelCall[] = [];
  finds: string[] = [];
  modelExists = true;
  authConfigured = true;
  /** Replies consumed in order; a Deferred lets a test control timing. */
  replies: (FakeReply | Deferred<FakeReply>)[] = [];
  handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
  commands = new Map<string, { handler: (args: string, ctx: unknown) => Promise<void> }>();

  readonly ctx = {
    ui: { notify: (message: string, type?: string) => this.notifications.push({ message, type }) },
    sessionManager: { getBranch: () => this.branch },
    modelRegistry: {
      find: (provider: string, modelId: string) => {
        this.finds.push(`${provider}/${modelId}`);
        return this.modelExists ? { provider, id: modelId } : undefined;
      },
      hasConfiguredAuth: () => this.authConfigured,
      streamSimple: (model: { provider: string; id: string }, context: ModelCall["context"], options: unknown) => {
        this.calls.push({ provider: model.provider, modelId: model.id, context, options });
        const next = this.replies.shift() ?? { text: "Default Title" };
        if ("promise" in next) {
          return { result: async () => reply(await next.promise) };
        }
        if (next.throws !== undefined) throw next.throws;
        return { result: async () => reply(next) };
      },
    },
  };

  constructor() {
    const pi = {
      on: (name: string, handler: (event: unknown, ctx: unknown) => unknown) => {
        this.handlers.set(name, handler);
      },
      registerCommand: (name: string, options: { handler: (args: string, ctx: unknown) => Promise<void> }) => {
        this.commands.set(name, options);
      },
      getSessionName: () => this.sessionName,
      setSessionName: (name: string) => {
        this.sessionName = name;
      },
    };
    ezSessionName(pi as unknown as ExtensionAPI);
  }

  input(text: string): unknown {
    return this.handlers.get("input")?.({ type: "input", text, source: "interactive" }, this.ctx);
  }
  emit(name: "session_start" | "session_shutdown"): void {
    this.handlers.get(name)?.({ type: name, reason: "new" }, this.ctx);
  }
  async command(name: string): Promise<void> {
    await this.commands.get(name)?.handler("", this.ctx);
  }
  warnings(): string[] {
    return this.notifications.filter((n) => n.type === "warning").map((n) => n.message);
  }
  conversationOf(call: ModelCall | undefined): Turn[] {
    assert.ok(call, "expected a model call");
    const content = call.context.messages[0]?.content ?? "";
    return (JSON.parse(content) as { conversation: Turn[] }).conversation;
  }
}

const user = (content: unknown): BranchEntry => ({ type: "message", message: { role: "user", content } });
const assistant = (content: unknown): BranchEntry => ({ type: "message", message: { role: "assistant", content } });
const toolResult = (text: string): BranchEntry => ({
  type: "message",
  message: { role: "toolResult", content: [{ type: "text", text }] },
});

/** Lets background naming (config file read, fake model) run to completion. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
}

// ---------- config environment ----------

let agentDir: string;
const previousAgentDir = process.env["PI_CODING_AGENT_DIR"];

beforeEach(async () => {
  agentDir = await mkdtemp(join(tmpdir(), "pi-ez-session-name-"));
  process.env["PI_CODING_AGENT_DIR"] = agentDir;
});
afterEach(async () => {
  if (previousAgentDir === undefined) delete process.env["PI_CODING_AGENT_DIR"];
  else process.env["PI_CODING_AGENT_DIR"] = previousAgentDir;
  await rm(agentDir, { recursive: true, force: true });
});

async function writeConfig(content: string): Promise<void> {
  await mkdir(join(agentDir, "extensions", "pi-ez-session-name"), { recursive: true });
  await writeFile(configPath(), content);
}

/** A branch as seen when the second user message is submitted. */
function secondInputBranch(): BranchEntry[] {
  return [user("Fix the login bug"), assistant([{ type: "text", text: "I fixed the session cookie." }])];
}

// ---------- R1 auto trigger ----------

describe("auto naming trigger (R1)", () => {
  test("names at the second user message, not the first or third", async () => {
    const h = new Harness();
    h.emit("session_start");

    h.branch = [];
    assert.deepEqual(h.input("Fix the login bug"), { action: "continue" });
    await settle();
    assert.equal(h.calls.length, 0);
    assert.equal(h.sessionName, undefined);

    h.branch = secondInputBranch();
    h.replies.push({ text: "Login Cookie Fix" });
    assert.deepEqual(h.input("Now add a test"), { action: "continue" });
    await settle();
    assert.equal(h.calls.length, 1);
    assert.equal(h.sessionName, "Login Cookie Fix");

    h.sessionName = undefined;
    h.branch = [...secondInputBranch(), user("Now add a test"), assistant("Done.")];
    h.input("Third message");
    await settle();
    assert.equal(h.calls.length, 1);
  });

  test("returns continue synchronously without waiting for the model", () => {
    const h = new Harness();
    h.branch = secondInputBranch();
    h.replies.push(deferred<FakeReply>());
    const result = h.input("second");
    assert.deepEqual(result, { action: "continue" });
    assert.ok(!(result instanceof Promise));
  });

  test("skips already-named sessions", async () => {
    const h = new Harness();
    h.sessionName = "Manual";
    h.branch = secondInputBranch();
    h.input("second");
    await settle();
    assert.equal(h.calls.length, 0);
    assert.equal(h.sessionName, "Manual");
  });

  test("skips branches with zero or two or more prior user messages", async () => {
    const h = new Harness();
    h.branch = [];
    h.input("first");
    h.branch = [user("a"), assistant("b"), user("c")];
    h.input("third");
    await settle();
    assert.equal(h.calls.length, 0);
  });

  test("repeated inputs during generation start no further attempt", async () => {
    const h = new Harness();
    const pending = deferred<FakeReply>();
    h.replies.push(pending);
    h.branch = secondInputBranch();
    h.input("second");
    h.input("second again");
    await settle();
    h.input("second once more");
    await settle();
    assert.equal(h.calls.length, 1);
    pending.resolve({ text: "Title" });
    await settle();
    assert.equal(h.calls.length, 1);
    assert.equal(h.sessionName, "Title");
  });

  test("session_start resets the single auto attempt", async () => {
    const h = new Harness();
    h.branch = secondInputBranch();
    h.replies.push({ text: "One" }, { text: "Two" });
    h.input("second");
    await settle();
    h.emit("session_start");
    h.sessionName = undefined;
    h.input("second");
    await settle();
    assert.equal(h.calls.length, 2);
    assert.equal(h.sessionName, "Two");
  });
});

// ---------- R2 auto context ----------

describe("auto context (R2)", () => {
  test("contains first prompt, assistant text, and current input; excludes tool content", async () => {
    const h = new Harness();
    h.branch = [
      user([{ type: "text", text: "  Fix the login bug  " }, { type: "image", data: "x", mimeType: "image/png" }]),
      assistant([
        { type: "thinking", thinking: "secret reasoning" },
        { type: "text", text: "Looking at auth." },
        { type: "toolCall", id: "1", name: "read", arguments: { path: "auth.ts" } },
      ]),
      toolResult("TOOL OUTPUT"),
      assistant([{ type: "text", text: "Fixed the cookie." }]),
    ];
    h.input("  Now add a test  ");
    await settle();
    const conversation = h.conversationOf(h.calls[0]);
    assert.deepEqual(conversation, [
      { role: "user", text: "Fix the login bug" },
      { role: "assistant", text: "Looking at auth.\n\nFixed the cookie." },
      { role: "user", text: "Now add a test" },
    ]);
    const raw = h.calls[0]?.context.messages[0]?.content ?? "";
    assert.ok(!raw.includes("TOOL OUTPUT"));
    assert.ok(!raw.includes("secret reasoning"));
    assert.ok(!raw.includes("auth.ts"));
  });

  test("caps each part at about 2000 characters", () => {
    const long = "x".repeat(5000);
    const conversation = buildAutoContext([user(long), assistant(long)], long);
    assert.equal(conversation.length, 3);
    for (const turn of conversation) assert.ok(turn.text.length <= AUTO_PART_CAP);
  });

  test("omits empty parts and makes no attempt when everything is empty", async () => {
    assert.deepEqual(buildAutoContext([user("hello"), assistant([{ type: "toolCall" }])], "  "), [
      { role: "user", text: "hello" },
    ]);
    const h = new Harness();
    h.branch = [user([{ type: "image", data: "x" }]), assistant([])];
    h.input("   ");
    await settle();
    assert.equal(h.calls.length, 0);
    h.branch = [user("hi"), assistant("hello")];
    h.input("go");
    await settle();
    assert.equal(h.calls.length, 1, "an empty input did not consume the single auto attempt");
  });
});

// ---------- R6 apply guard ----------

describe("apply guard (R6)", () => {
  test("a manual name set during generation is not overwritten", async () => {
    const h = new Harness();
    const pending = deferred<FakeReply>();
    h.replies.push(pending);
    h.branch = secondInputBranch();
    h.input("second");
    await settle();
    assert.equal(h.calls.length, 1);
    h.sessionName = "Manual Name";
    pending.resolve({ text: "Generated" });
    await settle();
    assert.equal(h.sessionName, "Manual Name");
    assert.deepEqual(h.warnings(), []);
  });

  for (const event of ["session_start", "session_shutdown"] as const) {
    test(`a session replaced during generation (${event}) is not renamed`, async () => {
      const h = new Harness();
      const pending = deferred<FakeReply>();
      h.replies.push(pending);
      h.branch = secondInputBranch();
      h.input("second");
      await settle();
      assert.equal(h.calls.length, 1);
      h.emit(event);
      pending.resolve({ text: "Generated" });
      await settle();
      assert.equal(h.sessionName, undefined);
    });
  }

  test("a stale context after replacement does not raise", async () => {
    const h = new Harness();
    const pending = deferred<FakeReply>();
    h.replies.push(pending);
    h.branch = secondInputBranch();
    h.input("second");
    h.ctx.ui.notify = () => {
      throw new Error("stale ctx");
    };
    pending.resolve({ text: "", stopReason: "error", errorMessage: "boom" });
    await settle();
    assert.equal(h.sessionName, undefined);
  });
});

// ---------- R3 /ez-name ----------

describe("/ez-name (R3)", () => {
  test("overwrites an existing name and notifies success", async () => {
    const h = new Harness();
    h.sessionName = "Manual Name";
    h.branch = [user("Fix bug"), assistant("Done"), toolResult("TOOL"), user("Add tests"), assistant("Added")];
    h.replies.push({ text: "Bug Fix and Tests" });
    await h.command("ez-name");
    await settle();
    assert.equal(h.sessionName, "Bug Fix and Tests");
    assert.deepEqual(h.conversationOf(h.calls[0]), [
      { role: "user", text: "Fix bug" },
      { role: "assistant", text: "Done" },
      { role: "user", text: "Add tests" },
      { role: "assistant", text: "Added" },
    ]);
    assert.ok(h.notifications.some((n) => n.type === "info" && n.message.includes("Bug Fix and Tests")));
  });

  test("warns on failure and keeps the existing name", async () => {
    const h = new Harness();
    h.sessionName = "Manual Name";
    h.branch = [user("Fix bug")];
    h.replies.push({ stopReason: "error", errorMessage: "rate limited" });
    await h.command("ez-name");
    await settle();
    assert.equal(h.sessionName, "Manual Name");
    assert.equal(h.warnings().length, 1);
    assert.match(h.warnings()[0] ?? "", /rate limited/);
  });

  test("rejects a concurrent run", async () => {
    const h = new Harness();
    h.branch = [user("Fix bug")];
    const pending = deferred<FakeReply>();
    h.replies.push(pending);
    await h.command("ez-name");
    await settle();
    await h.command("ez-name");
    await settle();
    assert.equal(h.calls.length, 1);
    assert.ok(h.notifications.some((n) => n.message.includes("already running")));
    pending.resolve({ text: "First" });
    await settle();
    assert.equal(h.sessionName, "First");
    h.replies.push({ text: "Second" });
    await h.command("ez-name");
    await settle();
    assert.equal(h.sessionName, "Second", "the guard is released after completion");
  });

  test("does not apply after session replacement", async () => {
    const h = new Harness();
    h.branch = [user("Fix bug")];
    const pending = deferred<FakeReply>();
    h.replies.push(pending);
    await h.command("ez-name");
    await settle();
    assert.equal(h.calls.length, 1);
    h.emit("session_start");
    pending.resolve({ text: "Late" });
    await settle();
    assert.equal(h.sessionName, undefined);
  });

  test("warns when there is no conversation", async () => {
    const h = new Harness();
    await h.command("ez-name");
    assert.equal(h.calls.length, 0);
    assert.equal(h.warnings().length, 1);
  });

  test("caps whole-conversation context, keeping the first prompt and the newest turns", () => {
    const branch: BranchEntry[] = [user("FIRST PROMPT")];
    for (let i = 0; i < 40; i += 1) {
      branch.push(assistant(`reply ${i} ${"a".repeat(600)}`), user(`prompt ${i} ${"u".repeat(600)}`));
    }
    const conversation = buildFullContext(branch);
    const total = conversation.reduce((sum, turn) => sum + turn.text.length, 0);
    assert.ok(total <= FULL_CONTEXT_CAP, `total ${total}`);
    assert.deepEqual(conversation[0], { role: "user", text: "FIRST PROMPT" });
    assert.match(conversation.at(-1)?.text ?? "", /^prompt 39 /);
    assert.ok(!conversation.some((turn) => turn.text.startsWith("reply 0 ")));
  });

  test("returns the whole conversation when under the cap", () => {
    const conversation = buildFullContext([assistant("greeting"), user("a"), assistant("b"), toolResult("t")]);
    assert.deepEqual(conversation, [
      { role: "user", text: "a" },
      { role: "assistant", text: "b" },
    ]);
  });
});

// ---------- R4 config / R5 call / R7 failures ----------

describe("config (R4)", () => {
  test("missing config uses the default model", async () => {
    const h = new Harness();
    h.branch = secondInputBranch();
    h.input("second");
    await settle();
    assert.deepEqual(h.finds, [DEFAULT_MODEL]);
    assert.equal(DEFAULT_MODEL, "anthropic/claude-haiku-5-5");
    assert.deepEqual(await loadConfig(configPath()), {
      ok: true,
      model: { provider: "anthropic", modelId: "claude-haiku-5-5" },
    });
  });

  test("valid config selects its model and is read at each attempt", async () => {
    await writeConfig(JSON.stringify({ model: "openrouter/google/gemini-flash" }));
    const h = new Harness();
    h.branch = [user("Fix bug")];
    await h.command("ez-name");
    await settle();
    assert.deepEqual(h.calls.map((c) => `${c.provider}|${c.modelId}`), ["openrouter|google/gemini-flash"]);
    await writeConfig(JSON.stringify({ model: "cursor/fast" }));
    await h.command("ez-name");
    await settle();
    assert.equal(h.calls[1]?.provider, "cursor");
  });

  test("config path lives under the agent directory", () => {
    assert.equal(configPath(), join(agentDir, "extensions", "pi-ez-session-name", "config.json"));
  });

  test("parseModelRef splits at the first slash and rejects malformed values", () => {
    assert.deepEqual(parseModelRef("a/b/c"), { provider: "a", modelId: "b/c" });
    for (const bad of [undefined, 42, "", "noslash", "/id", "provider/"]) {
      assert.equal(parseModelRef(bad), undefined, String(bad));
    }
  });
});

describe("model call (R5)", () => {
  test("uses one streamSimple call with data framing, reasoning off, and maxTokens 2048", async () => {
    const h = new Harness();
    h.branch = secondInputBranch();
    h.input("second");
    await settle();
    assert.equal(h.calls.length, 1);
    const call = h.calls[0];
    assert.equal(call?.context.systemPrompt, SYSTEM_PROMPT);
    assert.match(SYSTEM_PROMPT, /data/);
    assert.deepEqual(call?.options, { maxTokens: 2048 });
    assert.ok("conversation" in JSON.parse(call?.context.messages[0]?.content ?? "{}"));
  });
});

describe("failures (R7)", () => {
  const cases: { name: string; setup: (h: Harness) => Promise<void> | void; pattern: RegExp }[] = [
    { name: "unparseable JSON", setup: () => writeConfig("{not json"), pattern: /invalid JSON/ },
    { name: "non-string model", setup: () => writeConfig(JSON.stringify({ model: 5 })), pattern: /must contain/ },
    { name: "malformed model", setup: () => writeConfig(JSON.stringify({ model: "noslash" })), pattern: /must contain/ },
    { name: "model not found", setup: (h) => void (h.modelExists = false), pattern: /not found/ },
    { name: "missing auth", setup: (h) => void (h.authConfigured = false), pattern: /no auth/ },
    {
      name: "provider error",
      setup: (h) => void h.replies.push({ stopReason: "error", errorMessage: "overloaded" }),
      pattern: /overloaded/,
    },
    { name: "non-stop result", setup: (h) => void h.replies.push({ text: "Partial", stopReason: "length" }), pattern: /length/ },
    { name: "thrown error", setup: (h) => void h.replies.push({ throws: new Error("network down") }), pattern: /network down/ },
    { name: "empty title", setup: (h) => void h.replies.push({ text: '  ""  \n' }), pattern: /empty title/ },
  ];

  for (const { name, setup, pattern } of cases) {
    test(`${name}: warns once, no retry, attempt consumed`, async () => {
      const h = new Harness();
      await setup(h);
      h.branch = secondInputBranch();
      h.input("second");
      await settle();
      h.input("second again");
      await settle();
      assert.equal(h.warnings().length, 1);
      assert.match(h.warnings()[0] ?? "", pattern);
      assert.ok(h.calls.length <= 1);
      assert.equal(h.sessionName, undefined);
      assert.ok(h.notifications.every((n) => n.type === "warning"));
    });
  }
});

// ---------- normalization ----------

describe("normalizeTitle (R5)", () => {
  test("handles quotes, multi-line output, punctuation, whitespace, and length", () => {
    assert.equal(normalizeTitle('"Fix Login Bug"'), "Fix Login Bug");
    assert.equal(normalizeTitle("“Fix Login Bug.”"), "Fix Login Bug");
    assert.equal(normalizeTitle("'Refactor   the\tparser'!"), "Refactor the parser");
    assert.equal(normalizeTitle("\n\n  Fix Login Bug  \nExplanation: because..."), "Fix Login Bug");
    assert.equal(normalizeTitle("Why does it fail?"), "Why does it fail");
    assert.equal(normalizeTitle("   \n  "), "");
    const long = normalizeTitle(`${"word ".repeat(40)}end`);
    assert.ok(long.length <= TITLE_CAP && long.length > 0, long);
    assert.ok(!long.endsWith(" "));
    assert.ok(normalizeTitle("x".repeat(200)).length <= TITLE_CAP);
  });

  test("extractText reads strings and text blocks only", () => {
    assert.equal(extractText("plain"), "plain");
    assert.equal(extractText([{ type: "text", text: "a" }, { type: "toolCall" }, { type: "text", text: "b" }]), "a\nb");
    assert.equal(extractText(undefined), "");
  });
});

// ---------- packaging ----------

describe("package.json", () => {
  test("declares the extension entry and Pi only as a peer dependency", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
      pi?: { extensions?: string[] };
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    assert.deepEqual(pkg.pi?.extensions, ["./src/index.ts"]);
    assert.ok(pkg.peerDependencies?.["@earendil-works/pi-coding-agent"]);
    assert.equal(pkg.dependencies?.["@earendil-works/pi-coding-agent"], undefined);
  });
});
