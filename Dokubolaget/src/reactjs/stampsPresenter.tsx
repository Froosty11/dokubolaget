import { router } from "expo-router";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { api } from "../api";
import { clubThemes, reactiveModel } from "../mobxReactiveModel";
import { buildStamps } from "../stamps";
import { haptics } from "../theme/haptics";
import { registeredClubThemeIds } from "../theme/registry";
import type { ThemeId } from "../theme/types";
import { StampsView } from "../views/stampsView";

export const StampsPresenter = observer(function StampsPresenter() {
  const [offline, setOffline] = useState(clubThemes.offline());

  // Fetch the latest club list when the screen opens.
  useEffect(() => {
    clubThemes.refresh(reactiveModel.unlockedThemes).then((summaries) => {
      reactiveModel.setClubSummaries(summaries);
      setOffline(clubThemes.offline());
    });
  }, []);

  const stamps = buildStamps(
    reactiveModel.clubSummaries,
    reactiveModel.unlockedThemes,
    reactiveModel.activeThemeId,
    new Set(registeredClubThemeIds()),
  ).map((stamp) => ({ ...stamp, logoUrl: api.logoUrl(stamp.summary) }));

  function onWear(id: ThemeId) {
    if (reactiveModel.setThemeId(id)) haptics.play("tap");
  }

  function onClose() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <StampsView
      stamps={stamps}
      collectedCount={stamps.filter((s) => s.collected).length}
      offline={offline}
      contactEmail={reactiveModel.contactEmail}
      onWear={onWear}
      onClose={onClose}
    />
  );
});
