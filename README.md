# ytdl-tui

A terminal YouTube downloader with a clean TUI — pick your format, pick your quality, paste a URL and watch it download. No browser, no GUI, no fuss.

Built with [Bun](https://bun.sh), [TypeScript](https://www.typescriptlang.org), and [OpenTUI](https://github.com/max5555/opentui).

---

## Features

- Download video (MP4) or audio only (MP3)
- Quality selection — Best, 1080p, 720p, 480p
- Live progress bar with speed and ETA
- Keyboard-driven UI, no mouse needed
- Downloads saved to `~/Downloads/ytv/`

---

## Requirements

**yt-dlp** must be installed on your system:

```bash
# macOS
brew install yt-dlp

# Linux
sudo apt install yt-dlp
# or
pip install yt-dlp

# Windows
winget install yt-dlp
```

**Bun** runtime:

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Install

```bash
bunx ytdl-tui
```

Or install globally:

```bash
bun install -g ytdl-tui
ytdl-tui
```

---

## Usage

```
┌──────────────────────────────────────────┐
│  URL input                               │
├─────────────────┬────────────────────────┤
│  Mode           │  Quality               │
├─────────────────┴────────────────────────┤
│  Progress / Result                       │
├──────────────────────────────────────────┤
│  Hints                                   │
└──────────────────────────────────────────┘
```

1. Paste a YouTube URL into the URL field
2. Press `Enter` to move to Mode selection
3. Pick `Video + Audio` or `Audio Only` with arrow keys
4. If video, press `Enter` or `Tab` to move to Quality
5. Press `Enter` on your chosen quality to start the download
6. File saves to `~/Downloads/ytv/`

**Keyboard shortcuts:**

| Key         | Action              |
| ----------- | ------------------- |
| `Tab`       | Move focus forward  |
| `Shift+Tab` | Move focus backward |
| `↑ / ↓`     | Navigate options    |
| `Enter`     | Confirm / download  |
| `Ctrl+C`    | Quit                |

---

## Tech Stack

- [Bun](https://bun.sh) — runtime and package manager
- [TypeScript](https://www.typescriptlang.org) — language
- [OpenTUI](https://github.com/max5555/opentui) — terminal UI framework
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — download engine

---

## License

MIT
