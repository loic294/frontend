import { describe, expect, it, vi } from "vitest";
import { formatMediaItemDuration, formatTotalDuration } from "./duration";
import { MediaType } from "@/plugins/api/interfaces";
import { podcastEpisode } from "../../tests/fixtures/podcastEpisode";
import { track } from "../../tests/fixtures/track";

vi.mock("@/plugins/api", () => ({ api: { providers: {} } }));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, params: Record<string, string | number>) =>
    key === "playlist_playback.time_left"
      ? `${params.time} left`
      : `${key} ${JSON.stringify(params)}`,
}));

describe("formatTotalDuration", () => {
  it("gives hours and minutes", () => {
    expect(formatTotalDuration(42248)).toBe(
      'duration_hours_minutes {"hours":11,"minutes":44}',
    );
  });

  describe("formatMediaItemDuration", () => {
    it.each([MediaType.PODCAST_EPISODE, MediaType.AUDIOBOOK])(
      "subtracts saved milliseconds from a %s duration",
      (media_type) => {
        expect(
          formatMediaItemDuration(
            podcastEpisode({
              media_type,
              duration: 3600,
              resume_position_ms: 900_000,
            }),
            true,
          ),
        ).toBe("45:00 left");
      },
    );

    it.each([null, undefined, 0])(
      "shows full time left for unknown/zero progress %s",
      (resume_position_ms) => {
        expect(
          formatMediaItemDuration(
            podcastEpisode({
              duration: 3661,
              resume_position_ms,
            }),
            true,
          ),
        ).toBe("01:01:01 left");
      },
    );

    it("clamps negative and beyond-end progress", () => {
      expect(
        formatMediaItemDuration(
          podcastEpisode({
            duration: 60,
            resume_position_ms: -1000,
          }),
          true,
        ),
      ).toBe("01:00 left");
      expect(
        formatMediaItemDuration(
          podcastEpisode({
            duration: 60,
            resume_position_ms: 70_000,
          }),
          true,
        ),
      ).toBe("00:00 left");
    });

    it("uses exact progress, not the early fully-played threshold", () => {
      expect(
        formatMediaItemDuration(
          podcastEpisode({
            duration: 3600,
            resume_position_ms: 3_570_000,
            fully_played: true,
          }),
          true,
        ),
      ).toBe("00:30 left");
    });

    it("keeps normal duration when disabled or for music", () => {
      expect(
        formatMediaItemDuration(
          podcastEpisode({
            duration: 3600,
            resume_position_ms: 900_000,
          }),
        ),
      ).toBe("01:00:00");
      expect(formatMediaItemDuration(track({ duration: 180 }), true)).toBe(
        "03:00",
      );
    });

    it("does not invent a duration for an item with an unknown length", () => {
      expect(
        formatMediaItemDuration(podcastEpisode({ duration: 0 }), true),
      ).toBeUndefined();
    });
  });

  it("leaves out the minutes on a whole hour", () => {
    expect(formatTotalDuration(7200)).toBe('duration_hours {"hours":2}');
  });

  it("gives only minutes under an hour", () => {
    expect(formatTotalDuration(2290)).toBe('duration_minutes {"minutes":38}');
  });

  it("rounds to the nearest minute", () => {
    expect(formatTotalDuration(3599)).toBe('duration_hours {"hours":1}');
    expect(formatTotalDuration(89)).toBe('duration_minutes {"minutes":1}');
  });

  it("never shows zero minutes for a short playing time", () => {
    expect(formatTotalDuration(10)).toBe('duration_minutes {"minutes":1}');
  });
});
