// ─────────────────────────────────────────────
// ui.ts  —  Single-screen, 2D grid layout
//
// ┌──────────────────────────────────────────┐
// │  Header                                  │
// ├──────────────────────────────────────────┤
// │  URL input          (full width)         │
// ├─────────────────┬────────────────────────┤
// │  Modes (left)   │  Quality (right)       │
// ├─────────────────┴────────────────────────┤
// │  Result / Progress  (full width)         │
// ├──────────────────────────────────────────┤
// │  Hint bar                                │
// └──────────────────────────────────────────┘

import {
  createCliRenderer,
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  SelectRenderable,
} from "@opentui/core";
import type {
  DownloadMode,
  DownloadProgress,
  FocusArea,
  ResolutionOptions,
} from "./types";
import { COLORS } from "./colors";

// type FocusSlot = "url" | "modes" | "quality";
type Phase = "idle" | "downloading" | "done" | "error";

const state = {
  focus: "url" as FocusArea,
  phase: "idle" as Phase,
};

const FOCUS_CYCLE: FocusArea[] = ["url", "modes", "quality"];

let selectedModeIndex: number = 0;
let selectedQualityIndex: number = 0;

const MODE_OPTIONS: DownloadMode[] = ["video", "audio"];
const QUALITY_OPTIONS: ResolutionOptions[] = ["best", "1080", "720", "480"];

let renderer: Awaited<ReturnType<typeof createCliRenderer>>;
let urlInputRef: InputRenderable;
let modeSelectRef: SelectRenderable;
let qualitySelectRef: SelectRenderable;

const panels: Record<FocusArea, BoxRenderable | null> = {
  url: null,
  modes: null,
  quality: null,
};

let resultLine1: TextRenderable | null = null;
let resultLine2: TextRenderable | null = null;
let resultLine3: TextRenderable | null = null;
let hintText: TextRenderable | null = null;

let onDownload: (
  url: string,
  mode: DownloadMode,
  quality: string,
) => void = () => {};

export async function initUI(
  downloadCb: (url: string, mode: DownloadMode, quality: string) => void,
): Promise<typeof renderer> {
  onDownload = downloadCb;

  renderer = await createCliRenderer({ exitOnCtrlC: false });

  renderer.keyInput.on("keypress", (key) => {
    if (key.ctrl && key.name === "c") {
      const root = renderer.root as unknown as {
        children?: { remove(): void }[];
      };

      for (const c of [...(root.children ?? [])]) {
        try {
          c.remove();
        } catch {
          console.error("Failed to remove child");
        }
      }

      renderer.root.add(
        new BoxRenderable(renderer, {
          id: "bye",
          padding: 2,
          backgroundColor: COLORS.bg,
        }),
      );

      const byeBox = renderer.root.getChildren?.()[0] as
        | BoxRenderable
        | undefined;
      byeBox?.add(
        new TextRenderable(renderer, {
          id: "bye-text",
          content: "Goodbye! 👋",
          fg: COLORS.textDark,
        }),
      );

      setTimeout(() => process.exit(0), 600);
    }
  });

  buildScreen();

  return renderer;
}

export function updateProgress(p: DownloadProgress): void {
  if (resultLine1)
    resultLine1.content = ` Downloading... ${p.percent.toFixed(1)}%`;

  if (resultLine2) resultLine2.content = makeBar(p.percent);
  if (resultLine3)
    resultLine3.content = ` ${p.size} · ${p.speed} ·  ETA ${p.eta} · ${p.filename} `;
}

export function markDone(outputPath: string): void {
  state.phase = "done";
  if (resultLine1) {
    resultLine1.content = " ✅ Success: download complete";
    resultLine1.fg = COLORS.success;
  }
  if (resultLine2) resultLine2.content = makeBar(100);
  if (resultLine3) resultLine3.content = `  Saved to: ${trunc(outputPath, 55)}`;
  if (hintText)
    hintText.content = "  Enter to download another, Ctrl+C to quit";

  const handler = (key: { name: string }) => {
    if (key.name === "return") {
      renderer.keyInput.off("keypress", handler);
      resetToIdle();
    }
  };
  renderer.keyInput.on("keypress", handler);

  // state.focus = "url";
  // applyFocus();
}

export function markError(msg: string): void {
  state.phase = "error";
  if (resultLine1) {
    resultLine1.content = "  Error: download failed";
    resultLine1.fg = COLORS.error;
  }
  if (resultLine2) resultLine2.content = makeBar(0);
  if (resultLine3) resultLine3.content = `  ${trunc(msg, 58)}`;
  if (hintText) hintText.content = "  Enter to try again, Ctrl+C to quit";

  const handler = (key: { name: string }) => {
    if (key.name === "return") {
      renderer.keyInput.off("keypress", handler);
      resetToIdle();
    }
  };

  renderer.keyInput.on("keypress", handler);
  // state.focus = "url";
  // applyFocus();
}

