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

/** Prefer HLS (m3u8) — YouTube DASH https streams often return HTTP 403. */
function videoFormatForQuality(quality: string): string {
  const qualityMap: Record<string, string> = {
    best: "best[protocol^=m3u8]/bestvideo*+bestaudio/best",
    "1080":
      "best[height<=1080][protocol^=m3u8]/bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    "720":
      "best[height<=720][protocol^=m3u8]/bestvideo[height<=720]+bestaudio/best[height<=720]",
    "480":
      "best[height<=480][protocol^=m3u8]/bestvideo[height<=480]+bestaudio/best[height<=480]",
  };

  return qualityMap[quality] ?? qualityMap["best"]!;
}

function buildArgs(
  url: string,
  mode: DownloadMode,
  outputDir: string,
  quality: string = "best",
): string[] {
  const output = `${outputDir}/%(title)s.%(ext)s`;

  const common = [
    "-o",
    output,
    "--no-warnings",
    "--progress",
    "--retries",
    "10",
    "--fragment-retries",
    "10",
    "--js-runtimes",
    "deno",
  ];

  if (mode === "audio") {
    return [
      "-f",
      // DASH audio often 403s; check formats first, then fall back to HLS and extract.
      "bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/best[height<=360][protocol^=m3u8]/bestaudio/best",
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "--check-formats",
      ...common,
      url,
    ];
  }

  return [
    "-f",
    videoFormatForQuality(quality),
    "--merge-output-format",
    "mp4",
    ...common,
    url,
  ];
}

export { download };
