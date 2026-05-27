type DownloadMode = "video" | "audio";

type FocusArea = "url" | "modes" | "quality";

type ResolutionOptions = "best" | "1080" | "720" | "480";

interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  size: string;
  filename: string;
}

interface DownloadResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}

export type {
  FocusArea,
  DownloadMode,
  DownloadProgress,
  DownloadResult,
  ResolutionOptions,
};
