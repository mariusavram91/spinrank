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
        en: "Every ranked match updates both players: winners gain Elo, losers drop Elo, and the size of the change depends on the pre-match rating gap and whether you played singles or doubles.",
        de: "Jedes gerankte Match verändert beide Spieler: Gewinner bekommen Elo, Verlierer verlieren Elo, und die Höhe der Änderung richtet sich nach dem Rating-Unterschied vor dem Spiel und danach, ob Singles oder Doubles gespielt wurden.",
      },
      {
        en: "SpinRank uses a higher K-factor for newer players and steps it down after 10 and 30 equivalent matches, so fresh accounts move faster than established ones.",
        de: "SpinRank nutzt für neue Spieler einen höheren K-Faktor und senkt ihn nach 10 und 30 äquivalenten Matches ab, damit frische Accounts schneller reagieren als etablierte.",
      },
      {
        en: "Doubles count as a smaller match weight than singles, so the team change is slightly softer before it is split across teammates.",
        de: "Doubles zählen mit geringerem Gewicht als Singles, daher fällt die Teamänderung etwas sanfter aus, bevor sie auf die Teammitglieder verteilt wird.",
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
        en: "Global leaderboards still sort by raw Elo, but season leaderboards use a visible season score that adds a small activity bonus and subtracts inactivity over time; tournaments keep the raw Elo order.",
        de: "Die globale Bestenliste sortiert weiter nach roher Elo, aber Saison-Listen nutzen einen sichtbaren Season-Score mit Aktivitätsbonus und Inaktivitätsabzug; Turniere bleiben bei der rohen Elo-Reihenfolge.",
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
