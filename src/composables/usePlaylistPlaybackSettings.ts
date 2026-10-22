import { computed, ref } from "vue";
import api from "@/plugins/api";
import {
  type Playlist,
  type PlaylistPlaybackSettings,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { canManagePlaylist } from "@/helpers/playlist_access";
import { store } from "@/plugins/store";

export function usePlaylistPlaybackSettings() {
  const playlist = ref<Playlist>();
  const settings = ref<PlaylistPlaybackSettings>();
  const loading = ref(false);
  const saving = ref(false);
  let generation = 0;

  const canWrite = computed(
    () =>
      !!playlist.value &&
      !playlist.value.is_dynamic &&
      authManager.hasScope(Scope.LIBRARY_WRITE) &&
      canManagePlaylist(
        playlist.value,
        store.currentUser,
        authManager.hasScope(Scope.LIBRARY_MANAGE),
      ),
  );
  const canRemove = computed(
    () => !!playlist.value?.is_editable && !playlist.value.is_dynamic,
  );

  async function load(source: Playlist) {
    const request = ++generation;
    playlist.value = undefined;
    settings.value = undefined;
    loading.value = true;
    try {
      if (!authManager.hasScope(Scope.LIBRARY_READ))
        throw new Error("library.read");
      // A provider detail may resolve to its existing library playlist. Never send
      // a provider item ID to the playback-settings endpoints.
      const resolved =
        source.provider === "library"
          ? source
          : await api.getPlaylist(source.item_id, source.provider);
      if (resolved.provider !== "library")
        throw new Error("Playlist is not in the library");
      const loaded = await api.getPlaylistPlaybackSettings(resolved.item_id);
      if (request === generation) {
        playlist.value = resolved;
        settings.value = loaded;
      }
    } catch (error) {
      if (request === generation) throw error;
    } finally {
      if (request === generation) loading.value = false;
    }
  }

  async function save() {
    if (!playlist.value || !settings.value || !canWrite.value || saving.value)
      return false;
    saving.value = true;
    try {
      settings.value = await api.setPlaylistPlaybackSettings(
        playlist.value.item_id,
        {
          spoken_word: settings.value.spoken_word,
          remove_finished:
            settings.value.spoken_word &&
            canRemove.value &&
            settings.value.remove_finished,
          show_remaining_time: settings.value.show_remaining_time,
        },
      );
      return true;
    } finally {
      saving.value = false;
    }
  }

  function reset() {
    generation++;
    settings.value = undefined;
    playlist.value = undefined;
    loading.value = false;
  }

  return {
    playlist,
    settings,
    loading,
    saving,
    canWrite,
    canRemove,
    load,
    save,
    reset,
  };
}
