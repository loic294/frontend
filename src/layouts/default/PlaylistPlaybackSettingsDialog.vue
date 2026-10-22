<template>
  <Dialog :key="dialogKey" v-model:open="open">
    <DialogContent
      class="sm:max-w-120"
      :show-close-button="!saving"
      @interact-outside="saving && $event.preventDefault()"
      @escape-key-down="saving && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>{{ $t("playlist_playback.title") }}</DialogTitle>
        <DialogDescription>{{
          $t("playlist_playback.help")
        }}</DialogDescription>
      </DialogHeader>
      <p v-if="loading" role="status">{{ $t("loading") }}</p>
      <p v-if="error" role="alert" class="text-destructive">{{ error }}</p>
      <p v-if="playlist?.is_dynamic" class="text-muted-foreground">
        {{ $t("playlist_playback.dynamic_unavailable") }}
      </p>
      <form
        v-if="settings"
        id="playlist-playback-settings"
        @submit.prevent="save"
      >
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel for="playlist-spoken-word">{{
                $t("playlist_playback.spoken_word")
              }}</FieldLabel>
              <FieldDescription id="playlist-spoken-word-help">{{
                $t("playlist_playback.spoken_word_help")
              }}</FieldDescription>
            </FieldContent>
            <Switch
              id="playlist-spoken-word"
              v-model="settings.spoken_word"
              aria-describedby="playlist-spoken-word-help"
              :disabled="!canWrite || saving"
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel for="playlist-remove-finished">{{
                $t("playlist_playback.remove_finished")
              }}</FieldLabel>
              <FieldDescription>{{
                $t("playlist_playback.remove_help")
              }}</FieldDescription>
              <FieldDescription v-if="!canRemove">{{
                $t("playlist_playback.remove_unavailable")
              }}</FieldDescription>
            </FieldContent>
            <Switch
              id="playlist-remove-finished"
              v-model="settings.remove_finished"
              :disabled="
                !canWrite || !settings.spoken_word || !canRemove || saving
              "
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel for="playlist-show-remaining-time">{{
                $t("playlist_playback.show_remaining_time")
              }}</FieldLabel>
              <FieldDescription id="playlist-show-remaining-time-help">{{
                $t("playlist_playback.show_remaining_time_help")
              }}</FieldDescription>
            </FieldContent>
            <Switch
              id="playlist-show-remaining-time"
              v-model="settings.show_remaining_time"
              aria-describedby="playlist-show-remaining-time-help"
              :disabled="!canWrite || saving"
            />
          </Field>
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button variant="outline" :disabled="saving" @click="open = false">{{
          $t("cancel")
        }}</Button>
        <Button
          type="submit"
          form="playlist-playback-settings"
          :loading="saving"
          :disabled="!settings || !canWrite || loading || saving"
          >{{ $t("settings.save") }}</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { usePlaylistPlaybackSettings } from "@/composables/usePlaylistPlaybackSettings";
import {
  eventbus,
  type PlaylistPlaybackSettingsDialogEvent,
} from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t } = useI18n();
const open = ref(false);
const dialogKey = ref(0);
const error = ref("");
const {
  playlist,
  settings,
  loading,
  saving,
  canWrite,
  canRemove,
  load,
  save: persist,
  reset,
} = usePlaylistPlaybackSettings();

watch(open, (value) => {
  store.dialogActive = value;
  if (!value) reset();
});

const show = async ({ playlist }: PlaylistPlaybackSettingsDialogEvent) => {
  if (saving.value) return;
  dialogKey.value++;
  error.value = "";
  open.value = true;
  try {
    await load(playlist);
  } catch {
    error.value = t("playlist_playback.load_error");
    toast.error(error.value);
  }
};

onMounted(() => eventbus.on("playlistPlaybackSettingsDialog", show));
onBeforeUnmount(() => {
  eventbus.off("playlistPlaybackSettingsDialog", show);
  reset();
});

async function save() {
  error.value = "";
  try {
    if (await persist()) {
      toast.success(t("playlist_playback.saved"));
      open.value = false;
    }
  } catch {
    error.value = t("playlist_playback.save_error");
    toast.error(error.value);
  }
}
</script>
