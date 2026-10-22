# Podcast/Audiobook playlist playback

For the fork's test Docker image, Home Assistant app, desktop companion and
Android build, follow the
[test deployment guide](https://github.com/loic294/server/blob/playlist-playback-test/docs/test-deployment.md).
The server image includes this exact frontend; a separate web hosting deployment
is not required.

On a playlist, open the existing three-dot/context menu and choose
**Podcast/Audiobook settings**. The desktop app uses this same web UI.

- **Resume when playing playlist** is opt-in (`spoken_word`, default `false`).
  Play starts with the first item in the listing's selected sort order (including
  its direction) and resumes each episode/book using fresh provider progress, or
  Music Assistant's saved progress when the provider cannot supply it. The option's
  description explains this behavior. Dynamic playlists cannot opt in; the dialog
  explains this and disables editing.
- **Remove finished items** is a separate opt-in (`remove_finished`, default
  `false`). It is enabled only with playlist resume on editable, non-dynamic
  playlists. Removal is from the source playlist at natural playback end, never
  on skip or stop. Seeking or resuming does not prevent removal when the item
  subsequently finishes naturally.
- Playing an episode or audiobook from a playlist row continues that playlist
  from the chosen item in the displayed sort order. Its playlist origin is kept,
  so the same resume and natural-end removal settings apply. The row's play menu
  also offers **Play playlist from here**. Playing an episode from outside a
  playlist remains standalone and does not remove it from unrelated playlists.
- **Show remaining time** is a separate opt-in (`show_remaining_time`, default
  `false`). Episode and audiobook rows display their duration minus saved listening
  progress as, for example, **42:15 left**, on desktop and mobile. Unstarted items
  show their full duration followed by **left**; progress beyond the duration
  displays **00:00 left**. Music tracks keep their normal duration. Playback
  progress reports update the displayed remaining time; this option does not
  change playback, sorting, or the playlist's total duration.
  The server overlays the current user's saved progress outside the shared
  playlist cache, including library/provider identity mappings and rewinds to
  zero. It does not fetch each episode from its provider to render the listing.
- Opening or cancelling the dialog does not write anything. Existing playlists
  keep their existing behavior. Saving shows progress and confirmation; failures
  remain visible and never substitute local defaults.

## Server contract

Both commands require a **library playlist ID string** in `item_id`:

- `music/playlists/playback_settings` returns
  `{ spoken_word: boolean, remove_finished: boolean, show_remaining_time: boolean }`,
  requiring `library.read`.
- `music/playlists/set_playback_settings` takes these booleans and returns the
  same object, requiring `library.write` and playlist may-manage permission.
  Omitting `show_remaining_time` preserves its stored value for existing clients.
  Existing playlists need no migration: an absent stored key reads as `false`.

The UI uses the existing playlist access checks (owner or library manager for
personal playlists, not merely a collaborator). Provider playlists are resolved
through playlist get first; unresolved non-library playlists cannot save. The
server remains authoritative for access and removal eligibility. These commands
must be installed server-side: an unavailable endpoint is an error, not a
successful no-op. Playback ordering, progress and natural-end removal are server
behavior, not implemented or simulated in the UI.

## Local testing

With the normal frontend development environment and a compatible Music
Assistant server already running, use `pnpm dev`, connect to that server, and
open the playlist menu. No playback is necessary to test loading, cancelling,
saving, or reopening the settings. Check all three toggles persist, disabling
playlist resume saves removal as false, and non-editable/dynamic playlists
cannot enable removal.

Offline focused checks (mocked API, no server required):

```sh
pnpm test:run tests/composables/usePlaylistPlaybackSettings.test.ts tests/layouts/PlaylistPlaybackSettingsDialog.test.ts tests/helpers/playlistAccessActions.test.ts
pnpm exec vue-tsc --noEmit
pnpm lint:check
```
