#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { download } from "./downloader";
import { checkYtDlp, getYtvOutputDir, isValidYouTubeUrl } from "./utils";
import { initUI, markDone, markError, updateProgress } from "./ui";
import type { DownloadMode } from "./types";

async function main() {
  const outputDir = getYtvOutputDir();

  try {
    await checkYtDlp();
  } catch (err) {
    console.error(
      "\n❌  yt-dlp not found.\n\n" +
        "   Install it first:\n" +
        "   • macOS:   brew install yt-dlp\n" +
        "   • Linux:   sudo apt install yt-dlp  OR  pip install yt-dlp\n" +
        "   • Windows: winget install yt-dlp\n",
    );
    process.exit(1);
  }

  await mkdir(outputDir, { recursive: true });

  await initUI(async (url: string, mode: DownloadMode, quality: string) => {
    if (!isValidYouTubeUrl(url)) {
      markError(
        "Invalid YouTube URL. Use youtube.com/watch?v=... or youtu.be/...",
      );
      return;
    }

    const result = await download(
      url,
      mode,
      outputDir,
      updateProgress,
      quality,
    );
    if (result.success) {
      markDone(result.outputPath ?? outputDir);
    } else {
      markError(result.error ?? "Download failed");
    }
  });
}

main().catch((_error) => {
  console.error("Failed to start the program");
  process.exit(1);
});
