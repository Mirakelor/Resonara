import { Icon } from "../../components/Icon";

type SettingsButtonProps = {
  onClick: () => void;
};

export function SettingsButton({ onClick }: SettingsButtonProps) {
  return (
    <button
      className="settings-button"
      type="button"
      aria-label="Open settings"
      onClick={onClick}
    >
      <Icon name="settings" size={24} />
    </button>
  );
}
