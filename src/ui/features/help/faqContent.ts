export type FaqDetail = {
  en: string;
  de: string;
};

export interface FaqEntry {
  titleEn: string;
  titleDe: string;
  details: FaqDetail[];
}

export const faqEntries: FaqEntry[] = [
  {
    titleEn: "How Elo works",
    titleDe: "Wie Elo funktioniert",
    details: [
      {
        en: "Every ranked match updates both players: winners gain Elo, losers drop Elo, and the size of the change depends on how big the pre-match rating gap was and whether you played a single game or best-of-3.",
        de: "Jedes gerankte Match verändert beide Spieler: Gewinner bekommen Punkte, Verlierer verlieren Punkte, und die Höhe der Änderung richtet sich nach dem Rating-Unterschied vor dem Spiel und dem Spielmodus.",
      },
      {
        en: "SpinRank follows the classic Elo formula, applies a combined K-factor (40 until you reach 30 matches, then 24), so newer or less-active players jump faster while steady players settle, and splits the rounded change evenly across teammates.",
        de: "SpinRank nutzt die klassische Elo-Formel und einen kombinierten K-Faktor (40 bis 30 Matches, danach 24), so dass neue oder selten aktive Spieler größere Sprünge machen, während Regelmäßige ruhiger werden, und die gerundete Änderung gleichmäßig auf beide Partner verteilt wird.",
      },
      {
        en: "In doubles matches we average both teams’ ratings before running the math, and every player shares the same signed change so partnerships move together.",
        de: "Bei Doppelmatches mitteln wir die Ratings beider Teams, berechnen die Änderung und teilen denselben Wert an jedes Teammitglied aus, damit Partner gleich stark nach oben oder unten gehen.",
      },
    ],
  },
  {
    titleEn: "Soft deletes & recalculations",
    titleDe: "Soft Deletes & Nachberechnungen",
    details: [
      {
        en: "Deleted matches, tournaments, or seasons stay visible in your history but stop counting toward rankings, and the backend reruns the remaining results so leaderboards and streaks adjust to the removal.",
        de: "Gelöschte Matches, Turniere oder Saisons bleiben im Verlauf sichtbar, zählen aber nicht mehr für Ranglisten; das System blickt die übrigen Ergebnisse nochmal durch, damit Listen und Serien sich entsprechend anpassen.",
      },
      {
        en: "Because the same Elo math runs again without the deleted result, everyone in that season or tournament can drift a few points up or down depending on how that match influenced expectations.",
        de: "Weil nach dem Entfernen eines Ergebnisses die gleiche Elo-Rechnung nochmal durchläuft, können sich alle Beteiligten in der jeweiligen Saison oder dem Turnier je nach Einfluss der entfernten Partie um ein paar Punkte nach oben oder unten bewegen.",
      },
    ],
  },
  {
    titleEn: "Global, Season & Tournament Rankings",
    titleDe: "Globale, Saison- & Turnier-Rankings",
    details: [
      {
        en: "The global leaderboard aggregates every ranked match you can access; season and tournament leaderboards only include matches assigned to that context.",
        de: "Die globale Bestenliste fasst alle gerankten Matches zusammen; Saison- und Turnierlisten zeigen nur die Partien, die genau diesem Kontext zugewiesen wurden.",
      },
      {
        en: "Tournaments can be tied to a season; when linked, their matches impact both the tournament leaderboard and the parent season.",
        de: "Turniere lassen sich einer Saison zuordnen; sind sie verknüpft, beeinflussen ihre Matches sowohl das Turnier-Ranking als auch die übergeordnete Saison.",
      },
      {
        en: "Within any leaderboard we sort by Elo first, then by more wins, fewer losses, and finally alphabetically so ties stay consistent.",
        de: "In jeder Liste sortieren wir nach Elo, bei Gleichstand nach mehr Siegen, dann weniger Niederlagen und zuletzt alphabetisch, damit es immer eine klare Reihenfolge gibt.",
      },
    ],
  },
  {
    titleEn: "Match contexts & types",
    titleDe: "Match-Kontexte & Typen",
    details: [
      {
        en: "Matches can be singles or doubles, played as single games or best-of-3, and you can choose the number of points needed for victory.",
        de: "Matches können Einzel- oder Doppelpartien sein, als Einzelspiel oder Best-of-3 ausgetragen werden, und du legst fest, wie viele Punkte den Sieg entscheiden.",
      },
      {
        en: "You can leave the season or tournament fields empty to log open-play matches; they still count toward the global Elo.",
        de: "Lässt du Saison- oder Turnierfelder frei, bleibt das Match ein freies Spiel und wirkt sich dennoch auf die globale Elo aus.",
      },
    ],
  },
  {
    titleEn: "Seasons, tournaments & matches",
    titleDe: "Saisons, Turniere & Matches",
    details: [
      {
        en: "Seasons group matches and tournaments over a span of time; save them once and reuse them whenever you want to drop results under that season.",
        de: "Saisons bündeln Matches und Turniere in einem Zeitraum; speichere sie einmal und verwende sie immer wieder, wenn du Ergebnisse dieser Saison zuordnen willst.",
      },
      {
        en: "You can record matches that don't belong to any season or tournament—great for pickup games or practice—while tournaments can live inside a season without forcing every match to carry the season tag.",
        de: "Du kannst auch Matches protokollieren, die keiner Saison oder keinem Turnier angehören, etwa für spontane Spiele oder Training, und Turniere dürfen einer Saison angehören, ohne dass jede Partie automatisch den Saison-Tag braucht.",
      },
    ],
  },
  {
    titleEn: "Season Elo modes",
    titleDe: "Saison-Elo-Modi",
    details: [
      {
        en: "Choosing ‘Carry over Elo’ keeps everyone’s current rating, streaks, and win/loss record in the new season, while ‘Reset Elo to 1200’ gives everyone a fresh 1200 rating so the leaderboard starts from scratch.",
        de: "Mit „Carry over Elo“ übernimmt die neue Saison alle bisherigen Ratings, Serien und Siege/Niederlagen; „Reset Elo to 1200“ startet mit 1200 Punkten und behandelt die Saison wie einen sauberen Neustart.",
      },
      {
        en: "Either way, every match still shows up in the global history; resetting is useful if you want a new league or throwback event without past streaks or hot runs dominating the standings.",
        de: "Beide Modi behalten die Matches in der globalen Historie; ein Reset eignet sich, wenn du eine neue Liga oder Retro-Veranstaltung willst, ohne dass alte Serien die Tabelle dominieren.",
      },
    ],
  },
  {
    titleEn: "Suggest helpers",
    titleDe: "Vorschlagshelfer",
    details: [
      {
        en: "“Suggest fair teams” looks at Elo plus win rate to balance you with the closest-matched opponents, then fills the match form for you so you can just confirm the score.",
        de: "„Faire Teams vorschlagen“ verwendet Elo und Siegquote, um dich mit einem ähnlich starken Gegner zu kombinieren, und trägt die Auswahl direkt ins Match-Formular ein.",
      },
      {
        en: "“Suggest tournament” seeds a bracket by ranking players with a strength score (Elo + win rate + recent activity) and separating top seeds, so the planner panels update with those placements and you can immediately generate matches.",
        de: "„Turnier vorschlagen“ ordnet die Teilnehmenden nach einem Strength-Score (Elo + Siegquote + Aktivität), verteilt die Top-Seeds und aktualisiert das Bracket-Panel, damit du direkt Matches erzeugen kannst.",
      },
    ],
  },
];
