import type { MatchFeedFilter } from "../../../api/contract";
import type { SegmentType } from "../../../api/contract";
import type { SharePanelElements } from "../../shared/types/app";

export const bindTopLevelUiHandlers = (args: {
  logoutButton: HTMLButtonElement;
  faqMenuButton: HTMLButtonElement;
  footerFaqButton: HTMLButtonElement;
  footerPrivacyButton: HTMLButtonElement;
  authMenuButton: HTMLButtonElement;
  createMenuButton: HTMLButtonElement;
  refreshButton: HTMLButtonElement;
  openCreateMatchButton: HTMLButtonElement;
  openCreateTournamentButton: HTMLButtonElement;
  openCreateSeasonButton: HTMLButtonElement;
  openScoreCardButton: HTMLButtonElement;
  closeCreateMatchButton: HTMLButtonElement;
  closeCreateTournamentButton: HTMLButtonElement;
  closeCreateSeasonButton: HTMLButtonElement;
  faqBackButton: HTMLButtonElement;
  privacyBackButton: HTMLButtonElement;
  closeScoreCardButton: HTMLButtonElement;
  scoreCardOverlay: HTMLElement;
  suggestMatchButton: HTMLButtonElement;
  suggestTournamentButton: HTMLButtonElement;
  onLogout: () => void;
  onOpenFaq: () => void;
  onOpenPrivacy: () => void;
  onToggleAuthMenu: () => void;
  onToggleCreateMenu: () => void;
  onDocumentClick: (event: MouseEvent) => void;
  onRefresh: () => void;
  onOpenCreateMatch: () => void;
  onOpenCreateTournament: () => void;
  onOpenCreateSeason: () => void;
  onOpenScoreCard: () => void;
  onCloseCreateMatch: () => void;
  onCloseCreateTournament: () => void;
  onCloseCreateSeason: () => void;
  onCloseFaq: () => void;
  onClosePrivacy: () => void;
  onCloseScoreCard: () => void;
  onScoreCardOverlayClick: (event: MouseEvent) => void;
  onSuggestMatch: () => void;
  onSuggestTournament: () => void;
}): void => {
  args.logoutButton.addEventListener("click", args.onLogout);
  args.faqMenuButton.addEventListener("click", args.onOpenFaq);
  args.footerFaqButton.addEventListener("click", args.onOpenFaq);
  args.footerPrivacyButton.addEventListener("click", args.onOpenPrivacy);
  args.authMenuButton.addEventListener("click", args.onToggleAuthMenu);
  args.createMenuButton.addEventListener("click", args.onToggleCreateMenu);
  document.addEventListener("click", args.onDocumentClick);
  args.refreshButton.addEventListener("click", args.onRefresh);
  args.openCreateMatchButton.addEventListener("click", args.onOpenCreateMatch);
  args.openCreateTournamentButton.addEventListener("click", args.onOpenCreateTournament);
  args.openCreateSeasonButton.addEventListener("click", args.onOpenCreateSeason);
  args.openScoreCardButton.addEventListener("click", args.onOpenScoreCard);
  args.closeCreateMatchButton.addEventListener("click", args.onCloseCreateMatch);
  args.closeCreateTournamentButton.addEventListener("click", args.onCloseCreateTournament);
  args.closeCreateSeasonButton.addEventListener("click", args.onCloseCreateSeason);
  args.faqBackButton.addEventListener("click", args.onCloseFaq);
  args.privacyBackButton.addEventListener("click", args.onClosePrivacy);
  args.closeScoreCardButton.addEventListener("click", args.onCloseScoreCard);
  args.scoreCardOverlay.addEventListener("click", args.onScoreCardOverlayClick);
  args.suggestMatchButton.addEventListener("click", args.onSuggestMatch);
  args.suggestTournamentButton.addEventListener("click", args.onSuggestTournament);
};

