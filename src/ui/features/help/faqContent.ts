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
        en: "SpinRank has three different ranking views: global Elo, season score, and tournament placement. They are related, but they are not the same thing.",
        de: "SpinRank hat drei verschiedene Ranking-Ansichten: globale Elo, Saison-Score und Turnierplatzierung. Sie hängen zusammen, sind aber nicht dasselbe.",
      },
      {
        en: "The easiest rule is: every ranked match updates global Elo, season matches update the season table, and tournament brackets decide tournament placement.",
        de: "Die einfachste Regel ist: Jedes gerankte Match aktualisiert die globale Elo, Saison-Matches aktualisieren die Saison-Tabelle, und Turnier-Brackets bestimmen die Turnierplatzierung.",
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
        en: "Global leaderboard: this is your long-term overall Elo. It includes every active ranked match you played, whether that match was open play, part of a season, part of a tournament, or both.",
        de: "Globale Bestenliste: Das ist deine langfristige Gesamt-Elo. Sie umfasst jedes aktive gerankte Match, das du gespielt hast, egal ob freies Spiel, Teil einer Saison, Teil eines Turniers oder beides.",
      },
      {
        en: "What changes global Elo: every active ranked match. If a match is deleted later, it stops counting. Global Elo is not limited to one season or one tournament.",
        de: "Was die globale Elo verändert: jedes aktive gerankte Match. Wenn ein Match später gelöscht wird, zählt es nicht mehr. Die globale Elo ist nicht auf eine bestimmte Saison oder ein bestimmtes Turnier begrenzt.",
      },
      {
        en: "Season leaderboard: this does not use plain Elo. Seasons use Glicko-2, and the shown season score is a conservative score: rating minus two times rating deviation, then minus any attendance penalty.",
        de: "Saison-Bestenliste: Hier wird nicht die normale Elo verwendet. Saisons nutzen Glicko-2, und der angezeigte Saison-Score ist ein konservativer Wert: Rating minus zweimal Rating Deviation, minus einer möglichen Anwesenheitsstrafe.",
      },
      {
        en: "What counts toward a season: only matches inside that season. That includes regular season matches and also tournament matches when the tournament is linked to that season. Matches outside the season do not affect that season table.",
        de: "Was für eine Saison zählt: nur Matches innerhalb dieser Saison. Dazu gehören normale Saison-Matches und auch Turnier-Matches, wenn das Turnier mit dieser Saison verknüpft ist. Matches außerhalb der Saison beeinflussen diese Saison-Tabelle nicht.",
      },
      {
        en: "Attendance matters in seasons too. After two missed season weeks, each additional missed week applies a small penalty, capped at 16 points.",
        de: "Auch Anwesenheit zählt in Saisons. Nach zwei verpassten Saisonwochen gibt es für jede weitere verpasste Woche eine kleine Strafe, maximal 16 Punkte.",
      },
      {
        en: "Tournament leaderboard: this is placement-based, not a separate rating score. The bracket decides the order: winner first, then finalist, then players eliminated in earlier rounds.",
        de: "Turnier-Bestenliste: Diese basiert auf Platzierungen, nicht auf einem eigenen Rating-Score. Das Bracket bestimmt die Reihenfolge: Sieger zuerst, dann Finalist, dann Spieler, die in früheren Runden ausgeschieden sind.",
      },
      {
        en: "What counts toward a tournament: only matches played in that tournament bracket. Tournament placement is about how far you advanced, not about your global Elo or season score.",
        de: "Was für ein Turnier zählt: nur Matches, die in diesem Turnier-Bracket gespielt wurden. Die Turnierplatzierung hängt davon ab, wie weit du gekommen bist, nicht von deiner globalen Elo oder deinem Saison-Score.",
      },
      {
        en: "Important overlap: a tournament match always counts for the tournament itself, also counts for global Elo, and counts for a season only if that tournament is attached to a season.",
        de: "Wichtige Überschneidung: Ein Turnier-Match zählt immer für das Turnier selbst, außerdem für die globale Elo und nur dann auch für eine Saison, wenn dieses Turnier einer Saison zugeordnet ist.",
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
        en: "Open-play matches do not need a season or tournament. They still count toward your global Elo, but they do not affect any season table or tournament placement unless you attach them there.",
        de: "Freie Matches brauchen keine Saison oder kein Turnier. Sie zählen trotzdem für deine globale Elo, beeinflussen aber keine Saison-Tabelle und keine Turnierplatzierung, solange du sie nicht dort zuordnest.",
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
        en: "You can attach a match to a season, a tournament, both, or neither. That choice decides which leaderboard views the match appears in, while global Elo still updates from every ranked match.",
        de: "Du kannst ein Match einer Saison, einem Turnier, beidem oder auch gar nichts zuordnen. Diese Zuordnung entscheidet, in welchen Bestenlisten das Match erscheint, während die globale Elo trotzdem aus jedem gerankten Match aktualisiert wird.",
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
