import {
  podcasts,
  podcastStatusEnum,
  deepDiveOptionEnum,
} from '../../db/schema';
import { InferSelectModel } from 'drizzle-orm';

// Define the possible statuses from the schema enum
export type PodcastStatus = (typeof podcastStatusEnum.enumValues)[number];

// Define the possible deep dive options from the schema enum
export type DeepDiveOption = (typeof deepDiveOptionEnum.enumValues)[number];

// Define the structure for the podcast data based on the Drizzle schema model
// This represents the full record in the database.
export type PodcastDbModel = InferSelectModel<typeof podcasts>;

// Define the structure for the podcast data returned in the API
// This might omit certain fields or have slightly different typing for API consumers.
export interface PodcastApiResponse {
  id: number;
  userId: number;
  url: string;
  deepDiveOption: DeepDiveOption;
  status: PodcastStatus;
  errorMessage: string | null;
  errorStep: string | null;
  createdAt: Date;
  updatedAt: Date;
  title: string | null;
  summary: Record<string, any> | null; // Keep as object for JSONB
  transcript: Record<string, any> | null; // Keep as object for JSONB
  audioUrl: string | null;
  jobMetadata: Record<string, any> | null; // Keep as object for JSONB
}

// --- Event Payloads --- //

export interface PodcastRequestedPayload {
  jobId: number;
  url: string;
  userId: number;
  deepDiveOption: DeepDiveOption;
}

export interface PodcastScrapedPayload {
  jobId: number;
  title: string;
  bodyText: string;
  userId: number;
  deepDiveOption: DeepDiveOption;
}

// Define structure expected from LLM for dialogue/transcript
// Adapt this based on the actual output structure of your LlmService
export interface LlmDialogue {
  segments: Array<{ text: string; speaker: string }>;
  // potentially other fields like overall tone, etc.
}

// Define structure expected from LLM for summary
// Adapt this based on the actual output structure of your LlmService
export interface LlmSummary {
  title: string;
  estimatedDurationMinutes: number;
  keyTopics: string[];
  summaryText: string;
  // potentially other fields
}

export interface PodcastContentGeneratedPayload {
  jobId: number;
  // Assuming llmService returns structured objects
  summary: LlmSummary; // Persisted in the 'summary' JSONB column
  dialogue: LlmDialogue; // Persisted in the 'transcript' JSONB column
  userId: number;
}

export interface PodcastSegmentAudioRequestedPayload {
  jobId: number;
  segmentIndex: number;
  segmentText: string;
  segmentSpeaker: string;
  totalSegments: number;
  userId: number; // Pass userId if needed by TTS or storage
}

export interface PodcastSegmentAudioGeneratedPayload {
  jobId: number;
  segmentIndex: number;
  totalSegments: number;
  audioBuffer?: Buffer; // If listener holds buffers in memory (use with caution)
  // OR
  tempAudioPath?: string; // If listener writes segments to temp files
}

export interface PodcastAllAudioGeneratedPayload {
  jobId: number;
  userId: number; // Pass userId if needed by stitching/upload
}

export interface PodcastCompletedPayload {
  jobId: number;
  finalPodcastRecord: PodcastDbModel; // The final state from the DB
}

export interface PodcastFailedPayload {
  jobId: number;
  failedStep: PodcastStatus; // Status *before* FAILED was set
  errorMessage: string;
}
