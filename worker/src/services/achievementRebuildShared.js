function daysBetween(fromIso, toIso) {
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / (1000 * 60 * 60 * 24)));
}

const RANK_ONE_MIN_MATCHES = 60;
const UNSTOPPABLE_STREAK_TARGET = 7;

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
  const marathonMatchCount = maps.marathonMatchCount?.get(user.id) ?? 0;
  const luckyNumbersCount = maps.luckyNumbersCount?.get(user.id) ?? 0;
  const mirrorMatchCount = maps.mirrorMatchCount?.get(user.id) ?? 0;
  const stylePointsCount = maps.stylePointsCount?.get(user.id) ?? 0;
  const squadPartnerCount = maps.squadPartnerCount?.get(user.id) ?? 0;
  const rivalMatchesMax = maps.rivalMatchesMax?.get(user.id) ?? 0;
  const unbeatenRunMax = maps.unbeatenRunMax?.get(user.id) ?? 0;
  const weeklyMatchStreak = maps.weeklyMatchStreak?.get(user.id) ?? 0;
  const comebackWinsCount = maps.comebackWinsCount?.get(user.id) ?? 0;
  const deuceWinsCount = maps.deuceWinsCount?.get(user.id) ?? 0;
  const decidingSetWinsCount = maps.decidingSetWinsCount?.get(user.id) ?? 0;
  const clutchComebackCount = maps.clutchComebackCount?.get(user.id) ?? 0;
  const upsetVictoryCount = maps.upsetVictoryCount?.get(user.id) ?? 0;
  const seasonWinnerCount = maps.seasonWinnerCount.get(user.id) ?? 0;
  const seasonPodiumCount = maps.seasonPodiumCount.get(user.id) ?? 0;
  const spring2026ChampionCount = maps.spring2026ChampionCount?.get(user.id) ?? 0;
  const spring2026Top3Count = maps.spring2026Top3Count?.get(user.id) ?? 0;
  const tournamentWinnerCount = maps.tournamentWinnerCount.get(user.id) ?? 0;
  const tournamentFinalCount = maps.tournamentFinalCount.get(user.id) ?? 0;
  const rankDynastyCount = maps.rankDynastyCount?.get(user.id) ?? 0;
  const topTenDefenderCount = maps.topTenDefenderCount?.get(user.id) ?? 0;
  const completionist25Count = maps.completionist25Count?.get(user.id) ?? 0;
  const completionist50Count = maps.completionist50Count?.get(user.id) ?? 0;
  const completionist75Count = maps.completionist75Count?.get(user.id) ?? 0;
  const allRounderCount = maps.allRounderCount?.get(user.id) ?? 0;
  const elapsedDays = daysBetween(user.created_at, nowIso);

  addThresholdAchievement(achievements, "account_created", 1, 1, nowIso);
  for (const target of [1, 3, 5, 10, 25, 50, 100, 250, 500, 1000]) {
    addThresholdAchievement(achievements, target === 1 ? "first_match" : `matches_${target}`, matchesPlayed, target, nowIso);
  }
  addThresholdAchievement(achievements, "first_win", wins, 1, nowIso);
  addThresholdAchievement(achievements, "first_singles", singlesCount, 1, nowIso);
  addThresholdAchievement(achievements, "singles_10", singlesCount, 10, nowIso);
  addThresholdAchievement(achievements, "first_doubles", doublesCount, 1, nowIso);
  addThresholdAchievement(achievements, "doubles_10", doublesCount, 10, nowIso);
  addThresholdAchievement(achievements, "win_streak_3", Math.max(streak, 0), 3, nowIso, { streak });
  addThresholdAchievement(
    achievements,
    "win_streak_7",
    Math.max(streak, 0),
    UNSTOPPABLE_STREAK_TARGET,
    nowIso,
    { streak },
  );
  addThresholdAchievement(achievements, "perfect_11_0", perfect11Count, 1, nowIso);
  addThresholdAchievement(achievements, "perfect_21_0", perfect21Count, 1, nowIso);
  addThresholdAchievement(achievements, "blowout_11_4", blowout11Count, 1, nowIso);
  addThresholdAchievement(achievements, "blowout_21_9", blowout21Count, 1, nowIso);
  addThresholdAchievement(achievements, "iron_wall_10", unbeatenRunMax, 10, nowIso);
  addThresholdAchievement(achievements, "marathon_match", marathonMatchCount, 1, nowIso);
  addThresholdAchievement(achievements, "lucky_numbers", luckyNumbersCount, 7, nowIso);
  addThresholdAchievement(achievements, "mirror_match", mirrorMatchCount, 1, nowIso);
  addThresholdAchievement(achievements, "style_points", stylePointsCount, 3, nowIso);
  addThresholdAchievement(achievements, "rank_top_10", matchesPlayed >= 10 && rank <= 10 ? 10 : 0, 10, nowIso, { rank });
  addThresholdAchievement(achievements, "rank_top_3", matchesPlayed >= 15 && rank <= 3 ? 3 : 0, 3, nowIso, { rank });
  addThresholdAchievement(
    achievements,
    "rank_1",
    matchesPlayed >= RANK_ONE_MIN_MATCHES && rank === 1 ? 1 : 0,
    1,
    nowIso,
    { rank },
  );
  addThresholdAchievement(achievements, "rank_dynasty_10", rankDynastyCount, 10, nowIso, { rank });
  addThresholdAchievement(achievements, "top_five_defender_5", topTenDefenderCount, 5, nowIso, { rank });
  addThresholdAchievement(achievements, "upset_victory", upsetVictoryCount, 1, nowIso);
  addThresholdAchievement(
    achievements,
    "positive_record_60",
    matchesPlayed >= 50 ? Math.round((wins / Math.max(matchesPlayed, 1)) * 100) : 0,
    60,
    nowIso,
  );
  addThresholdAchievement(
    achievements,
    "dominant_era_70",
    matchesPlayed >= 30 ? Math.round((wins / Math.max(matchesPlayed, 1)) * 100) : 0,
    70,
    nowIso,
  );
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
  addThresholdAchievement(achievements, "season_top3", seasonPodiumCount, 1, nowIso);
  addThresholdAchievement(achievements, "season_champion", seasonWinnerCount, 1, nowIso);
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
  addThresholdAchievement(achievements, "squad_goals", squadPartnerCount, 5, nowIso);
  addThresholdAchievement(achievements, "rivalry_begins", rivalMatchesMax, 5, nowIso);
  addThresholdAchievement(achievements, "arch_rival", rivalMatchesMax, 15, nowIso);
  addThresholdAchievement(achievements, "weekly_warrior_4", weeklyMatchStreak, 4, nowIso);
  addThresholdAchievement(achievements, "all_rounder", allRounderCount, 4, nowIso);
  addThresholdAchievement(achievements, "elo_1250", elo, 1250, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1350", elo, 1350, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1500", elo, 1500, nowIso, { elo });
  addThresholdAchievement(achievements, "elo_1700", elo, 1700, nowIso, { elo });
  addThresholdAchievement(achievements, "deuce_master", deuceWinsCount, 5, nowIso);
  addThresholdAchievement(achievements, "ice_cold", decidingSetWinsCount, 1, nowIso);
  addThresholdAchievement(achievements, "clutch_player", clutchComebackCount, 1, nowIso);
  addThresholdAchievement(achievements, "comeback_king", comebackWinsCount, 3, nowIso);
  addThresholdAchievement(achievements, "completionist_25", completionist25Count, 25, nowIso);
  addThresholdAchievement(achievements, "completionist_50", completionist50Count, 50, nowIso);
  addThresholdAchievement(achievements, "completionist_75", completionist75Count, 75, nowIso);
  addThresholdAchievement(achievements, "days_30", elapsedDays, 30, nowIso);
  addThresholdAchievement(achievements, "days_180", elapsedDays, 180, nowIso);
  addThresholdAchievement(achievements, "days_365", elapsedDays, 365, nowIso);

  return achievements;
}
