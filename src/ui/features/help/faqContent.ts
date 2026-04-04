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
    titleEn: "How ranking works",
    titleDe: "Wie das Ranking funktioniert",
    details: [
      {
        en: "Every ranked match changes both players' Elo. The winner gains points and the loser loses points.",
        de: "Jedes gerankte Match verändert die Elo beider Spieler. Der Sieger gewinnt Punkte und der Verlierer verliert Punkte.",
      },
      {
        en: "The size of the change depends on how close the two sides were before the match started.",
        de: "Wie groß die Änderung ist, hängt davon ab, wie nah die beiden Seiten vor dem Match beieinander lagen.",
      },
    ],
  },
  {
    titleEn: "Removed items",
    titleDe: "Gelöschte Einträge",
    details: [
      {
        en: "Deleted matches, tournaments, or seasons stay visible in your history, but they stop counting toward rankings.",
        de: "Gelöschte Matches, Turniere oder Saisons bleiben in deinem Verlauf sichtbar, zählen aber nicht mehr für die Ranglisten.",
      },
      {
        en: "If you delete a result, everyone affected by that result can move a little up or down again once the standings are recalculated.",
        de: "Wenn du ein Ergebnis löschst, können sich alle Beteiligten nach der Neuberechnung wieder ein Stück nach oben oder unten bewegen.",
      },
    ],
  },
  {
    titleEn: "Ranking types",
    titleDe: "Ranking-Arten",
    details: [
      {
        en: "The global leaderboard shows your overall Elo from every ranked match you can access.",
        de: "Die globale Bestenliste zeigt deine gesamte Elo aus allen gerankten Matches, auf die du Zugriff hast.",
      },
      {
        en: "Season leaderboards use a season score, so active players can be ranked ahead of someone with the same Elo who has been away for a while.",
        de: "Saison-Listen nutzen einen Season-Score, damit aktive Spieler vor jemandem mit derselben Elo landen können, der länger nicht gespielt hat.",
      },
      {
        en: "That means a player can be ahead with fewer wins if they were more active recently or had less inactivity penalty.",
        de: "Das heißt: Ein Spieler kann trotz weniger Siegen vorne liegen, wenn er zuletzt aktiver war oder weniger Inaktivitätsabzug hatte.",
      },
      {
        en: "If a tournament belongs to a season, its matches also count toward that season's score. Open tournaments only affect the tournament itself.",
        de: "Gehört ein Turnier zu einer Saison, zählen seine Matches auch für den Season-Score dieser Saison. Offene Turniere beeinflussen nur das Turnier selbst.",
      },
    ],
  },
  {
    titleEn: "Match types",
    titleDe: "Match-Typen",
    details: [
      {
        en: "Matches can be singles or doubles, played as single games or best-of-3, and you can choose the number of points needed for victory.",
        de: "Matches können Einzel- oder Doppelpartien sein, als Einzelspiel oder Best-of-3 ausgetragen werden, und du legst fest, wie viele Punkte den Sieg entscheiden.",
      },
      {
        en: "Open-play matches do not need a season or tournament. They still count toward your global Elo.",
        de: "Freie Matches brauchen keine Saison oder kein Turnier. Sie zählen trotzdem für deine globale Elo.",
      },
    ],
  },
  {
    titleEn: "Organizing games",
    titleDe: "Spiele ordnen",
    details: [
      {
        en: "Seasons group your games over time, so it is easy to look back at one stretch of play later.",
        de: "Saisons bündeln deine Spiele über einen Zeitraum, damit du später leicht auf eine bestimmte Spielphase schauen kannst.",
      },
      {
        en: "You can attach a match to a season, a tournament, both, or neither.",
        de: "Du kannst ein Match einer Saison, einem Turnier, beidem oder auch gar nichts zuordnen.",
      },
    ],
  },
  {
    titleEn: "Season settings",
    titleDe: "Saison-Einstellungen",
    details: [
      {
        en: "Choosing ‘Carry over Elo’ keeps everyone’s current rating, streaks, and win/loss record in the new season.",
        de: "Mit „Carry over Elo“ übernimmt die neue Saison alle bisherigen Ratings, Serien und Siege/Niederlagen.",
      },
      {
        en: "‘Reset Elo to 1200’ gives everyone a fresh 1200 rating so the season starts from the same place.",
        de: "„Reset Elo to 1200“ gibt allen 1200 Punkte, damit die Saison am gleichen Startpunkt beginnt.",
      },
    ],
  },
  {
    titleEn: "Helpful buttons",
    titleDe: "Hilfreiche Buttons",
    details: [
      {
        en: "“Suggest fair matchup” picks players with similar strength and fills the match form for you.",
        de: "„Faires Matchup vorschlagen“ wählt Spieler mit ähnlicher Stärke aus und füllt das Match-Formular für dich aus.",
      },
      {
        en: "“Suggest tournament” builds a bracket from the selected players and places stronger players apart near the top of the draw.",
        de: "„Turnier vorschlagen“ baut ein Bracket aus den ausgewählten Spielern und verteilt stärkere Spieler im oberen Teil des Turniers.",
      },
    ],
  },
];
