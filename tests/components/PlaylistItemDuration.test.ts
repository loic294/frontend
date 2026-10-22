import ListviewItem from "@/components/ListviewItem.vue";
import TrackTableRow from "@/components/track-table/TrackTableRow.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { podcastEpisode } from "../fixtures/podcastEpisode";

vi.mock("@/plugins/api", () => {
  const api = { providers: {} };
  return { api, default: api };
});
vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true },
}));
vi.mock("@/plugins/breakpoint", () => ({ getBreakpointValue: () => false }));
vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
  handleMenuBtnClick: vi.fn(),
  handlePlayBtnClick: vi.fn(),
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, params?: { time: string }) =>
    key === "playlist_playback.time_left" ? `${params?.time} left` : key,
}));
vi.mock("@/components/ListItem.vue", () => ({
  default: {
    template: '<div><slot name="append" /></div>',
  },
}));

describe("playlist row durations", () => {
  const item = () =>
    podcastEpisode({
      duration: 3600,
      resume_position_ms: 900_000,
    });

  it("reactively switches the table row between full duration and time left", async () => {
    const wrapper = mount(TrackTableRow, {
      props: {
        item: item(),
        index: 0,
        columns: ["duration"],
        isSelected: false,
      },
    });
    expect(wrapper.text()).toBe("01:00:00");
    await wrapper.setProps({ showRemainingTime: true });
    expect(wrapper.text()).toBe("45:00 left");
    expect(wrapper.attributes("style")).toContain("7.5rem");
    await wrapper.setProps({
      item: podcastEpisode({
        duration: 3600,
        resume_position_ms: 1_200_000,
      }),
    });
    expect(wrapper.text()).toBe("40:00 left");
    await wrapper.setProps({ showRemainingTime: false });
    expect(wrapper.text()).toBe("01:00:00");
  });

  it.each([false, true])(
    "renders time left in the list layout (mobile=%s)",
    (mobile) => {
      const wrapper = mount(ListviewItem, {
        props: { item: item(), isSelected: false, showRemainingTime: true },
        global: {
          mocks: { $vuetify: { display: { mobile } } },
          stubs: { VBtn: true },
        },
      });
      expect(wrapper.get(".track-duration").text()).toBe("45:00 left");
    },
  );
});
