import { $t } from "@/plugins/i18n";
import {
  MediaType,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import { formatDuration } from "@/helpers/utils";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_SECOND = 1000;

export function formatMediaItemDuration(
  item: MediaItemTypeOrItemMapping,
  showRemainingTime = false,
): string | undefined {
  if (!("duration" in item) || !item.duration) return undefined;
  if (
    !showRemainingTime ||
    ![MediaType.PODCAST_EPISODE, MediaType.AUDIOBOOK].includes(item.media_type)
  ) {
    return formatDuration(item.duration);
  }
  const position =
    "resume_position_ms" in item ? (item.resume_position_ms ?? 0) : 0;
  const remaining = Math.max(
    0,
    item.duration - Math.max(0, position) / MILLISECONDS_PER_SECOND,
  );
  return $t("playlist_playback.time_left", {
    time: formatDuration(remaining),
  });
}

/**
 * A total playing time in words, rounded to the minute: "11 h 44 min",
 * "2 h" or "38 min". For the length of a whole album or playlist, where a
 * clock-style "11:44:08" reads like a time of day.
 */
export function formatTotalDuration(totalSeconds: number): string {
  const totalMinutes = Math.max(
    1,
    Math.round(totalSeconds / SECONDS_PER_MINUTE),
  );
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  if (!hours) return $t("duration_minutes", { minutes });
  if (!minutes) return $t("duration_hours", { hours });
  return $t("duration_hours_minutes", { hours, minutes });
}
