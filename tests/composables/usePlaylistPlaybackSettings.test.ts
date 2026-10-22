import { usePlaylistPlaybackSettings } from "@/composables/usePlaylistPlaybackSettings";
import {
  ProviderSharing,
  Scope,
  type PlaylistPlaybackSettings,
  type User,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { user } from "../fixtures/user";

const { api, auth, store } = vi.hoisted(() => ({
  api: {
    getPlaylist: vi.fn(),
    getPlaylistPlaybackSettings: vi.fn(),
    setPlaylistPlaybackSettings: vi.fn(),
  },
  auth: { hasScope: vi.fn<(scope: Scope) => boolean>() },
  store: { currentUser: undefined as User | undefined },
}));
vi.mock("@/plugins/api", () => ({ default: api }));
vi.mock("@/plugins/auth", () => ({ authManager: auth }));
vi.mock("@/plugins/store", () => ({ store }));

beforeEach(() => {
  vi.resetAllMocks();
  store.currentUser = user({ user_id: "me" });
  auth.hasScope.mockImplementation((scope) => scope !== Scope.LIBRARY_MANAGE);
  api.getPlaylistPlaybackSettings.mockResolvedValue({
    spoken_word: false,
    remove_finished: false,
    show_remaining_time: false,
  });
  api.setPlaylistPlaybackSettings.mockImplementation((_id, settings) =>
    Promise.resolve(settings),
  );
});

describe("playlist playback settings", () => {
  it("loads without writing defaults or changing existing playlists", async () => {
    const form = usePlaylistPlaybackSettings();
    await form.load(playlist());
    expect(api.getPlaylistPlaybackSettings).toHaveBeenCalledWith("1");
    expect(form.settings.value).toEqual({
      spoken_word: false,
      remove_finished: false,
      show_remaining_time: false,
    });
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it("resolves original provider playlists before sending the library ID", async () => {
    api.getPlaylist.mockResolvedValue(playlist({ item_id: "42" }));
    const form = usePlaylistPlaybackSettings();
    await form.load(playlist({ provider: "spotify", item_id: "provider-id" }));
    await form.save();
    expect(api.getPlaylist).toHaveBeenCalledWith("provider-id", "spotify");
    expect(api.getPlaylistPlaybackSettings).toHaveBeenCalledWith("42");
    expect(api.setPlaylistPlaybackSettings).toHaveBeenCalledWith("42", {
      spoken_word: false,
      remove_finished: false,
      show_remaining_time: false,
    });
  });

  it("refuses provider IDs that do not resolve to library playlists", async () => {
    api.getPlaylist.mockResolvedValue(playlist({ provider: "spotify" }));
    const form = usePlaylistPlaybackSettings();
    await expect(form.load(playlist({ provider: "spotify" }))).rejects.toThrow(
      "library",
    );
    expect(api.getPlaylistPlaybackSettings).not.toHaveBeenCalled();
    expect(form.settings.value).toBeUndefined();
  });

  it("does not replace unavailable endpoints with working-looking defaults", async () => {
    api.getPlaylistPlaybackSettings.mockRejectedValue(
      new Error("Invalid command"),
    );
    const form = usePlaylistPlaybackSettings();
    await expect(form.load(playlist())).rejects.toThrow("Invalid command");
    expect(form.settings.value).toBeUndefined();
    expect(form.loading.value).toBe(false);
    expect(await form.save()).toBe(false);
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it("requires library.read before reading", async () => {
    auth.hasScope.mockReturnValue(false);
    await expect(
      usePlaylistPlaybackSettings().load(playlist()),
    ).rejects.toThrow("library.read");
    expect(api.getPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it.each([
    { is_editable: true, is_dynamic: false, spoken_word: true, expected: true },
    {
      is_editable: true,
      is_dynamic: false,
      spoken_word: false,
      expected: false,
    },
    {
      is_editable: false,
      is_dynamic: false,
      spoken_word: true,
      expected: false,
    },
  ])("saves removal only for eligible opt-in playlists: %j", async (test) => {
    const form = usePlaylistPlaybackSettings();
    await form.load(playlist(test));
    form.settings.value = {
      spoken_word: test.spoken_word,
      remove_finished: true,
      show_remaining_time: true,
    };
    await form.save();
    expect(api.setPlaylistPlaybackSettings).toHaveBeenCalledWith("1", {
      spoken_word: test.spoken_word,
      remove_finished: test.expected,
      show_remaining_time: true,
    });
  });

  it("does not allow opting dynamic playlists into spoken-word playback", async () => {
    const form = usePlaylistPlaybackSettings();
    await form.load(playlist({ is_dynamic: true }));
    expect(form.canWrite.value).toBe(false);
    expect(await form.save()).toBe(false);
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it("does not grant manage rights to collaborators", async () => {
    const form = usePlaylistPlaybackSettings();
    await form.load(
      playlist({
        access: {
          owner: "other",
          sharing: ProviderSharing.EVERYONE,
          shared_users: [],
          collaborative: true,
        },
      }),
    );
    expect(form.canWrite.value).toBe(false);
    expect(await form.save()).toBe(false);
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it("requires write scope even for an owner", async () => {
    auth.hasScope.mockImplementation((scope) => scope === Scope.LIBRARY_READ);
    const form = usePlaylistPlaybackSettings();
    await form.load(playlist());
    expect(await form.save()).toBe(false);
    expect(api.setPlaylistPlaybackSettings).not.toHaveBeenCalled();
  });

  it("keeps edits and clears saving after a refused write", async () => {
    const form = usePlaylistPlaybackSettings();
    await form.load(playlist());
    form.settings.value!.spoken_word = true;
    api.setPlaylistPlaybackSettings.mockRejectedValue(
      new Error("Permission denied"),
    );
    await expect(form.save()).rejects.toThrow("Permission denied");
    expect(form.saving.value).toBe(false);
    expect(form.settings.value!.spoken_word).toBe(true);
  });

  it("ignores late results after closing or loading another playlist", async () => {
    let resolve!: (settings: PlaylistPlaybackSettings) => void;
    api.getPlaylistPlaybackSettings.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const form = usePlaylistPlaybackSettings();
    const first = form.load(playlist());
    form.reset();
    await form.load(playlist({ item_id: "2" }));
    resolve({
      spoken_word: true,
      remove_finished: true,
      show_remaining_time: true,
    });
    await first;
    expect(form.settings.value!.spoken_word).toBe(false);
    await form.save();
    expect(api.setPlaylistPlaybackSettings).toHaveBeenCalledWith(
      "2",
      expect.anything(),
    );
  });
});
