import { homedir } from "node:os";
import { join } from "node:path";

async function checkYtDlp(): Promise<void> {
  const proc = Bun.spawn(["yt-dlp", "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(
      "yt-dlp not found. Install it with:\n  brew install yt-dlp   (macOS)\n  pip install yt-dlp    (Python)",
    );
  }
}

function isValidYouTubeUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https?:\/\/(www\.)?(youtube\.com\/watch\?.*v=|youtu\.be\/)/.test(
    trimmed,
  );
}

function getUserDownloadsDir(): string {
  // Linux desktop environments can expose a custom Downloads location via XDG.
  const xdgDownloadDir = process.env.XDG_DOWNLOAD_DIR?.trim();
  if (xdgDownloadDir) {
    const expanded =
      xdgDownloadDir === "$HOME" || xdgDownloadDir.startsWith("$HOME/")
        ? xdgDownloadDir.replace("$HOME", homedir())
        : xdgDownloadDir;
    return expanded;
  }

  return join(homedir(), "Downloads");
}

function getYtvOutputDir(): string {
  return join(getUserDownloadsDir(), "ytv");
}

export { checkYtDlp, isValidYouTubeUrl, getYtvOutputDir };