export const bindSelectionAndFormHandlers = (args: {
  loadTournamentButton: HTMLButtonElement;
  loadTournamentSelect: HTMLSelectElement;
  loadSeasonSelect: HTMLSelectElement;
  loadSeasonButton: HTMLButtonElement;
  tournamentNameInput: HTMLInputElement;
  saveTournamentButton: HTMLButtonElement;
  deleteTournamentButton: HTMLButtonElement;
  deleteSeasonButton: HTMLButtonElement;
  globalButton: HTMLButtonElement;
  seasonButton: HTMLButtonElement;
  tournamentButton: HTMLButtonElement;
  seasonSelect: HTMLSelectElement;
  tournamentSelect: HTMLSelectElement;
  loadMoreButton: HTMLButtonElement;
  matchForm: HTMLFormElement;
  seasonForm: HTMLFormElement;
  matchInputs: Array<HTMLInputElement | HTMLSelectElement>;
  seasonDraftInputs: Array<HTMLInputElement | HTMLSelectElement>;
  tournamentDraftInputs: Array<HTMLInputElement | HTMLSelectElement>;
  scoreInputs: Array<{ teamA: HTMLInputElement; teamB: HTMLInputElement }>;
  onLoadTournament: () => void;
  onTournamentSelectChange: () => void;
  onSeasonSelectChange: () => void;
  onLoadSeason: () => void;
  onTournamentNameInput: () => void;
  onSaveTournament: () => void;
  onDeleteTournament: () => void;
  onDeleteSeason: () => void;
  onApplyGlobalMode: () => void;
  onApplySeasonMode: () => void;
  onApplyTournamentMode: () => void;
  onLeaderboardSeasonChange: () => void;
  onLeaderboardTournamentChange: () => void;
  onLoadMoreMatches: () => void;
  onMatchInputChange: () => void;
  onMatchSubmit: (event: SubmitEvent) => void;
  onSeasonSubmit: (event: SubmitEvent) => void;
  onSeasonDraftChange: () => void;
  onTournamentDraftChange: () => void;
  onScoreInputChange: () => void;
}): void => {
  args.loadTournamentButton.addEventListener("click", args.onLoadTournament);
  args.loadTournamentSelect.addEventListener("change", args.onTournamentSelectChange);
  args.loadSeasonSelect.addEventListener("change", args.onSeasonSelectChange);
  args.loadSeasonButton.addEventListener("click", args.onLoadSeason);
  args.tournamentNameInput.addEventListener("input", args.onTournamentNameInput);
  args.saveTournamentButton.addEventListener("click", args.onSaveTournament);
  args.deleteTournamentButton.addEventListener("click", args.onDeleteTournament);
  args.deleteSeasonButton.addEventListener("click", args.onDeleteSeason);
  args.globalButton.addEventListener("click", args.onApplyGlobalMode);
  args.seasonButton.addEventListener("click", args.onApplySeasonMode);
  args.tournamentButton.addEventListener("click", args.onApplyTournamentMode);
  args.seasonSelect.addEventListener("change", args.onLeaderboardSeasonChange);
  args.tournamentSelect.addEventListener("change", args.onLeaderboardTournamentChange);
  args.loadMoreButton.addEventListener("click", args.onLoadMoreMatches);
  args.matchInputs.forEach((input) => input.addEventListener("change", args.onMatchInputChange));
  args.matchForm.addEventListener("submit", args.onMatchSubmit);
  args.seasonForm.addEventListener("submit", args.onSeasonSubmit);
  args.seasonDraftInputs.forEach((input) => input.addEventListener("change", args.onSeasonDraftChange));
  args.tournamentDraftInputs.forEach((input) => input.addEventListener("change", args.onTournamentDraftChange));
  args.scoreInputs.forEach((game) => {
    game.teamA.addEventListener("input", args.onScoreInputChange);
    game.teamB.addEventListener("input", args.onScoreInputChange);
  });
};

export const bindSharePanelHandlers = (args: {
  segmentType: SegmentType;
  elements: SharePanelElements;
  onCopy: () => void | Promise<void>;
  onCreate: () => void;
}): void => {
  args.elements.copyButton.addEventListener("click", () => {
    void args.onCopy();
  });
  args.elements.createButton.addEventListener("click", args.onCreate);
};

export const bindWindowLifecycleHandlers = (args: {
  sessionId: number;
}): void => {
  window.addEventListener("beforeunload", () => {
    window.clearInterval(args.sessionId);
  });
};
