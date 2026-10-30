import type { TrackEnrichment } from "@resonara/contracts";
import { z } from "zod";
import { EMPTY_CREDITS } from "./credits";

type WikiCreative = {
  creativeType?: string;
  uiElement?: {
    mainTitle?: { title?: string };
    textLinks?: Array<{ text?: string }>;
  };
  resources?: Array<{
    uiElement?: { mainTitle?: { title?: string } };
  }>;
};

type WikiResponse = {
  data?: {
    blocks?: Array<{ creatives?: WikiCreative[] }>;
  };
};

export const wikiSummarySchema = z
  .object({
    data: z
      .object({
        blocks: z
          .array(
            z
              .object({
                creatives: z
                  .array(
                    z
                      .object({
                        creativeType: z.string().optional(),
                        uiElement: z
                          .object({
                            mainTitle: z
                              .object({ title: z.string().optional() })
                              .optional(),
                            textLinks: z
                              .array(
                                z.object({ text: z.string().optional() }),
                              )
                              .optional(),
                          })
                          .optional(),
                        resources: z
                          .array(
                            z.object({
                              uiElement: z
                                .object({
                                  mainTitle: z
                                    .object({ title: z.string().optional() })
                                    .optional(),
                                })
                                .optional(),
                            }),
                          )
                          .optional(),
                      })
                      .passthrough(),
                  )
                  .optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .optional(),
  })
  .passthrough();

function resourceTitles(creative: WikiCreative): string[] {
  return (
    creative.resources
      ?.map((resource) => resource.uiElement?.mainTitle?.title?.trim())
      .filter((title): title is string => Boolean(title)) ?? []
  );
}

function textValues(creative: WikiCreative): string[] {
  return (
    creative.uiElement?.textLinks
      ?.map((link) => link.text?.trim())
      .filter((text): text is string => Boolean(text)) ?? []
  );
}

export function mapWikiSummary(payload: WikiResponse): TrackEnrichment {
  const creatives =
    payload.data?.blocks?.flatMap((block) => block.creatives ?? []) ?? [];
  const genreTags: string[] = [];
  const recommendationTags: string[] = [];
  let language: string | null = null;
  let instrumental = false;
  let bpm: number | null = null;

  for (const creative of creatives) {
    if (creative.creativeType === "songTag") {
      genreTags.push(...resourceTitles(creative));
    } else if (creative.creativeType === "songBizTag") {
      recommendationTags.push(...resourceTitles(creative));
    } else if (creative.creativeType === "language") {
      const value = textValues(creative)[0];
      if (value === "纯音乐" || value === "純音樂") instrumental = true;
      else language = value ?? null;
    } else if (creative.creativeType === "bpm") {
      const value = textValues(creative)[0];
      const parsed = value ? Number(value) : Number.NaN;
      bpm = Number.isFinite(parsed) ? parsed : null;
    }
  }

  return {
    credits: {
      lyricists: [...EMPTY_CREDITS.lyricists],
      composers: [...EMPTY_CREDITS.composers],
      arrangers: [...EMPTY_CREDITS.arrangers],
    },
    genreTags: [...new Set(genreTags)],
    recommendationTags: [...new Set(recommendationTags)],
    language,
    instrumental,
    bpm,
  };
}
