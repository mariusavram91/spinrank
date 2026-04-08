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
    titleEn: "What changes what?",
    titleDe: "Was beeinflusst was?",
    details: [
      {
        en: "SpinRank shows three views: global ranking, season ranking, and tournament placement. They are connected, but they answer different questions.",
        de: "SpinRank zeigt drei Ansichten: globale Rangliste, Saison-Rangliste und Turnierplatzierung. Sie hängen zusammen, beantworten aber unterschiedliche Fragen.",
      },
      {
        en: "Simple rule: every ranked match affects your global ranking. Only matches inside a season affect that season. Tournament placement depends on how far you move through the bracket.",
        de: "Die einfache Regel ist: Jedes gerankte Match beeinflusst deine globale Rangliste. Nur Matches innerhalb einer Saison zählen für diese Saison. Die Turnierplatzierung hängt davon ab, wie weit du im Bracket kommst.",
      },
    ],
  },
  {
    titleEn: "Global ranking",
    titleDe: "Globale Rangliste",
    details: [
      {
        en: "Your global ranking is your long-term overall rating. It includes every active ranked match you played, whether it was open play, part of a season, part of a tournament, or both.",
        de: "Deine globale Rangliste ist dein langfristiger Gesamtwert. Sie umfasst jedes aktive gerankte Match, das du gespielt hast, egal ob freies Spiel, Teil einer Saison, Teil eines Turniers oder beides.",
      },
      {
        en: "If a ranked match is deleted later, it stops counting. Global ranking is not limited to one season or one tournament.",
        de: "Wenn ein geranktes Match später gelöscht wird, zählt es nicht mehr. Die globale Rangliste ist nicht auf eine Saison oder ein Turnier begrenzt.",
      },
    ],
  },
  {
    titleEn: "Season ranking",
    titleDe: "Saison-Rangliste",
    details: [
      {
        en: "A season only looks at matches inside that season. Open-play matches outside the season do not affect the season table.",
        de: "Eine Saison betrachtet nur Matches innerhalb dieser Saison. Freie Matches außerhalb der Saison beeinflussen die Saison-Tabelle nicht.",
      },
      {
        en: "If a tournament is linked to a season, its tournament matches also count for that season.",
        de: "Wenn ein Turnier mit einer Saison verknüpft ist, zählen seine Turnier-Matches auch für diese Saison.",
      },
      {
        en: "Season score uses Glicko-2 instead of plain Elo. In simple terms: Elo mainly moves your number up or down, while Glicko-2 also tracks how sure the system is about that number.",
        de: "Der Saison-Score nutzt Glicko-2 statt der normalen Elo. Einfach gesagt: Elo verschiebt vor allem deine Zahl nach oben oder unten, während Glicko-2 zusätzlich erfasst, wie sicher sich das System bei dieser Zahl ist.",
      },
      {
        en: "The visible season score is not the raw Glicko-2 rating. SpinRank shows a cautious version: rating minus two times uncertainty, then minus any attendance penalty.",
        de: "Der sichtbare Saison-Score ist nicht das rohe Glicko-2-Rating. SpinRank zeigt eine vorsichtige Version: Rating minus zweimal Unsicherheit, minus einer möglichen Teilnahme-Strafe.",
      },
      {
        en: "That is why a reset season can start at 500 on screen even though the base rating is 1200. That 500 example is for a fresh reset, not for carry over. Carry over starts from your current rating, so the visible starting score is not fixed and can be above or below 500.",
        de: "Deshalb kann eine zurückgesetzte Saison auf dem Bildschirm bei 500 starten, obwohl das Basis-Rating 1200 ist. Dieses 500-Beispiel gilt für einen frischen Reset, nicht für Übernehmen. Übernehmen startet mit deinem aktuellen Rating, daher ist der sichtbare Startwert nicht fest und kann über oder unter 500 liegen.",
      },
      {
        en: "Attendance matters too. After two missed season weeks, each extra missed week lowers the season score a little, up to 16 points total.",
        de: "Auch die Teilnahme zählt. Nach zwei verpassten Saisonwochen senkt jede weitere verpasste Woche den Saison-Score ein wenig, insgesamt um maximal 16 Punkte.",
      },
    ],
  },
  {
    titleEn: "Tournament placement",
    titleDe: "Turnierplatzierung",
    details: [
      {
        en: "Tournament placement is based on the bracket, not on a separate rating number. The winner finishes first, then the finalist, then players who went out in earlier rounds.",
        de: "Die Turnierplatzierung basiert auf dem Bracket, nicht auf einer eigenen Rating-Zahl. Der Sieger ist auf Platz eins, dann der Finalist, danach die Spieler, die in früheren Runden ausgeschieden sind.",
      },
      {
        en: "Tournament matches always count for the tournament itself and for your global ranking. They only count for a season when that tournament is linked to a season.",
        de: "Turnier-Matches zählen immer für das Turnier selbst und für deine globale Rangliste. Für eine Saison zählen sie nur dann, wenn das Turnier mit dieser Saison verknüpft ist.",
      },
      {
        en: "So one tournament match can affect more than one view at the same time, but the bracket result still decides the tournament order.",
        de: "Ein Turnier-Match kann also mehrere Ansichten gleichzeitig beeinflussen, aber die Reihenfolge im Turnier wird weiterhin durch das Bracket bestimmt.",
      },
    ],
  },
  {
    titleEn: "Match types",
    titleDe: "Match-Typen",
    details: [
      {
        en: "Matches can be singles or doubles. You can play one game or best-of-3, and you choose whether a game goes to 11 or 21 points.",
        de: "Matches können Einzel oder Doppel sein. Du kannst ein Spiel oder Best-of-3 spielen und festlegen, ob ein Spiel bis 11 oder 21 Punkte geht.",
      },
      {
        en: "Singles affect ratings more than doubles. Doubles still count, but with a lighter weight.",
        de: "Einzel beeinflussen Ratings stärker als Doppel. Doppel zählen trotzdem, aber mit geringerem Gewicht.",
      },
      {
        en: "Open-play matches do not need a season or tournament. They still count toward your global ranking, but not toward a season table or tournament placement unless you add them there.",
        de: "Freie Matches brauchen keine Saison und kein Turnier. Sie zählen trotzdem für deine globale Rangliste, aber nicht für eine Saison-Tabelle oder Turnierplatzierung, solange du sie dort nicht zuordnest.",
      },
    ],
  },
  {
    titleEn: "Season start options",
    titleDe: "Optionen zum Saisonstart",
    details: [
      {
        en: "When you create a season, you can either carry over the current rating or reset everyone to 1200.",
        de: "Wenn du eine Saison erstellst, kannst du entweder das aktuelle Rating übernehmen oder alle auf 1200 zurücksetzen.",
      },
      {
        en: "Carry over means the season's Glicko-2 rating starts from your current global rating. Reset means the season's Glicko-2 rating starts fresh at 1200 for everyone.",
        de: "Übernehmen bedeutet: Das Glicko-2-Rating der Saison startet mit deinem aktuellen globalen Rating. Zurücksetzen bedeutet: Das Glicko-2-Rating der Saison startet für alle neu bei 1200.",
      },
      {
        en: "For the visible season score, carry over depends on your current global rating, so it can start above or below 500. Reset gives everyone the same fresh 1200 base, which is why a fresh reset starts at the same cautious visible score before matches are played.",
        de: "Für den sichtbaren Saison-Score hängt Übernehmen von deinem aktuellen globalen Rating ab und kann daher über oder unter 500 starten. Reset gibt allen dieselbe frische 1200-Basis, deshalb startet ein frischer Reset vor den ersten Matches beim gleichen vorsichtigen sichtbaren Wert.",
      },
      {
        en: "Basic difference: carry over keeps the gap between stronger and weaker players from before the season. Reset removes those old gaps and lets season matches create the new visible score step by step.",
        de: "Der Grundunterschied ist: Übernehmen behält den Abstand zwischen stärkeren und schwächeren Spielern aus der Zeit vor der Saison. Zurücksetzen entfernt diese alten Abstände, und die Saison-Matches bauen den neuen sichtbaren Wert Schritt für Schritt auf.",
      },
    ],
  },
  {
    titleEn: "Helpful buttons",
    titleDe: "Hilfreiche Buttons",
    details: [
      {
        en: "\"Suggest fair matchup\" fills the match form with players who look close in strength. For doubles, it tries to build two balanced teams around you.",
        de: "\"Faires Matchup vorschlagen\" füllt das Match-Formular mit Spielern, die von der Stärke her nah beieinander liegen. Im Doppel versucht die Funktion, rund um dich zwei ausgeglichene Teams zu bilden.",
      },
      {
        en: "\"Suggest tournament\" builds a bracket from the selected players and spreads stronger players apart in the draw so they do not all start on the same side.",
        de: "\"Turnier vorschlagen\" erstellt ein Bracket aus den ausgewählten Spielern und verteilt stärkere Spieler im Turnier, damit sie nicht alle auf derselben Seite starten.",
      },
    ],
  },
];
