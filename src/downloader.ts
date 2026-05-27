import { spawn } from "bun";
import type { DownloadMode, DownloadProgress, DownloadResult } from "./types";

function download(
  url: string,
  mode: DownloadMode,
  outputDir: string = "./downloads",
  onProgress: (progress: DownloadProgress) => void,
  quality: string = "best",
): Promise<DownloadResult> {
  return new Promise((resolve) => {
    const args = buildArgs(url, mode, outputDir, quality);
    const proc = spawn(["yt-dlp", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let lastFilename = "";
    let combinedOutput = "";

    const readStdout = readLines(proc.stdout, (line) => {
      combinedOutput += `${line}\n`;
      const destMatch = line.match(/\[download\] Destination: (.+)/);
      if (destMatch?.[1]) {
        lastFilename = destMatch[1].trim();
      }

      const progress = parseProgressLine(line, lastFilename);
      if (progress) {
        onProgress(progress);
      }
    });

    const readStderr = readLines(proc.stderr, (line) => {
      combinedOutput += `${line}\n`;
      const progress = parseProgressLine(line, lastFilename);
      if (progress) {
        onProgress(progress);
      }
    });

    (async () => {
      try {
        const code = await proc.exited;
        await Promise.all([readStdout, readStderr]);

        if (code === 0) {
          resolve({ success: true, outputPath: lastFilename || outputDir });
        } else {
          resolve({ success: false, error: extractError(combinedOutput) });
        }
      } catch (err) {
        resolve({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  });
}

async function readLines(
  stream: ReadableStream<Uint8Array> | null,
  onLine: (line: string) => void,
): Promise<void> {
  if (!stream) return;

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    pending += decoder.decode(value, { stream: true });
    // yt-dlp frequently updates progress using carriage returns.
    const parts = pending.split(/[\r\n]+/);
    pending = parts.pop() ?? "";

    for (const line of parts) onLine(line);
  }

  pending += decoder.decode();
  if (pending) onLine(pending);
}

function parseProgressLine(
  line: string,
  filename: string,
): DownloadProgress | null {
  if (!line.includes("[download]")) return null;

  const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
  if (!percentMatch?.[1]) return null;

  // Handles variants like:
  // - "of 50.10MiB at 1.20MiB/s ETA 00:10"
  // - "of ~ 50.10MiB at 1.20MiB/s ETA 00:10"
  // - "ETA Unknown"
  const sizeMatch = line.match(/of\s+(.+?)\s+at\b/);
  const speedMatch = line.match(/\sat\s+(.+?)\s+ETA\b/);
  const etaMatch = line.match(/ETA\s+(.+)$/);

  return {
    percent: Number(percentMatch[1]),
    size: sizeMatch?.[1]?.trim() ?? "unknown",
    speed: speedMatch?.[1]?.trim() ?? "unknown",
    eta: etaMatch?.[1]?.trim() ?? "--:--",
    filename: filename || "unknown",
  };
}

function extractError(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const lastError =
    [...lines].reverse().find((line) => /error|failed/i.test(line)) ??
    lines.at(-1);

  return lastError || "Download failed";
}

function buildArgs(
  url: string,
  mode: DownloadMode,
  outputDir: string,
  quality: string = "best",
): string[] {
  const output = `${outputDir}/%(title)s.%(ext)s`;

  if (mode === "audio") {
    return [
      "-f",
      "bestaudio/best",
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "-o",
      output,
      "--no-warnings",
      "--progress",
      url,
    ];
  }

  // Build video format string based on quality selection
  const qualityMap: Record<string, string> = {
    best: "bestvideo+bestaudio/best",
    "1080": "bestvideo[height=1080]+bestaudio/best[height<=1080]",
    "720": "bestvideo[height=720]+bestaudio/best[height<=720]",
    "480": "bestvideo[height=480]+bestaudio/best[height<=480]",
  };

  const fmt = qualityMap[quality] ?? qualityMap["best"]!;

  return [
    "-f",
    fmt,
    "--merge-output-format",
    "mp4",
    "-o",
    output,
    "--no-warnings",
    "--progress",
    url,
  ];
}

export { download };
