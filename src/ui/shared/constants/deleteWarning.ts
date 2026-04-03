import type { DeleteWarningContext } from "../types/app";
import type { TextKey } from "../i18n/translations";

export const deleteWarningCopy: Record<
  DeleteWarningContext,
  { titleKey: TextKey; bodyKey: TextKey }
> = {
  match: {
    titleKey: "deleteModalTitleMatch",
    bodyKey: "deleteModalBodyMatch",
  },
  season: {
    titleKey: "deleteModalTitleSeason",
    bodyKey: "deleteModalBodySeason",
  },
  tournament: {
    titleKey: "deleteModalTitleTournament",
    bodyKey: "deleteModalBodyTournament",
  },
};
