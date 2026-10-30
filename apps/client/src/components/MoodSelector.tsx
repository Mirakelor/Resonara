import type { EnvironmentMode, ListeningIntent } from "@resonara/contracts";
import { intentMeta } from "../data/intents";
import { Icon, type IconName } from "./Icon";

type MoodSelectorProps = {
  selectedIntent: ListeningIntent | null;
  environmentMode: EnvironmentMode;
  pending: boolean;
  onSelectIntent: (intent: ListeningIntent) => void;
  onEnvironmentChange: (mode: EnvironmentMode) => void;
};

const intents: Array<{
  intent: ListeningIntent;
  label: string;
  icon: IconName;
}> = [
  { intent: "feel_good", label: intentMeta.feel_good.label, icon: "sun" },
  { intent: "energize", label: intentMeta.energize.label, icon: "coffee" },
  { intent: "relax", label: intentMeta.relax.label, icon: "feather" },
  { intent: "focus", label: intentMeta.focus.label, icon: "focus" },
  { intent: "comfort", label: intentMeta.comfort.label, icon: "heart" },
  { intent: "surprise_me", label: intentMeta.surprise_me.label, icon: "music" },
];

export function MoodSelector({
  selectedIntent,
  environmentMode,
  pending,
  onSelectIntent,
  onEnvironmentChange,
}: MoodSelectorProps) {
  return (
    <div className="mood-card" aria-busy={pending}>
      <div className="mood-card__header">
        <h2>What do you need right now?</h2>
        <p>Choose how music should meet this moment.</p>
      </div>

      <div className="intent-grid" aria-label="Choose what you need right now">
        {intents.map(({ intent, label, icon }) => (
          <button
            className={`intent-option ${
              selectedIntent === intent ? "intent-option--selected" : ""
            }`}
            type="button"
            key={intent}
            onClick={() => onSelectIntent(intent)}
            aria-pressed={selectedIntent === intent}
            disabled={pending}
          >
            <Icon name={icon} size={23} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <section className="environment-control">
        <h3>How should AI use today&apos;s environment?</h3>
        <p>Choose how context should shape the recommendation.</p>
        <div className="environment-control__options">
          <button
            type="button"
            className={
              environmentMode === "use_current"
                ? "environment-option environment-option--selected"
                : "environment-option"
            }
            onClick={() => onEnvironmentChange("use_current")}
            aria-pressed={environmentMode === "use_current"}
            disabled={pending}
          >
            <span>
              <strong>Use my current environment</strong>
              <small>
                Adjust for weather, temperature, humidity, and time
              </small>
            </span>
          </button>
          <button
            type="button"
            className={
              environmentMode === "ignore_environment"
                ? "environment-option environment-option--selected"
                : "environment-option"
            }
            onClick={() => onEnvironmentChange("ignore_environment")}
            aria-pressed={environmentMode === "ignore_environment"}
            disabled={pending}
          >
            <span>
              <strong>Ignore the environment</strong>
              <small>Recommend based only on my music taste</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
