import { useCallback, useEffect, useState } from "react";
import {
  appSettingsSchema,
  type AppSettings,
} from "@resonara/contracts";
import {
  clearAllData,
  DEFAULT_SETTINGS,
} from "../../db/database";
import {
  getSettings,
  saveSettings,
} from "../../db/repositories/settings";
import { assertAIConnection } from "../../services/providers/ai";
import { assertMusicConnection } from "../../services/providers/music";

type SaveStatus = {
  tone: "neutral" | "success" | "error";
  message: string;
};

const EMPTY_STATUS: SaveStatus = { tone: "neutral", message: "" };

export function useSettings(open: boolean, onClose: () => void) {
  const [form, setForm] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [status, setStatus] = useState<SaveStatus>(EMPTY_STATUS);
  const [busyAction, setBusyAction] = useState<
    "save" | "music" | "ai" | "clear" | null
  >(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setStatus(EMPTY_STATUS);
    setConfirmClear(false);
    void getSettings().then(
      (settings) => {
        if (active) setForm(settings);
      },
      (error: unknown) => {
        if (!active) return;
        setStatus({
          tone: "error",
          message:
            error instanceof Error ? error.message : "Settings could not load.",
        });
      },
    );

    return () => {
      active = false;
    };
  }, [open]);

  const updateField = useCallback(
    <K extends keyof AppSettings>(field: K, value: AppSettings[K]) => {
      setForm((current) => ({ ...current, [field]: value }));
      setStatus(EMPTY_STATUS);
    },
    [],
  );

  const save = useCallback(async () => {
    setBusyAction("save");
    setStatus(EMPTY_STATUS);
    try {
      const parsed = appSettingsSchema.parse(form);
      const saved = await saveSettings(parsed);
      setForm(saved);
      setStatus({ tone: "success", message: "Settings saved." });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Settings could not save.",
      });
    } finally {
      setBusyAction(null);
    }
  }, [form]);

  const testMusic = useCallback(async () => {
    setBusyAction("music");
    setStatus(EMPTY_STATUS);
    try {
      const parsed = appSettingsSchema.parse(form);
      await assertMusicConnection(parsed);
      setStatus({
        tone: "success",
        message: "Music connection works.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The music connection test failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }, [form]);

  const testAI = useCallback(async () => {
    setBusyAction("ai");
    setStatus(EMPTY_STATUS);
    try {
      const parsed = appSettingsSchema.parse(form);
      await assertAIConnection(parsed);
      setStatus({ tone: "success", message: "AI connection works." });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "The AI connection test failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }, [form]);

  const cancel = useCallback(async () => {
    setConfirmClear(false);
    setStatus(EMPTY_STATUS);
    setForm(await getSettings());
    onClose();
  }, [onClose]);

  const clear = useCallback(async () => {
    setBusyAction("clear");
    setStatus(EMPTY_STATUS);
    try {
      await clearAllData();
      const settings = await getSettings();
      setForm(settings);
      setConfirmClear(false);
      setStatus({ tone: "success", message: "All local data was deleted." });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Local data could not be deleted.",
      });
    } finally {
      setBusyAction(null);
    }
  }, []);

  return {
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
  };
}
