"use strict";
const node_readline = require("node:readline");
const node_crypto = require("node:crypto");
const node_fs = require("node:fs");
const node_os = require("node:os");
const node_path = require("node:path");
const SERVER_INFO = { name: "porcelain", version: "0.6.0" };
const PROTOCOL_VERSION = "2025-06-18";
const REVIEW_FILE_SCHEMA = {
  type: "object",
  properties: {
    path: { type: "string", description: "Repo-relative file path" },
    source: {
      type: "string",
      enum: ["changed", "context", "shipped"],
      description: "Where the file sits relative to the change: 'shipped' (already landed, e.g. the server half), 'context' (unchanged but needed to follow the flow). Files in the working tree are detected as 'changed' automatically."
    },
    note: {
      type: "string",
      description: 'A cross-file invariant the reviewer must check (e.g. "labels must match the service").'
    },
    layer: {
      type: "string",
      description: `The flow-layer heading this file sits under IN THE FEATURE VIEW (e.g. "Store", "Routes"). Set it to place the file exactly where it belongs in the feature's flow — when any file has a layer, Porcelain renders the feature view by your declared layers and file order instead of the repo-wide regex layers (which still drive the Changes tab). Omit to fall back to the regex match. Order your files entry-point → data; that order is preserved within each layer.`
    }
  },
  required: ["path"]
};
const LAYER_SCHEMA = {
  type: "object",
  properties: {
    label: { type: "string", description: 'The group heading shown in Porcelain (e.g. "Hooks")' },
    pattern: {
      type: "string",
      description: "A JavaScript regular expression tested against the repo-relative path. Conventions the defaults use: a folder match is `(^|/)(foo|bar)/`, an extension match is `\\.(yaml|toml)$`, a filename-suffix match is `\\.(test|spec)\\.[a-z]+$`."
    }
  },
  required: ["label", "pattern"]
};
const TOOLS = [
  {
    name: "set_feature_review",
    description: "Define the feature review for a repo: the full set of files that make up the feature being reviewed, including server/cross-seam files the diff alone never shows, each optionally annotated with the invariant to check. Replaces any existing review set for the repo. List the files in flow order (entry point → data) — Porcelain renders the feature view in the order you send them. Set each file's `layer` to control the grouping for THIS feature; when you do, your layers + order win over the repo-wide regex layers (use get/set_flow_layers only for the repo-wide Changes-tab grouping).",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        name: { type: "string", description: 'A name for the feature (e.g. "Crew call-outs")' },
        files: { type: "array", items: REVIEW_FILE_SCHEMA }
      },
      required: ["repoPath", "files"]
    }
  },
  {
    name: "add_review_files",
    description: "Add files to the existing feature review for a repo (creating one if none exists). Files with a path already present are replaced. Use while building a feature to grow the review incrementally.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        files: { type: "array", items: REVIEW_FILE_SCHEMA }
      },
      required: ["repoPath", "files"]
    }
  },
  {
    name: "clear_feature_review",
    description: "Remove the feature review for a repo. Porcelain falls back to the static baseline (changed files plus what they import).",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "get_feature_review",
    description: 'Read back the current feature review for a repo: its name, file count, and every file with its declared source and note. Use it to verify what you pushed, make an idempotent update (read → modify → set), or recover the set after losing context. Returns the stored set as declared; Porcelain still auto-detects working-tree files as "changed" when it renders.',
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "get_feature_view",
    description: "Read Porcelain's COMPUTED feature view for a repo: every file it renders, grouped in flow order, each tagged with its source — 'changed' (in the git diff), 'context' (unchanged but reached by import), or 'shipped' (cross-seam, agent-declared) — and its flow layer. This is the complement to get_feature_review: that echoes what you DECLARED, this shows what Porcelain MADE of it after folding in git status and the import baseline (so it includes context files you didn't list, and tells you which files are actually diffed). Use it to confirm your set rendered as intended and to see the whole feature, not just the diff.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "get_review_comments",
    description: "Read the human reviewer's open comments for a repo: each is anchored to a file (and optionally a line range), shows the snippet it was attached to, and carries the reviewer's note plus an id. Each is also tagged with the file's feature-view status — changed (in the git diff), context, or shipped — so you can tell a comment on a diffed file from one on an unchanged context/cross-seam file. The reviewer writes these in Porcelain by selecting lines or a file and adding a comment — use them as concrete review context (what to explain, fix, or look at). Resolve each with resolve_review_comment once you've addressed it.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "resolve_review_comment",
    description: "Mark one of the reviewer's comments resolved, by its id (from get_review_comments), once you've addressed it. It then drops off the reviewer's open list in Porcelain. Only do this after actually handling the note.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        id: { type: "string", description: "The comment id from get_review_comments" }
      },
      required: ["repoPath", "id"]
    }
  },
  {
    name: "get_reviewed_files",
    description: "Read which files the human has checked off as reviewed for a repo. Porcelain lets the reviewer mark each changed file reviewed (a per-file checkbox in the Changes / Feature lists); this returns those repo-relative paths. Use it to see how far the human has gotten and where to focus — any changed file NOT in this list is still unreviewed, so explain or double-check those, and treat reviewed ones as already vetted. The marks describe the current working tree and reset when the changes are committed. Read-only: the marks are the human's review state, so there is no tool to set them.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "set_feature_artifact",
    description: "Author (or replace) the feature artifact for a repo: a self-contained HTML document that explains the feature — prose, inline SVG diagrams, tables, images — which Porcelain renders in the viewer so the human gets an enhanced way to understand what you built. It COMPLEMENTS the feature review set (which is the file-by-file flow); this is the narrative/visual explainer. HOW TO AUTHOR IT: the HTML is rendered in a FULLY SANDBOXED iframe — scripts NEVER execute and external resources (CDN scripts/stylesheets/fonts, remote images, fetch) NEVER load. So it must be ONE self-contained document: inline all CSS in a <style> tag (no <link>), draw diagrams as inline <svg> (not <img> to a URL), embed any raster image as a data: URI (e.g. data:image/png;base64,…), and write tables/headings/lists as plain HTML. No <script> — it won't run, so don't rely on it. Porcelain's UI is DARK: style the document itself with a dark background and light text (e.g. body { background:#0b0b0d; color:#e5e5e7 }) so it matches. Keep it under ~1.5 MB — trim or shrink embedded images rather than pasting huge blobs.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        title: {
          type: "string",
          description: 'A short title for the artifact (e.g. "Crew call-outs — how it works")'
        },
        html: {
          type: "string",
          description: "The complete self-contained HTML document. Inline CSS only, diagrams as inline SVG, images as data: URIs; no scripts, no external resources; dark background + light text to match the app."
        }
      },
      required: ["repoPath", "title", "html"]
    }
  },
  {
    name: "get_feature_artifact",
    description: "Read back the current feature artifact for a repo: its title, size, and when it was last set (not the full HTML). Use it to check whether one exists and confirm what you pushed.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "clear_feature_artifact",
    description: "Remove the feature artifact for a repo. Porcelain stops showing the artifact opener in the Feature tab.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "list_cards",
    description: "Read the project board for a repo: todo/doing/done cards the human (and you) use to plan the work, grouped by column, each with an id, title, and optional body. Read this to learn what to build next instead of waiting for the human to spell it out, and to keep the board in sync as you work.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "create_card",
    description: 'Add a card to the project board (defaults to the "todo" column). Use it to capture a task or feature you or the human identified.',
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        title: { type: "string", description: "Short card title" },
        body: { type: "string", description: "Optional details / description" },
        status: {
          type: "string",
          enum: ["todo", "doing", "done"],
          description: "Column; defaults to todo"
        }
      },
      required: ["repoPath", "title"]
    }
  },
  {
    name: "update_card",
    description: "Edit a card's title and/or body, by its id (from list_cards).",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        id: { type: "string", description: "The card id from list_cards" },
        title: { type: "string" },
        body: { type: "string" }
      },
      required: ["repoPath", "id"]
    }
  },
  {
    name: "move_card",
    description: 'Move a card to a different column, by its id. Move a card to "doing" when you start it and "done" when you finish, so the board reflects your progress.',
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        id: { type: "string", description: "The card id from list_cards" },
        status: { type: "string", enum: ["todo", "doing", "done"], description: "Target column" }
      },
      required: ["repoPath", "id", "status"]
    }
  },
  {
    name: "delete_card",
    description: "Remove a card from the project board, by its id.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        id: { type: "string", description: "The card id from list_cards" }
      },
      required: ["repoPath", "id"]
    }
  },
  {
    name: "list_actions",
    description: "Read the repo's saved actions: named shell commands the human runs in Porcelain's embedded terminal with one click (e.g. a dev server, storybook, a test watcher), each with an id, title, command, and optional cwd. Read this to see what's already set up, then curate it with create/update/delete_action. Note: only the human executes an action — there is no run tool.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "create_action",
    description: "Add a saved action for the repo: a named command the human can run in Porcelain's embedded terminal. Use it to set up the project's common commands (dev server, storybook, lint, tests) so they're one click away. The human runs it; you only define it.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        title: {
          type: "string",
          description: 'Short label shown on the action (e.g. "Storybook")'
        },
        command: {
          type: "string",
          description: 'The shell command to run (e.g. "pnpm --filter web dev")'
        },
        cwd: {
          type: "string",
          description: "Optional working directory, repo-relative or absolute; defaults to repo root"
        }
      },
      required: ["repoPath", "title", "command"]
    }
  },
  {
    name: "update_action",
    description: "Edit a saved action's title, command, and/or cwd, by its id (from list_actions).",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        id: { type: "string", description: "The action id from list_actions" },
        title: { type: "string" },
        command: { type: "string" },
        cwd: { type: "string", description: "Pass an empty string to clear the cwd" }
      },
      required: ["repoPath", "id"]
    }
  },
  {
    name: "delete_action",
    description: "Remove a saved action from the repo, by its id (from list_actions).",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        id: { type: "string", description: "The action id from list_actions" }
      },
      required: ["repoPath", "id"]
    }
  },
  {
    name: "get_repo_notes",
    description: `Read the human's freeform project notes for a repo: a per-repo markdown scratchpad they keep in Porcelain (Files → Notes) with conventions, gotchas, todos, and context for the work. Read it to pick up project context the human jotted down instead of spelling it out in chat — especially when they mention "my notes" or you're starting work in the repo. Read-only: the notes are the human's, so there is no write tool (capture tasks on the project board instead).`,
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "get_flow_layers",
    description: `Read the repo's review-flow layers: the ordered { label, pattern } rules Porcelain uses to group changed files into a story from entry point to data. Returns the effective set — the repo's custom layers if set, otherwise the built-in defaults — as both a numbered list and JSON. Read this before tailoring the grouping with set_flow_layers; a file belongs to the furthest-right matching layer and unmatched files fall into "Other".`,
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  },
  {
    name: "set_flow_layers",
    description: "Replace the repo's review-flow layers with a full ordered list (entry point → data), tailored to this codebase's actual structure. Send the COMPLETE desired set every time — this is a whole-set replace, so to add, edit, remove, or reorder a layer you send the new full list (read get_flow_layers first, modify, then set). Order matters twice: it is the order groups render in, and the furthest-right match on a path wins. Patterns are JavaScript regexes tested against repo-relative paths.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" },
        layers: {
          type: "array",
          items: LAYER_SCHEMA,
          description: "The full ordered layer set, entry point → data (at least one)"
        }
      },
      required: ["repoPath", "layers"]
    }
  },
  {
    name: "reset_flow_layers",
    description: "Remove the repo's custom review-flow layers so Porcelain falls back to its built-in defaults.",
    inputSchema: {
      type: "object",
      properties: {
        repoPath: { type: "string", description: "Absolute path to the repository" }
      },
      required: ["repoPath"]
    }
  }
];
function isRecord$9(value) {
  return typeof value === "object" && value !== null;
}
function asString$1(value) {
  return typeof value === "string" ? value : void 0;
}
function ok(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function fail(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
async function handleRpc(message, callTool2) {
  if (!isRecord$9(message)) return null;
  const method = asString$1(message.method);
  const id = message.id;
  if (method === void 0) return null;
  const isNotification = !("id" in message) || id === null || id === void 0;
  if (isNotification) return null;
  if (method === "initialize") {
    const params = isRecord$9(message.params) ? message.params : {};
    return ok(id, {
      protocolVersion: asString$1(params.protocolVersion) ?? PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO
    });
  }
  if (method === "tools/list") return ok(id, { tools: TOOLS });
  if (method === "ping") return ok(id, {});
  if (method === "tools/call") {
    const params = isRecord$9(message.params) ? message.params : {};
    const name = asString$1(params.name);
    const args = isRecord$9(params.arguments) ? params.arguments : {};
    if (name === void 0) return fail(id, -32602, "missing tool name");
    try {
      const text = await callTool2(name, args);
      return ok(id, { content: [{ type: "text", text }] });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      return ok(id, { content: [{ type: "text", text }], isError: true });
    }
  }
  return fail(id, -32601, `method not found: ${method}`);
}
function isRecord$8(value) {
  return typeof value === "object" && value !== null;
}
function actionsPath() {
  return process.env.PORCELAIN_ACTIONS ?? node_path.join(node_os.homedir(), ".porcelain", "actions.json");
}
function parseActions(value) {
  if (!Array.isArray(value)) return [];
  const actions = [];
  for (const item of value) {
    if (!isRecord$8(item)) continue;
    if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.command !== "string") {
      continue;
    }
    const action = {
      id: item.id,
      title: item.title,
      command: item.command,
      order: typeof item.order === "number" ? item.order : 0,
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0
    };
    if (typeof item.cwd === "string") action.cwd = item.cwd;
    actions.push(action);
  }
  return actions;
}
function readAll$8() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(actionsPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$8(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) all[repoPath] = parseActions(value);
  return all;
}
function writeAll$5(all) {
  const path = actionsPath();
  node_fs.mkdirSync(node_path.dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  node_fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  node_fs.renameSync(tmp, path);
}
function readActions(repoPath) {
  const actions = readAll$8()[repoPath] ?? [];
  return [...actions].sort((a, b) => a.order - b.order);
}
function createAction(repoPath, title, command, cwd) {
  const now = Date.now();
  const action = { id: node_crypto.randomUUID(), title, command, order: now, createdAt: now };
  if (cwd !== void 0) action.cwd = cwd;
  const all = readAll$8();
  all[repoPath] = [...all[repoPath] ?? [], action];
  writeAll$5(all);
  return action;
}
function updateAction(repoPath, id, fields) {
  const all = readAll$8();
  const action = all[repoPath]?.find((a) => a.id === id);
  if (!action) return false;
  if (fields.title !== void 0) action.title = fields.title;
  if (fields.command !== void 0) action.command = fields.command;
  if (fields.cwd !== void 0) action.cwd = fields.cwd || void 0;
  writeAll$5(all);
  return true;
}
function deleteAction(repoPath, id) {
  const all = readAll$8();
  const actions = all[repoPath];
  if (!actions?.some((a) => a.id === id)) return false;
  all[repoPath] = actions.filter((a) => a.id !== id);
  writeAll$5(all);
  return true;
}
function describeActions(repoPath, actions) {
  if (actions.length === 0) {
    return `No saved actions for ${repoPath}. Actions are named commands the human runs in Porcelain's embedded terminal with one click; add useful ones (dev server, storybook, test watcher) here and they appear in the app.`;
  }
  const lines = [`Saved actions for ${repoPath} (${actions.length}):`];
  for (const action of actions) {
    lines.push(
      `- [${action.id}] ${action.title}
    $ ${action.command}${action.cwd ? `  (cwd: ${action.cwd})` : ""}`
    );
  }
  return lines.join("\n");
}
const MAX_HTML_BYTES = 1572864;
function isRecord$7(value) {
  return typeof value === "object" && value !== null;
}
function artifactsPath() {
  return process.env.PORCELAIN_ARTIFACTS ?? node_path.join(node_os.homedir(), ".porcelain", "artifacts.json");
}
function validateArtifact(title, html) {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("title must be a non-empty string");
  }
  if (typeof html !== "string" || html.length === 0) {
    throw new Error("html must be a non-empty string");
  }
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) {
    throw new Error(
      `html is ${bytes} bytes, over the ${MAX_HTML_BYTES}-byte limit — slim it down (drop or shrink embedded images/data URIs, trim the prose). The document must be self-contained but small.`
    );
  }
  return { title, html };
}
function readAll$7() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(artifactsPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$7(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (!isRecord$7(value)) continue;
    const { title, html, updatedAt } = value;
    if (typeof title !== "string" || typeof html !== "string") continue;
    all[repoPath] = {
      title,
      html,
      updatedAt: typeof updatedAt === "string" ? updatedAt : ""
    };
  }
  return all;
}
function writeAll$4(all) {
  const path = artifactsPath();
  node_fs.mkdirSync(node_path.dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  node_fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  node_fs.renameSync(tmp, path);
}
function setArtifact(repoPath, title, html) {
  const valid = validateArtifact(title, html);
  const artifact = { ...valid, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  const all = readAll$7();
  all[repoPath] = artifact;
  writeAll$4(all);
  return artifact;
}
function clearArtifact(repoPath) {
  const all = readAll$7();
  if (!(repoPath in all)) return;
  delete all[repoPath];
  writeAll$4(all);
}
function getArtifact(repoPath) {
  return readAll$7()[repoPath] ?? null;
}
function describeArtifact(repoPath, artifact) {
  if (!artifact) {
    return `No feature artifact for ${repoPath}. Use set_feature_artifact to author a self-contained HTML document that explains the feature; Porcelain renders it in the viewer.`;
  }
  const bytes = Buffer.byteLength(artifact.html, "utf8");
  const when = artifact.updatedAt ? ` (updated ${artifact.updatedAt})` : "";
  return `Feature artifact "${artifact.title}" for ${repoPath}: ${bytes} bytes of HTML${when}.`;
}
const CARD_STATUSES = ["todo", "doing", "done"];
const STATUS_SET = new Set(CARD_STATUSES);
function isRecord$6(value) {
  return typeof value === "object" && value !== null;
}
function boardPath() {
  return process.env.PORCELAIN_BOARD ?? node_path.join(node_os.homedir(), ".porcelain", "board.json");
}
function parseCards(value) {
  if (!Array.isArray(value)) return [];
  const cards = [];
  for (const item of value) {
    if (!isRecord$6(item)) continue;
    if (typeof item.id !== "string" || typeof item.title !== "string") continue;
    const status = typeof item.status === "string" && STATUS_SET.has(item.status) ? item.status : "todo";
    const card = {
      id: item.id,
      title: item.title,
      status,
      order: typeof item.order === "number" ? item.order : 0,
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0
    };
    if (typeof item.body === "string") card.body = item.body;
    cards.push(card);
  }
  return cards;
}
function readAll$6() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(boardPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$6(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) all[repoPath] = parseCards(value);
  return all;
}
function writeAll$3(all) {
  const path = boardPath();
  node_fs.mkdirSync(node_path.dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  node_fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  node_fs.renameSync(tmp, path);
}
function normalizeStatus(value) {
  return typeof value === "string" && STATUS_SET.has(value) ? value : null;
}
function readCards(repoPath) {
  const cards = readAll$6()[repoPath] ?? [];
  return [...cards].sort((a, b) => a.order - b.order);
}
function createCard(repoPath, title, body, status) {
  const now = Date.now();
  const card = { id: node_crypto.randomUUID(), title, status, order: now, createdAt: now };
  if (body !== void 0) card.body = body;
  const all = readAll$6();
  all[repoPath] = [...all[repoPath] ?? [], card];
  writeAll$3(all);
  return card;
}
function updateCard(repoPath, id, fields) {
  const all = readAll$6();
  const card = all[repoPath]?.find((c) => c.id === id);
  if (!card) return false;
  if (fields.title !== void 0) card.title = fields.title;
  if (fields.body !== void 0) card.body = fields.body;
  writeAll$3(all);
  return true;
}
function moveCard(repoPath, id, status) {
  const all = readAll$6();
  const card = all[repoPath]?.find((c) => c.id === id);
  if (!card) return false;
  card.status = status;
  card.order = Date.now();
  writeAll$3(all);
  return true;
}
function deleteCard(repoPath, id) {
  const all = readAll$6();
  const cards = all[repoPath];
  if (!cards?.some((c) => c.id === id)) return false;
  all[repoPath] = cards.filter((c) => c.id !== id);
  writeAll$3(all);
  return true;
}
const STATUS_LABEL = { todo: "To do", doing: "Doing", done: "Done" };
function describeBoard(repoPath, cards) {
  if (cards.length === 0) {
    return `The project board for ${repoPath} is empty. The human (or you) adds cards in Porcelain; read them here to know what to build.`;
  }
  const lines = [`Project board for ${repoPath} (${cards.length} card(s)):`];
  for (const status of CARD_STATUSES) {
    const inColumn = cards.filter((c) => c.status === status);
    if (inColumn.length === 0) continue;
    lines.push(`
## ${STATUS_LABEL[status]} (${inColumn.length})`);
    for (const card of inColumn) {
      lines.push(
        `- [${card.id}] ${card.title}${card.body ? `
    ${card.body.replace(/\n/g, "\n    ")}` : ""}`
      );
    }
  }
  return lines.join("\n");
}
function isRecord$5(value) {
  return typeof value === "object" && value !== null;
}
function commentsPath() {
  return process.env.PORCELAIN_COMMENTS ?? node_path.join(node_os.homedir(), ".porcelain", "comments.json");
}
function parseComments(value) {
  if (!Array.isArray(value)) return [];
  const comments = [];
  for (const item of value) {
    if (!isRecord$5(item)) continue;
    if (typeof item.id !== "string" || typeof item.path !== "string") continue;
    if (typeof item.body !== "string") continue;
    const comment = {
      id: item.id,
      path: item.path,
      body: item.body,
      resolved: item.resolved === true,
      createdAt: typeof item.createdAt === "number" ? item.createdAt : 0
    };
    if (typeof item.startLine === "number") comment.startLine = item.startLine;
    if (typeof item.endLine === "number") comment.endLine = item.endLine;
    if (typeof item.anchorText === "string") comment.anchorText = item.anchorText;
    comments.push(comment);
  }
  return comments;
}
function readAll$5() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(commentsPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$5(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) {
    all[repoPath] = parseComments(value);
  }
  return all;
}
function writeAll$2(all) {
  const path = commentsPath();
  node_fs.mkdirSync(node_path.dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  node_fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  node_fs.renameSync(tmp, path);
}
function readComments(repoPath) {
  return readAll$5()[repoPath] ?? [];
}
function resolveComment(repoPath, id) {
  const all = readAll$5();
  const comments = all[repoPath];
  if (!comments) return false;
  const target = comments.find((c) => c.id === id);
  if (!target || target.resolved) return false;
  target.resolved = true;
  writeAll$2(all);
  return true;
}
function describeOne(c, sourceOf) {
  const where = c.startLine === void 0 ? c.path : c.endLine && c.endLine !== c.startLine ? `${c.path}:${c.startLine}-${c.endLine}` : `${c.path}:${c.startLine}`;
  const status = sourceOf?.get(c.path);
  const tag = status ? ` (${status})` : "";
  const anchor = c.anchorText ? `
    « ${c.anchorText.replace(/\n/g, "\n      ")} »` : "";
  return `- [${c.id}] ${where}${tag}${anchor}
    ${c.body}`;
}
function describeComments(repoPath, comments, sourceOf) {
  const open = comments.filter((c) => !c.resolved);
  const resolved = comments.length - open.length;
  if (comments.length === 0) {
    return `No review comments for ${repoPath}. The reviewer adds them in Porcelain by selecting lines (or a file) and writing a note; they show up here as context.`;
  }
  if (open.length === 0) {
    return `No open review comments for ${repoPath} (${resolved} resolved).`;
  }
  const body = open.map((c) => describeOne(c, sourceOf)).join("\n");
  return `${open.length} open review comment(s) for ${repoPath}${resolved ? ` (${resolved} resolved)` : ""}. Resolve each with resolve_review_comment once addressed:
${body}`;
}
const FILE_SOURCES$1 = /* @__PURE__ */ new Set(["changed", "context", "shipped"]);
function isRecord$4(value) {
  return typeof value === "object" && value !== null;
}
function featureViewPath() {
  return process.env.PORCELAIN_FEATURE_VIEW ?? node_path.join(node_os.homedir(), ".porcelain", "feature-view.json");
}
function parseFiles(value) {
  if (!Array.isArray(value)) return [];
  const files = [];
  for (const item of value) {
    if (!isRecord$4(item)) continue;
    if (typeof item.path !== "string") continue;
    if (typeof item.source !== "string" || !FILE_SOURCES$1.has(item.source)) continue;
    files.push({
      path: item.path,
      source: item.source,
      layer: typeof item.layer === "string" ? item.layer : "Other"
    });
  }
  return files;
}
function readAll$4() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(featureViewPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$4(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (!isRecord$4(value)) continue;
    all[repoPath] = {
      name: typeof value.name === "string" ? value.name : "Feature view",
      files: parseFiles(value.files)
    };
  }
  return all;
}
function readFeatureView(repoPath) {
  return readAll$4()[repoPath] ?? null;
}
function sourceByPath(snapshot) {
  const map = /* @__PURE__ */ new Map();
  for (const file of snapshot?.files ?? []) map.set(file.path, file.source);
  return map;
}
function describeFeatureView(repoPath, snapshot) {
  if (!snapshot || snapshot.files.length === 0) {
    return `No feature view computed for ${repoPath} yet. Open the Feature tab in Porcelain (or push a review set with set_feature_review); Porcelain then renders the feature and this snapshot reports every file with its source (changed = in the git diff, context/shipped = the unchanged rest of the feature) and flow layer.`;
  }
  const counts = /* @__PURE__ */ new Map();
  for (const file of snapshot.files) counts.set(file.source, (counts.get(file.source) ?? 0) + 1);
  const breakdown = ["changed", "context", "shipped"].filter((s) => counts.has(s)).map((s) => `${counts.get(s)} ${s}`).join(", ");
  const lines = [];
  let layer = null;
  for (const file of snapshot.files) {
    if (file.layer !== layer) {
      layer = file.layer;
      lines.push(layer);
    }
    lines.push(`  - [${file.source}] ${file.path}`);
  }
  return `Feature view "${snapshot.name}" for ${repoPath}: ${snapshot.files.length} file(s) (${breakdown}). "changed" files are in the git diff; "context"/"shipped" are not (the unchanged or cross-seam rest of the feature). In flow order:
${lines.join("\n")}`;
}
const DEFAULT_LAYERS = [
  { label: "Pages", pattern: "(^|/)(pages|views|screens|app)/" },
  { label: "Components", pattern: "(^|/)components?/" },
  { label: "Hooks", pattern: "(^|/)hooks?/" },
  { label: "Queries", pattern: "(^|/)(queries|mutations|api-client|client)/" },
  { label: "Routes", pattern: "(^|/)(routes?|router|api)/" },
  { label: "Controllers", pattern: "(^|/)controllers?/" },
  { label: "Services", pattern: "(^|/)services?/" },
  { label: "Modules", pattern: "(^|/)modules?/" },
  { label: "Data", pattern: "(^|/)(prisma|schema|models?|entities|repositories)/" },
  { label: "Tests", pattern: "\\.(test|spec)\\.[a-z]+$" }
];
function isRecord$3(value) {
  return typeof value === "object" && value !== null;
}
function isValidPattern(pattern) {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
function layersPath() {
  return process.env.PORCELAIN_LAYERS ?? node_path.join(node_os.homedir(), ".porcelain", "layers.json");
}
function parseLayers(value) {
  if (!Array.isArray(value)) return [];
  const layers = [];
  for (const item of value) {
    if (!isRecord$3(item)) continue;
    const { label, pattern } = item;
    if (typeof label !== "string" || label.trim() === "") continue;
    if (typeof pattern !== "string" || pattern === "" || !isValidPattern(pattern)) continue;
    layers.push({ label, pattern });
  }
  return layers;
}
function readAll$3() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(layersPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$3(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) {
    const layers = parseLayers(value);
    if (layers.length > 0) all[repoPath] = layers;
  }
  return all;
}
function writeAll$1(all) {
  const path = layersPath();
  node_fs.mkdirSync(node_path.dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  node_fs.writeFileSync(tmp, JSON.stringify(all, null, 2));
  node_fs.renameSync(tmp, path);
}
function toLayers(value) {
  if (!Array.isArray(value)) throw new Error("layers must be an array");
  if (value.length === 0) {
    throw new Error("layers must have at least one entry (use reset_flow_layers to clear)");
  }
  return value.map((item, index) => {
    if (!isRecord$3(item)) throw new Error(`layers[${index}] must be an object`);
    const { label, pattern } = item;
    if (typeof label !== "string" || label.trim() === "") {
      throw new Error(`layers[${index}].label must be a non-empty string`);
    }
    if (typeof pattern !== "string" || pattern === "") {
      throw new Error(`layers[${index}].pattern must be a non-empty string`);
    }
    if (!isValidPattern(pattern)) {
      throw new Error(`layers[${index}].pattern is not a valid regular expression`);
    }
    return { label, pattern };
  });
}
function readLayers(repoPath) {
  return readAll$3()[repoPath] ?? null;
}
function setLayers(repoPath, layers) {
  const all = readAll$3();
  all[repoPath] = layers;
  writeAll$1(all);
}
function clearLayers(repoPath) {
  const all = readAll$3();
  if (!(repoPath in all)) return;
  delete all[repoPath];
  writeAll$1(all);
}
const renderList = (layers) => layers.map((l, i) => `  ${i + 1}. ${l.label} — /${l.pattern}/`).join("\n");
function describeLayers(repoPath, layers) {
  if (!layers) {
    return `No custom flow layers for ${repoPath}; Porcelain applies its built-in defaults (entry-point → data):
${renderList(DEFAULT_LAYERS)}

Replace them with set_flow_layers (the full ordered list), tailored to this repo's structure. The defaults as JSON:
${JSON.stringify(DEFAULT_LAYERS, null, 2)}`;
  }
  return `Custom flow layers for ${repoPath} (${layers.length}, entry-point → data):
${renderList(layers)}

Edit by sending the full ordered list to set_flow_layers, or reset_flow_layers to return to the defaults. As JSON:
${JSON.stringify(layers, null, 2)}`;
}
function isRecord$2(value) {
  return typeof value === "object" && value !== null;
}
function notesPath() {
  return process.env.PORCELAIN_NOTES ?? node_path.join(node_os.homedir(), ".porcelain", "notes.json");
}
function readAll$2() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(notesPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$2(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (typeof value === "string") all[repoPath] = value;
  }
  return all;
}
function readNotes(repoPath) {
  return readAll$2()[repoPath] ?? "";
}
function describeNotes(repoPath, notes) {
  if (notes.trim() === "") {
    return `No project notes for ${repoPath}. The human keeps a freeform per-repo notes scratchpad in Porcelain (Files → Notes); when they write in it, it shows up here as project context.`;
  }
  return `Project notes for ${repoPath} (the human's freeform scratchpad):

${notes}`;
}
const FILE_SOURCES = /* @__PURE__ */ new Set(["changed", "context", "shipped"]);
function isRecord$1(value) {
  return typeof value === "object" && value !== null;
}
function reviewSetsPath() {
  return process.env.PORCELAIN_REVIEW_SETS ?? node_path.join(node_os.homedir(), ".porcelain", "review-sets.json");
}
function toReviewFiles(value) {
  if (!Array.isArray(value)) throw new Error("files must be an array");
  return value.map((item, index) => {
    if (!isRecord$1(item)) throw new Error(`files[${index}] must be an object`);
    const path = item.path;
    if (typeof path !== "string" || path.length === 0) {
      throw new Error(`files[${index}].path must be a non-empty string`);
    }
    const file = { path };
    if (typeof item.source === "string") {
      if (!FILE_SOURCES.has(item.source)) {
        throw new Error(`files[${index}].source must be one of changed|context|shipped`);
      }
      file.source = item.source;
    }
    if (typeof item.note === "string") file.note = item.note;
    if (typeof item.layer === "string") file.layer = item.layer;
    return file;
  });
}
function parseReviewFiles(value) {
  if (!Array.isArray(value)) return [];
  const files = [];
  for (const item of value) {
    if (!isRecord$1(item) || typeof item.path !== "string") continue;
    const file = { path: item.path };
    if (typeof item.source === "string" && FILE_SOURCES.has(item.source)) file.source = item.source;
    if (typeof item.note === "string") file.note = item.note;
    if (typeof item.layer === "string") file.layer = item.layer;
    files.push(file);
  }
  return files;
}
function mergeReviewFiles(existing, incoming) {
  const byPath = new Map(existing.map((file) => [file.path, file]));
  for (const file of incoming) byPath.set(file.path, file);
  return [...byPath.values()];
}
function readAll$1() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(reviewSetsPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord$1(parsed)) return {};
  const sets = {};
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (!isRecord$1(value)) continue;
    sets[repoPath] = {
      name: typeof value.name === "string" ? value.name : "Feature view",
      files: parseReviewFiles(value.files)
    };
  }
  return sets;
}
function writeAll(sets) {
  const path = reviewSetsPath();
  node_fs.mkdirSync(node_path.dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  node_fs.writeFileSync(tmp, JSON.stringify(sets, null, 2));
  node_fs.renameSync(tmp, path);
}
function setReview(repoPath, name, files) {
  const sets = readAll$1();
  sets[repoPath] = { name, files };
  writeAll(sets);
}
function addReviewFiles(repoPath, files) {
  const sets = readAll$1();
  const current = sets[repoPath] ?? { name: "Feature view", files: [] };
  const merged = mergeReviewFiles(current.files, files);
  sets[repoPath] = { name: current.name, files: merged };
  writeAll(sets);
  return merged.length;
}
function clearReview(repoPath) {
  const sets = readAll$1();
  if (!(repoPath in sets)) return;
  delete sets[repoPath];
  writeAll(sets);
}
function readReview(repoPath) {
  return readAll$1()[repoPath] ?? null;
}
function describeReview(repoPath, review) {
  if (!review || review.files.length === 0) {
    return `No feature review set for ${repoPath}. Porcelain shows the static baseline (changed files plus the unchanged files they import). Use set_feature_review to define one.`;
  }
  const counts = /* @__PURE__ */ new Map();
  for (const file of review.files) {
    const key = file.source ?? "auto-detected";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()].map(([source, n]) => `${n} ${source}`).join(", ");
  const json = JSON.stringify(review.files, null, 2);
  return `Feature review "${review.name}" for ${repoPath}: ${review.files.length} file(s) (${breakdown}). Working-tree files render as "changed" regardless of declared source.
${json}`;
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function reviewedPath() {
  return process.env.PORCELAIN_REVIEWED ?? node_path.join(node_os.homedir(), ".porcelain", "reviewed.json");
}
function readAll() {
  let parsed;
  try {
    parsed = JSON.parse(node_fs.readFileSync(reviewedPath(), "utf8"));
  } catch {
    return {};
  }
  if (!isRecord(parsed)) return {};
  const all = {};
  for (const [repoPath, value] of Object.entries(parsed)) {
    if (Array.isArray(value))
      all[repoPath] = value.filter((p) => typeof p === "string");
  }
  return all;
}
function readReviewed(repoPath) {
  return readAll()[repoPath] ?? [];
}
function describeReviewed(repoPath, paths) {
  if (paths.length === 0) {
    return `No files marked reviewed for ${repoPath}. The human checks off files as they review them in Porcelain (the Changes / Feature lists); changed files that aren't checked off are still unreviewed. The marks describe the working tree and reset when changes are committed.`;
  }
  const list = paths.map((path) => `- ${path}`).join("\n");
  return `${paths.length} file(s) marked reviewed by the human for ${repoPath} (any other changed file is still unreviewed; marks reset on commit):
${list}`;
}
function asString(value) {
  return typeof value === "string" ? value : void 0;
}
async function callTool(name, args) {
  const repoPath = asString(args.repoPath);
  if (!repoPath) throw new Error("repoPath is required");
  if (name === "set_feature_review") {
    const reviewName = asString(args.name) ?? "Feature view";
    const files = toReviewFiles(args.files);
    setReview(repoPath, reviewName, files);
    return `Set feature review "${reviewName}" (${files.length} files) for ${repoPath}`;
  }
  if (name === "add_review_files") {
    const files = toReviewFiles(args.files);
    const total = addReviewFiles(repoPath, files);
    return `Added ${files.length} file(s); the feature review now has ${total} for ${repoPath}`;
  }
  if (name === "clear_feature_review") {
    clearReview(repoPath);
    return `Cleared the feature review for ${repoPath}`;
  }
  if (name === "get_feature_review") {
    return describeReview(repoPath, readReview(repoPath));
  }
  if (name === "get_feature_view") {
    return describeFeatureView(repoPath, readFeatureView(repoPath));
  }
  if (name === "get_review_comments") {
    return describeComments(
      repoPath,
      readComments(repoPath),
      sourceByPath(readFeatureView(repoPath))
    );
  }
  if (name === "resolve_review_comment") {
    const id = asString(args.id);
    if (!id) throw new Error("id is required");
    return resolveComment(repoPath, id) ? `Resolved comment ${id} for ${repoPath}` : `No open comment ${id} for ${repoPath}`;
  }
  if (name === "get_reviewed_files") {
    return describeReviewed(repoPath, readReviewed(repoPath));
  }
  if (name === "set_feature_artifact") {
    const artifact = setArtifact(repoPath, args.title, args.html);
    return `Set feature artifact "${artifact.title}" for ${repoPath}. Porcelain renders it in a fully sandboxed iframe (no scripts, no external loads).`;
  }
  if (name === "get_feature_artifact") {
    return describeArtifact(repoPath, getArtifact(repoPath));
  }
  if (name === "clear_feature_artifact") {
    clearArtifact(repoPath);
    return `Cleared the feature artifact for ${repoPath}`;
  }
  if (name === "list_cards") {
    return describeBoard(repoPath, readCards(repoPath));
  }
  if (name === "create_card") {
    const title = asString(args.title);
    if (!title) throw new Error("title is required");
    const status = normalizeStatus(args.status) ?? "todo";
    const card = createCard(repoPath, title, asString(args.body), status);
    return `Created card ${card.id} "${title}" in ${status} for ${repoPath}`;
  }
  if (name === "update_card") {
    const id = asString(args.id);
    if (!id) throw new Error("id is required");
    const found = updateCard(repoPath, id, {
      title: asString(args.title),
      body: asString(args.body)
    });
    return found ? `Updated card ${id} for ${repoPath}` : `No card ${id} for ${repoPath}`;
  }
  if (name === "move_card") {
    const id = asString(args.id);
    if (!id) throw new Error("id is required");
    const status = normalizeStatus(args.status);
    if (!status) throw new Error("status must be one of todo|doing|done");
    return moveCard(repoPath, id, status) ? `Moved card ${id} to ${status} for ${repoPath}` : `No card ${id} for ${repoPath}`;
  }
  if (name === "delete_card") {
    const id = asString(args.id);
    if (!id) throw new Error("id is required");
    return deleteCard(repoPath, id) ? `Deleted card ${id} for ${repoPath}` : `No card ${id} for ${repoPath}`;
  }
  if (name === "list_actions") {
    return describeActions(repoPath, readActions(repoPath));
  }
  if (name === "create_action") {
    const title = asString(args.title);
    const command = asString(args.command);
    if (!title) throw new Error("title is required");
    if (!command) throw new Error("command is required");
    const action = createAction(repoPath, title, command, asString(args.cwd));
    return `Created action ${action.id} "${title}" for ${repoPath}`;
  }
  if (name === "update_action") {
    const id = asString(args.id);
    if (!id) throw new Error("id is required");
    const found = updateAction(repoPath, id, {
      title: asString(args.title),
      command: asString(args.command),
      cwd: asString(args.cwd)
    });
    return found ? `Updated action ${id} for ${repoPath}` : `No action ${id} for ${repoPath}`;
  }
  if (name === "delete_action") {
    const id = asString(args.id);
    if (!id) throw new Error("id is required");
    return deleteAction(repoPath, id) ? `Deleted action ${id} for ${repoPath}` : `No action ${id} for ${repoPath}`;
  }
  if (name === "get_repo_notes") {
    return describeNotes(repoPath, readNotes(repoPath));
  }
  if (name === "get_flow_layers") {
    return describeLayers(repoPath, readLayers(repoPath));
  }
  if (name === "set_flow_layers") {
    const layers = toLayers(args.layers);
    setLayers(repoPath, layers);
    return `Set ${layers.length} flow layer(s) for ${repoPath}: ${layers.map((l) => l.label).join(" → ")}`;
  }
  if (name === "reset_flow_layers") {
    clearLayers(repoPath);
    return `Reset flow layers to the built-in defaults for ${repoPath}`;
  }
  throw new Error(`unknown tool: ${name}`);
}
async function processLine(line) {
  const trimmed = line.trim();
  if (trimmed === "") return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return;
  }
  try {
    const response = await handleRpc(message, callTool);
    if (response) process.stdout.write(`${JSON.stringify(response)}
`);
  } catch (error) {
    process.stderr.write(
      `porcelain-mcp: ${error instanceof Error ? error.message : String(error)}
`
    );
  }
}
let chain = Promise.resolve();
const rl = node_readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  chain = chain.then(() => processLine(line));
});
