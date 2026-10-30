import { useEffect, useRef } from "react";
import type { AppSettings } from "@resonara/contracts";
import { Icon } from "../../components/Icon";
import { useSettings } from "./useSettings";

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
};

type TextFieldProps = {
  field: keyof AppSettings;
  label: string;
  value: string;
  type?: "text" | "password";
  placeholder?: string;
  onChange: (field: keyof AppSettings, value: string) => void;
};

function TextField({
  field,
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: TextFieldProps) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(field, event.target.value)}
      />
    </label>
  );
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const {
    form,
    status,
    busyAction,
    confirmClear,
    setConfirmClear,
    updateField,
    save,
    testMusic,
    testAI,
    cancel,
    clear,
  } = useSettings(open, onClose);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="settings-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
      >
        <header className="settings-panel__header">
          <div>
            <p className="eyebrow">Local configuration</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            className="settings-panel__close"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="settings-panel__body">
          <div className="settings-fields">
            <TextField
              field="musicApiBaseUrl"
              label="Music API Base URL"
              value={form.musicApiBaseUrl}
              placeholder="https://music-api.example.com"
              onChange={updateField}
            />
            <TextField
              field="musicApiToken"
              label="Music API Access Token"
              type="password"
              value={form.musicApiToken}
              placeholder="Optional"
              onChange={updateField}
            />
            <div className="settings-divider" />
            <TextField
              field="aiBaseUrl"
              label="AI API Base URL"
              value={form.aiBaseUrl}
              placeholder="https://api.example.com/v1"
              onChange={updateField}
            />
            <TextField
              field="aiApiKey"
              label="AI API Key"
              type="password"
              value={form.aiApiKey}
              placeholder="Optional"
              onChange={updateField}
            />
            <TextField
              field="aiModel"
              label="AI Model"
              value={form.aiModel}
              placeholder="Model name"
              onChange={updateField}
            />
          </div>

          <div className="settings-connection-actions">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={testMusic}
            >
              {busyAction === "music"
                ? "Testing music…"
                : "Test music connection"}
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={testAI}
            >
              {busyAction === "ai" ? "Testing AI…" : "Test AI connection"}
            </button>
          </div>

          {status.message ? (
            <p
              className={`settings-status settings-status--${status.tone}`}
              role="status"
            >
              {status.message}
            </p>
          ) : null}

          {confirmClear ? (
            <div className="settings-clear-confirmation" role="alert">
              <p>
                This permanently deletes favorites, history, caches, and saved
                settings from this device.
              </p>
              <div>
                <button
                  className="settings-danger"
                  type="button"
                  disabled={busyAction !== null}
                  onClick={clear}
                >
                  {busyAction === "clear"
                    ? "Deleting…"
                    : "Delete all local data"}
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => setConfirmClear(false)}
                >
                  Keep my data
                </button>
              </div>
            </div>
          ) : (
            <button
              className="settings-clear"
              type="button"
              disabled={busyAction !== null}
              onClick={() => setConfirmClear(true)}
            >
              Clear all data
            </button>
          )}
        </div>

        <footer className="settings-panel__footer">
          <button type="button" disabled={busyAction !== null} onClick={cancel}>
            Cancel
          </button>
          <button
            className="settings-save"
            type="button"
            disabled={busyAction !== null}
            onClick={save}
          >
            {busyAction === "save" ? "Saving…" : "Save"}
          </button>
        </footer>
      </section>
    </div>
  );
}
