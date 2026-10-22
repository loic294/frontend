import PlaylistPlaybackSettingsDialog from "@/layouts/default/PlaylistPlaybackSettingsDialog.vue";
import { eventbus } from "@/plugins/eventbus";
import { Scope, type PlaylistPlaybackSettings } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";

const { api, auth, store, toast } = vi.hoisted(() => ({
  api: {
    getPlaylistPlaybackSettings: vi.fn(),
    setPlaylistPlaybackSettings: vi.fn(),
  },
  auth: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  store: { dialogActive: false },
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/plugins/api", () => ({ default: api }));
vi.mock("@/plugins/auth", () => ({ authManager: auth }));
vi.mock("@/plugins/store", () => ({ store }));
vi.mock("vue-sonner", () => ({ toast }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);
beforeEach(() => {
  vi.resetAllMocks();
  document.body.innerHTML = "";
  auth.hasScope.mockReturnValue(true);
  api.getPlaylistPlaybackSettings.mockResolvedValue({
    spoken_word: false,
    remove_finished: false,
    show_remaining_time: false,
  });
  api.setPlaylistPlaybackSettings.mockImplementation((_id, settings) =>
    Promise.resolve(settings),
  );
});

async function open(overrides: Parameters<typeof playlist>[0] = {}) {
  const wrapper = mount(PlaylistPlaybackSettingsDialog, {
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  eventbus.emit("playlistPlaybackSettingsDialog", {
    playlist: playlist({ is_editable: true, ...overrides }),
  });
  await flushPromises();
  return wrapper;
}
function toggle(id: string) {
  return document.querySelector<HTMLButtonElement>(`#${id}`)!;
}
function submit() {
  document
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  return flushPromises();
}
function saveButton() {
  return document.querySelector<HTMLButtonElement>(
    'button[form="playlist-playback-settings"]',
  )!;
}

describe("playlist playback settings dialog", () => {
  it("labels and describes the playlist resume setting", async () => {
    await open();
    expect(
      document.querySelector('label[for="playlist-spoken-word"]')?.textContent,
    ).toBe("playlist_playback.spoken_word");
    expect(
      toggle("playlist-spoken-word").getAttribute("aria-describedby"),
    ).toBe("playlist-spoken-word-help");
    expect(
      document.querySelector("#playlist-spoken-word-help")?.textContent,
    ).toBe("playlist_playback.spoken_word_help");
  });

  it("leaves removal disabled until playlist resume is enabled and only writes on save", async () => {
    await open();
    expect(toggle("playlist-spoken-word").getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(toggle("playlist-remove-finished").disabled).toBe(true);
    toggle("playlist-spoken-word").click();
    await flushPromises();
    expect(toggle("playlist-remove-finished").disabled).toBe(false);
    toggle("playlist-remove-finished").click();
    await flushPromises();
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
    await submit();
    expect(api.setPlaylistPlaybackSettings).toHaveBeenCalledWith("1", {
      spoken_word: true,
      remove_finished: true,
      show_remaining_time: false,
    });
    expect(toast.success).toHaveBeenCalledWith("playlist_playback.saved");
  });

  it.each([{ is_dynamic: true }, { is_editable: false }])(
    "disables removal for %j",
    async (overrides) => {
      api.getPlaylistPlaybackSettings.mockResolvedValue({
        spoken_word: true,
        remove_finished: false,
        show_remaining_time: false,
      });
      await open(overrides);
      expect(toggle("playlist-remove-finished").disabled).toBe(true);
      expect(document.body.textContent).toContain(
        "playlist_playback.remove_unavailable",
      );
    },
  );

  it("explains and disables spoken-word playback for dynamic playlists", async () => {
    await open({ is_dynamic: true });
    expect(toggle("playlist-spoken-word").disabled).toBe(true);
    expect(toggle("playlist-show-remaining-time").disabled).toBe(true);
    expect(saveButton().disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "playlist_playback.dynamic_unavailable",
    );
  });

  it("reports read errors and cannot save unavailable settings", async () => {
    api.getPlaylistPlaybackSettings.mockRejectedValue(
      new Error("Invalid command"),
    );
    await open();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "playlist_playback.load_error",
    );
    expect(saveButton().disabled).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("playlist_playback.load_error");
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it("reports save errors without discarding the form", async () => {
    api.setPlaylistPlaybackSettings.mockRejectedValue(new Error("Denied"));
    await open();
    toggle("playlist-spoken-word").click();
    await flushPromises();
    await submit();
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      "playlist_playback.save_error",
    );
    expect(toast.error).toHaveBeenCalledWith("playlist_playback.save_error");
    expect(toggle("playlist-spoken-word").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(saveButton().disabled).toBe(false);
  });

  it("blocks duplicate saves, toggles and dismissal while saving", async () => {
    let finish!: (settings: PlaylistPlaybackSettings) => void;
    api.setPlaylistPlaybackSettings.mockReturnValue(
      new Promise((done) => {
        finish = done;
      }),
    );
    await open();
    await submit();
    expect(saveButton().disabled).toBe(true);
    expect(toggle("playlist-spoken-word").disabled).toBe(true);
    expect(toggle("playlist-show-remaining-time").disabled).toBe(true);
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull();
    await submit();
    expect(api.setPlaylistPlaybackSettings).toHaveBeenCalledTimes(1);
    finish({
      spoken_word: false,
      remove_finished: false,
      show_remaining_time: false,
    });
    await flushPromises();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("cancels without writing settings", async () => {
    await open();
    const cancel = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "cancel",
    )!;
    cancel.click();
    await flushPromises();
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it("saves and reopens the remaining-time preference independently of resume", async () => {
    const wrapper = await open();
    const toggleId = "playlist-show-remaining-time";
    expect(toggle(toggleId).getAttribute("aria-checked")).toBe("false");
    expect(toggle(toggleId).disabled).toBe(false);
    expect(toggle(toggleId).getAttribute("aria-describedby")).toBe(
      "playlist-show-remaining-time-help",
    );
    expect(
      document.querySelector(`label[for="${toggleId}"]`)?.textContent,
    ).toBe("playlist_playback.show_remaining_time");
    toggle(toggleId).click();
    await flushPromises();
    await submit();
    const settings = {
      spoken_word: false,
      remove_finished: false,
      show_remaining_time: true,
    };
    expect(api.setPlaylistPlaybackSettings).toHaveBeenCalledWith("1", settings);
    wrapper.unmount();
    api.getPlaylistPlaybackSettings.mockResolvedValue(settings);
    await open();
    expect(toggle(toggleId).getAttribute("aria-checked")).toBe("true");
  });
});
