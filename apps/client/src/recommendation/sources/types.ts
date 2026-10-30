import type { CandidateSource } from "@resonara/contracts";
import type { RawTrack } from "../../services/netease/mappers";

export type MatchedDimension =
  | "artist"
  | "lyricist"
  | "composer"
  | "language"
  | "genre";

export type SourcedRawTrack = {
  raw: RawTrack;
  source: CandidateSource;
  seedTrackId: string | null;
  matchedDimensions: MatchedDimension[];
};
