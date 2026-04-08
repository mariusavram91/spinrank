function daysBetween(fromIso, toIso) {
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / (1000 * 60 * 60 * 24)));
}

function addThresholdAchievement(items, key, currentValue, target, nowIso, context = null) {
  items.push({
    key,
    progressValue: Math.min(currentValue, target),
    progressTarget: target,
    unlock: currentValue >= target,
    context: currentValue >= target ? context ?? {} : {},
    nowIso,
  });
}

export function buildAchievementState(user, nowIso, maps) {
  const achievements = [];
  const matchesPlayed = Number(user.matches_played ?? 0);
  const wins = Number(user.wins ?? 0);
  const streak = Number(user.streak ?? 0);
  const rank = Number(user.rank ?? 0);
  const elo = Number(user.global_elo ?? 1200);
  const seasonsCreated = maps.seasonsCreated.get(user.id) ?? 0;
  const tournamentsCreated = maps.tournamentsCreated.get(user.id) ?? 0;
  const seasonsPlayed = maps.seasonsPlayed.get(user.id) ?? 0;
  const tournamentsPlayed = maps.tournamentsPlayed.get(user.id) ?? 0;
  const singlesCount = maps.singlesCount.get(user.id) ?? 0;
  const doublesCount = maps.doublesCount.get(user.id) ?? 0;
  const perfect11Count = maps.perfect11Count.get(user.id) ?? 0;
  const perfect21Count = maps.perfect21Count.get(user.id) ?? 0;
  const blowout11Count = maps.blowout11Count.get(user.id) ?? 0;
  const blowout21Count = maps.blowout21Count.get(user.id) ?? 0;
  const seasonWinnerCount = maps.seasonWinnerCount.get(user.id) ?? 0;
  const seasonPodiumCount = maps.seasonPodiumCount.get(user.id) ?? 0;
  const tournamentWinnerCount = maps.tournamentWinnerCount.get(user.id) ?? 0;
  const tournamentFinalCount = maps.tournamentFinalCount.get(user.id) ?? 0;
  const elapsedDays = daysBetween(user.created_at, nowIso);

  addThresholdAchievement(achievements, "account_created", 1, 1, nowIso);
  for (const target of [1, 3, 5, 10, 25, 50, 100]) {
    addThresholdAchievement(achievements, target === 1 ? "first_match" : `matches_${target}`, matchesPlayed, target, nowIso);
  }
  addThresholdAchievement(achievements, "first_win", wins, 1, nowIso);
  addThresholdAchievement(achievements, "first_singles", singlesCount, 1, nowIso);
  addThresholdAchievement(achievements, "singles_10", singlesCount, 10, nowIso);
  addThresholdAchievement(achievements, "first_doubles", doublesCount, 1, nowIso);
  addThresholdAchievement(achievements, "doubles_10", doublesCount, 10, nowIso);
  addThresholdAchievement(achievements, "win_streak_3", Math.max(streak, 0), 3, nowIso, { streak });
  addThresholdAchievement(achievements, "win_streak_5", Math.max(streak, 0), 5, nowIso, { streak });
  addThresholdAchievement(achievements, "perfect_11_0", perfect11Count, 1, nowIso);
  addThresholdAchievement(achievements, "perfect_21_0", perfect21Count, 1, nowIso);
  addThresholdAchievement(achievements, "blowout_11_4", blowout11Count, 1, nowIso);
  addThresholdAchievement(achievements, "blowout_21_9", blowout21Count, 1, nowIso);
  addThresholdAchievement(achievements, "rank_top_10", matchesPlayed >= 10 && rank <= 10 ? 10 : 0, 10, nowIso, { rank });
  addThresholdAchievement(achievements, "rank_top_3", matchesPlayed >= 15 && rank <= 3 ? 3 : 0, 3, nowIso, { rank });
  addThresholdAchievement(achievements, "rank_1", matchesPlayed >= 30 && rank === 1 ? 1 : 0, 1, nowIso, { rank });
  addThresholdAchievement(achievements, "season_creator", seasonsCreated, 1, nowIso);
  addThresholdAchievement(achievements, "seasons_3", seasonsCreated, 3, nowIso);
  addThresholdAchievement(achievements, "seasons_5", seasonsCreated, 5, nowIso);
  addThresholdAchievement(achievements, "season_played", seasonsPlayed, 1, nowIso);
  addThresholdAchievement(achievements, "seasons_played_3", seasonsPlayed, 3, nowIso);
  addThresholdAchievement(achievements, "seasons_played_5", seasonsPlayed, 5, nowIso);
  addThresholdAchievement(achievements, "season_podium", seasonPodiumCount, 1, nowIso);
  addThresholdAchievement(achievements, "season_winner", seasonWinnerCount, 1, nowIso);
  addThresholdAchievement(achievements, "season_podiums_3", seasonPodiumCount, 3, nowIso);
  addThresholdAchievement(achievements, "season_wins_3", seasonWinnerCount, 3, nowIso);
  addThresholdAchievement(achievements, "tournament_creator", tournamentsCreated, 1, nowIso);
  addThresholdAchievement(achievements, "tournaments_3", tournamentsCreated, 3, nowIso);
  addThresholdAchievement(achievements, "tournaments_5", tournamentsCreated, 5, nowIso);
  addThresholdAchievement(achievements, "tournament_played", tournamentsPlayed, 1, nowIso);
  addThresholdAchievement(achievements, "tournaments_played_3", tournamentsPlayed, 3, nowIso);
  addThresholdAchievement(achievements, "tournaments_played_5", tournamentsPlayed, 5, nowIso);
  addThresholdAchievement(achievements, "tournament_finalist", tournamentFinalCount, 1, nowIso);
  addThresholdAchievement(achievements, "tournament_winner", tournamentWinnerCount, 1, nowIso);
  addThresholdAchievement(achievements, "tournament_finals_3", tournamentFinalCount, 3, nowIso);
  addThresholdAchievement(achievements, "tournament_wins_3", tournamentWinnerCount, 3, nowIso);
  addThresholdAchievement(achievements, "elo_1250", elo, 1250, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1350", elo, 1350, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1500", elo, 1500, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1700", elo, 1700, nowIso, { elo });
  addThresholdAchievement(achievements, "days_30", elapsedDays, 30, nowIso);
  addThresholdAchievement(achievements, "days_180", elapsedDays, 180, nowIso);
  addThresholdAchievement(achievements, "days_365", elapsedDays, 365, nowIso);

  return achievements;
}
