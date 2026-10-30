// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { resonaraDb } from "../../db/database";
import * as favoritesRepository from "../../db/repositories/favorites";
import { useFavoritesStore } from "./useFavorite";

async function resetDatabase() {
  resonaraDb.close();
  await resonaraDb.delete();
  await resonaraDb.open();
  useFavoritesStore.setState({
    records: {},
    hydratedTrackIds: {},
  });
}

function favoriteButtons() {
  return screen.getAllByLabelText(/Undefined.*favorites/);
}

describe("favorite controls", () => {
  beforeEach(async () => {
    await resetDatabase();
    render(<App />);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resonaraDb.close();
  });

  it("updates the recommendation row and player surface together", async () => {
    const user = userEvent.setup();
    expect(favoriteButtons()).toHaveLength(2);

    await user.click(favoriteButtons()[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Remove Undefined from favorites"),
      ).toHaveLength(2);
    });
  });

  it("persists the favorite and its liked feedback event", async () => {
    const user = userEvent.setup();
    await user.click(favoriteButtons()[0]!);

    await waitFor(async () => {
      expect(await resonaraDb.favorites.count()).toBe(1);
      expect(await resonaraDb.feedbackEvents.count()).toBe(1);
    });
    const event = await resonaraDb.feedbackEvents.toCollection().first();
    expect(event).toMatchObject({
      trackId: "3451951517",
      event: "liked",
      positionMs: 0,
    });

    cleanup();
    useFavoritesStore.setState({
      records: {},
      hydratedTrackIds: {},
      revisions: {},
      errors: {},
    });
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Remove Undefined from favorites"),
      ).toHaveLength(2);
    });
  });

  it("removes the favorite and records unliked without a dislike", async () => {
    const user = userEvent.setup();
    await user.click(favoriteButtons()[0]!);
    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Remove Undefined from favorites"),
      ).toHaveLength(2);
    });

    await user.click(
      screen.getAllByLabelText("Remove Undefined from favorites")[0]!,
    );

    await waitFor(async () => {
      expect(await resonaraDb.favorites.count()).toBe(0);
      expect(await resonaraDb.feedbackEvents.count()).toBe(2);
    });
    const events = await resonaraDb.feedbackEvents.orderBy("id").toArray();
    expect(events.map(({ event }) => event)).toEqual(["liked", "unliked"]);
  });

  it("rolls back the optimistic state when IndexedDB fails", async () => {
    vi.spyOn(favoritesRepository, "addFavorite").mockRejectedValueOnce(
      new Error("IndexedDB write failed"),
    );
    const user = userEvent.setup();
    await user.click(favoriteButtons()[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Save Undefined to favorites"),
      ).toHaveLength(2);
    });
  });
});