function buildScreen(): void {
  const W = "100%";
  const LEFT_W = "49%";
  const RIGHT_W = "49%";

  const urlPanel = new BoxRenderable(renderer, {
    id: "url-panel",
    title: "URL",
    flexDirection: "column",
    gap: 1,
    paddingLeft: 2,
    paddingRight: 2,
    width: W,
    borderStyle: "rounded",
    borderColor: COLORS.dim,
  });

  urlInputRef = new InputRenderable(renderer, {
    id: "url-input",
    placeholder: "https://youtube.com/watch?v=...",
    width: W,
    textColor: COLORS.text,
    cursorColor: COLORS.cursorColor,

    onKeyDown: (key) => {
      if (key.name === "tab") {
        cycleFocus(key.shift ? -1 : 1);
        return;
      }

      if (key.name === "return") cycleFocus(1);
    },
  });

  urlPanel.add(urlInputRef);
  panels.url = urlPanel;

  const modesPanel = new BoxRenderable(renderer, {
    id: "modes-panel",
    flexDirection: "column",
    gap: 1,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 1,
    paddingBottom: 1,
    width: LEFT_W,
    borderStyle: "rounded",
    borderColor: COLORS.border,
    title: "Mode",
  });

  modeSelectRef = new SelectRenderable(renderer, {
    id: "modes-select",
    width: W,
    height: 4,
    options: [
      {
        name: " ▶  Video + Audio",
        description: "MP4 - best quality",
        value: "video",
      },
      {
        name: "♫  Audio Only",
        description: "MP3 - music/podcasts",
        value: "audio",
      },
    ],
    focusedBackgroundColor: COLORS.bgFoc,
    selectedBackgroundColor: COLORS.dim,
    selectedTextColor: COLORS.text,
    focusedTextColor: COLORS.text,
    textColor: COLORS.textDark,
    descriptionColor: COLORS.muted,
    selectedDescriptionColor: COLORS.muted,
    showDescription: true,
    onKeyDown: (key) => {
      if (key.name === "up") {
        selectedModeIndex = Math.max(0, selectedModeIndex - 1);
      }

      if (key.name === "down") {
        selectedModeIndex = Math.min(
          MODE_OPTIONS.length - 1,
          selectedModeIndex + 1,
        );
      }

      if (key.name === "tab") {
        cycleFocus(key.shift ? -1 : 1);
        return;
      }

      if (key.name === "return" && state.phase === "idle") {
        if (MODE_OPTIONS[selectedModeIndex] === "audio") {
          triggerDownload();
          return;
        }

        cycleFocus(1);
      }
    },
  });

  modesPanel.add(modeSelectRef);
  panels.modes = modesPanel;

  const qualityPanel = new BoxRenderable(renderer, {
    id: "quality-panel",
    title: "Quality",
    flexDirection: "column",
    gap: 1,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 1,
    paddingBottom: 1,
    width: RIGHT_W,
    borderStyle: "rounded",
    borderColor: COLORS.border,
  });

  qualitySelectRef = new SelectRenderable(renderer, {
    id: "quality-select",
    width: W,
    height: 5,
    options: [
      {
        name: "  ◈  Best",
        description: "Highest available resolution",
        value: "best",
      },
      { name: "  ◉  1080p", description: "Full HD", value: "1080" },
      { name: "  ○  720p", description: "HD", value: "720" },
      { name: "  ·  480p", description: "Standard", value: "480" },
    ],
    focusedBackgroundColor: COLORS.bgFoc,
    selectedBackgroundColor: COLORS.dim,
    selectedTextColor: COLORS.text,
    focusedTextColor: COLORS.text,
    textColor: COLORS.dim,
    descriptionColor: COLORS.muted,
    selectedDescriptionColor: COLORS.muted,
    showDescription: true,
    onKeyDown: (key) => {
      if (key.name === "up") {
        selectedQualityIndex = Math.max(0, selectedQualityIndex - 1);
      }

      if (key.name === "down") {
        selectedQualityIndex = Math.min(
          QUALITY_OPTIONS.length - 1,
          selectedQualityIndex + 1,
        );
      }
      if (key.name === "tab") {
        cycleFocus(key.shift ? -1 : 1);

        return;
      }

      if (key.name === "return" && state.phase === "idle") {
        triggerDownload();
      }
    },
  });

  qualityPanel.add(qualitySelectRef);

  panels.quality = qualityPanel;

  const midRow = new BoxRenderable(renderer, {
    id: "mid-row",
    flexDirection: "row",
    gap: 2,
    width: W,
  });

  midRow.add(modesPanel);
  midRow.add(qualityPanel);

  const resultPanel = new BoxRenderable(renderer, {
    id: "result-panel",
    title: "Result",
    flexDirection: "column",
    gap: 1,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 1,
    paddingBottom: 1,
    width: W,
    height: 7,
    borderStyle: "rounded",
    borderColor: COLORS.border,
  });

  resultLine1 = new TextRenderable(renderer, {
    id: "r1",
    content: "  Waiting — paste a URL and press Enter on a quality to download",
    fg: COLORS.muted,
  });
  resultLine2 = new TextRenderable(renderer, {
    id: "r2",
    content: makeBar(0),
    fg: COLORS.muted,
  });
  resultLine3 = new TextRenderable(renderer, {
    id: "r3",
    content: "",
    fg: COLORS.muted,
  });

  resultPanel.add(resultLine1);
  resultPanel.add(resultLine2);
  resultPanel.add(resultLine3);

  // ── Hint bar ─────────────────────────────
  const hintBar = new BoxRenderable(renderer, {
    id: "hint-bar",
    title: "Hints",
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 0,
    paddingBottom: 0,
    width: W,
  });
  hintText = new TextRenderable(renderer, {
    id: "hint",
    content:
      "  Tab → move focus   |   Enter in URL → next   |    Enter on Audio mode or Quality → download",
    fg: COLORS.muted,
  });
  hintBar.add(hintText);

  const root = new BoxRenderable(renderer, {
    id: "root-wrap",
    flexDirection: "column",
    gap: 1,
    padding: 1,
    width: W,
    height: "100%",
    borderColor: COLORS.dim,
    title: "YTV-Downloader",
    borderStyle: "rounded",
  });

  root.add(urlPanel);
  root.add(midRow);
  root.add(resultPanel);
  root.add(hintBar);
  renderer.root.add(root);

  urlInputRef.focus();
}

