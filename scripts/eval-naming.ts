/**
 * Dev-only naming evaluation. Replays the auto-naming point of real Pi sessions through
 * headless Pi with the real model and prints the generated titles.
 *
 *   node --import tsx scripts/eval-naming.ts [--runs 5] <session.jsonl>...
 *   node --import tsx scripts/eval-naming.ts --check-isolation <session.jsonl>
 *
 * Session files are read at run time; nothing from them is written to the repository.
 * `--check-isolation` makes one call with a temp `--session-dir` and a read-only probe
 * extension that records the rendered system prompt and the provider request's system field.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_MODEL,
  SYSTEM_PROMPT,
  buildAutoContext,
  extractText,
  normalizeTitle,
  type AutoContext,
  type BranchEntry,
} from "../src/index.js";

const run = promisify(execFile);

type Entry = BranchEntry & { id?: string; parentId?: string | null; name?: unknown };
type Replay = { oldName: string; payload: AutoContext };

const PI_FLAGS = [
  "-p",
  "--no-extensions",
  "--no-skills",
  "--no-prompt-templates",
  "--no-context-files",
  "--no-mcp",
  "--no-tools",
  "--thinking",
  "off",
  "--model",
  DEFAULT_MODEL,
  "--system-prompt",
  SYSTEM_PROMPT,
  "--append-system-prompt",
  "",
];

const PROBE_EXTENSION = `
import { writeFileSync } from "node:fs";
export default function probe(pi) {
  const out = process.env.EZ_EVAL_PROBE_OUT;
  const record = {};
  const save = () => writeFileSync(out, JSON.stringify(record, null, 2));
  pi.on("before_agent_start", (event) => { record.systemPrompt = event.systemPrompt; save(); });
  pi.on("before_provider_request", (event) => {
    record.providerSystem = event.payload && typeof event.payload === "object" ? event.payload.system : undefined;
    save();
  });
}
`;

const isUser = (entry: Entry | undefined): boolean =>
  entry?.type === "message" &&
  typeof entry.message === "object" &&
  entry.message !== null &&
  (entry.message as { role?: unknown }).role === "user";

/** Branch before the first user message that has exactly one user message among its ancestors. */
async function replaySession(path: string): Promise<Replay> {
  const entries = (await readFile(path, "utf8"))
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Entry);
  const byId = new Map(entries.filter((entry) => entry.id).map((entry) => [entry.id as string, entry]));
  const ancestors = (entry: Entry): Entry[] => {
    const chain: Entry[] = [];
    let parent = entry.parentId ? byId.get(entry.parentId) : undefined;
    while (parent) {
      chain.unshift(parent);
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return chain;
  };
  for (const entry of entries) {
    if (!isUser(entry)) continue;
    const branch = ancestors(entry);
    if (branch.filter(isUser).length !== 1) continue;
    const inputText = extractText((entry.message as { content?: unknown }).content);
    const named = entries.find((candidate) => candidate.type === "session_info" && typeof candidate.name === "string");
    return { oldName: (named?.name as string | undefined) ?? "(none)", payload: buildAutoContext(branch, inputText) };
  }
  throw new Error(`${path}: no second user message found`);
}

async function callPi(payload: AutoContext, extraArgs: string[] = [], env: NodeJS.ProcessEnv = {}): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "ez-eval-cwd-"));
  try {
    const pending = run("pi", [...PI_FLAGS, ...extraArgs, JSON.stringify(payload)], {
      cwd,
      env: { ...process.env, ...env },
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    pending.child.stdin?.end(); // print mode otherwise waits for piped stdin
    try {
      return (await pending).stdout;
    } catch (error) {
      const { stderr, signal } = error as { stderr?: string; signal?: string };
      throw new Error(`pi failed${signal ? ` (${signal})` : ""}: ${stderr?.trim().split("\n").at(-1) ?? String(error)}`);
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

async function checkIsolation(path: string): Promise<boolean> {
  const { payload } = await replaySession(path);
  const dir = await mkdtemp(join(tmpdir(), "ez-eval-probe-"));
  try {
    const probe = join(dir, "probe.ts");
    const out = join(dir, "probe.json");
    await writeFile(probe, PROBE_EXTENSION);
    const stdout = await callPi(payload, ["--session-dir", join(dir, "sessions"), "-e", probe], { EZ_EVAL_PROBE_OUT: out });
    const record = JSON.parse(await readFile(out, "utf8")) as { systemPrompt?: string; providerSystem?: unknown };
    const prompt = record.systemPrompt ?? "";
    const rest = prompt.startsWith(SYSTEM_PROMPT) ? prompt.slice(SYSTEM_PROMPT.length) : undefined;
    const isolated = rest !== undefined && /^\s*<cwd>\n[^\n]*\n<\/cwd>\s*$/.test(rest);
    console.log("## Isolation check");
    console.log(`title: ${normalizeTitle(stdout)}`);
    console.log("rendered system prompt:");
    console.log(prompt);
    console.log("provider request system field:");
    console.log(JSON.stringify(record.providerSystem, null, 2));
    console.log(`isolated (SYSTEM_PROMPT plus <cwd> only): ${isolated ? "PASS" : "FAIL"}`);
    return isolated;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function evaluate(paths: string[], runs: number): Promise<void> {
  console.log(`model ${DEFAULT_MODEL}, ${runs} runs per session`);
  for (const [index, path] of paths.entries()) {
    const { oldName, payload } = await replaySession(path);
    const sizes = Object.entries(payload)
      .map(([key, value]) => `${key}=${String(value).length}`)
      .join(" ");
    const titles = await Promise.all(
      Array.from({ length: runs }, () => callPi(payload).then(normalizeTitle, (error: unknown) => `ERROR ${String(error)}`)),
    );
    console.log(`\n## S${index + 1} ${basename(path)}`);
    console.log(`old name: ${oldName}`);
    console.log(`payload chars: ${sizes}`);
    for (const [run, title] of titles.entries()) {
      const words = title.split(/\s+/).filter(Boolean).length;
      console.log(`${run + 1}. ${title} (${words} words, ${title.length} chars)`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let runs = 5;
  let isolation = false;
  const paths: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string;
    if (arg === "--runs") runs = Number(args[++index]);
    else if (arg === "--check-isolation") isolation = true;
    else paths.push(arg);
  }
  if (paths.length === 0 || !Number.isInteger(runs) || runs < 1) {
    console.error("usage: eval-naming.ts [--runs N] [--check-isolation] <session.jsonl>...");
    process.exitCode = 2;
    return;
  }
  if (isolation) {
    process.exitCode = (await checkIsolation(paths[0] as string)) ? 0 : 1;
    return;
  }
  await evaluate(paths, runs);
}

await main();
