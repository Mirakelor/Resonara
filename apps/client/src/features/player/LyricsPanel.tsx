import { useEffect, useRef } from "react";
import type { LyricLine, TranslationMap } from "./lyrics";

type LyricsPanelProps = {
  lines: LyricLine[];
  translations: TranslationMap;
  activeIndex: number;
};

export function LyricsPanel({
  lines,
  translations,
  activeIndex,
}: LyricsPanelProps) {
  const activeRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [activeIndex]);

  return (
    <section className="lyrics-panel" aria-label="Synchronized lyrics">
      {lines.map((line, index) => (
        <p
          className={
            index === activeIndex
              ? "lyrics-panel__line lyrics-panel__line--active"
              : index < activeIndex
                ? "lyrics-panel__line lyrics-panel__line--past"
                : "lyrics-panel__line"
          }
          key={`${line.timeMs}-${index}`}
          ref={index === activeIndex ? activeRef : undefined}
        >
          <span>{line.text}</span>
          {translations.get(line.timeMs) ? (
            <small>{translations.get(line.timeMs)}</small>
          ) : null}
        </p>
      ))}
    </section>
  );
}