function cycleFocus(dir: 1 | -1): void {
  const i = FOCUS_CYCLE.indexOf(state.focus);
  state.focus =
    FOCUS_CYCLE[(i + dir + FOCUS_CYCLE.length) % FOCUS_CYCLE.length]!;
  applyFocus();
}

function applyFocus(): void {
  urlInputRef.blur();
  modeSelectRef.blur();
  qualitySelectRef.blur();

  for (const slot of FOCUS_CYCLE) {
    const p = panels[slot];
    if (p) p.borderColor = COLORS.border;
  }

  const activePanel = panels[state.focus];
  if (activePanel) {
    activePanel.borderColor = COLORS.borderFoc;
  }

  if (state.focus === "url") urlInputRef.focus();
  if (state.focus === "modes") modeSelectRef.focus();
  if (state.focus === "quality") qualitySelectRef.focus();

  if (state.phase === "idle" && hintText) {
    const hints: Record<FocusArea, string> = {
      url: "  Type/paste YouTube URL · Enter → jump to Modes · Tab → next",
      modes:
        "  ↑/k  ↓/j to pick mode · Enter on Audio → download · Enter on Video/Tab → Quality",
      quality: "  ↑/k ↓/j to pick quality · Enter → start download · Tab → URL",
    };
    hintText.content = hints[state.focus]!;
  }
}

function triggerDownload(): void {
  const url = urlInputRef.value.trim() ?? "";

  if (!url) {
    if (resultLine1) {
      resultLine1.content =
        "  ✗  URL is empty — Tab to URL panel and paste a link.";
      resultLine1.fg = COLORS.error;
    }
    state.focus = "url";
    urlInputRef.value = "";
    applyFocus();
    return;
  }

  const mode = MODE_OPTIONS[selectedModeIndex] ?? "video";
  const quality = QUALITY_OPTIONS[selectedQualityIndex] ?? "best";

  state.phase = "downloading";

  if (resultLine1) {
    resultLine1.content = "  Starting download...";
    resultLine1.fg = COLORS.dim;
  }
  if (resultLine2) resultLine2.content = makeBar(0);
  if (resultLine3) resultLine3.content = "";
  if (hintText)
    hintText.content = "  Downloading — please wait…   Ctrl+C → cancel";

  onDownload(url, mode, quality);
}

function resetToIdle(): void {
  state.phase = "idle";

  // urlInputRef.value = "";

  // selectedModeIndex = 0;
  // selectedQualityIndex = 0;
  if (resultLine1) {
    resultLine1.content =
      "  Waiting — paste a URL and press Enter on a quality to download";
    resultLine1.fg = COLORS.muted;
  }
  if (resultLine2) resultLine2.content = makeBar(0);
  if (resultLine3) resultLine3.content = "";

  state.focus = "url";
  applyFocus();
}

function makeBar(pct: number): string {
  const W = 62;
  const filled = Math.round((Math.min(pct, 100) / 100) * W);

  return `  ${"█".repeat(filled)}${"░".repeat(W - filled)}  ${pct.toFixed(1)}%`;
}

function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
