export type FaqDetail = {
  en: string;
  de: string;
  es?: string;
};

export interface FaqEntry {
  titleEn: string;
  titleDe: string;
  titleEs?: string;
  details: FaqDetail[];
}

export interface FaqEntryEs {
  title: string;
  details: string[];
}

export const faqEntries: FaqEntry[] = [
  {
    titleEn: "What changes what?",
    titleDe: "Was beeinflusst was?",
    details: [
      {
        en: "SpinRank shows **three views**: *global ranking*, *season ranking*, and *tournament placement*. They are connected, but they answer different questions.",
        de: "SpinRank zeigt **drei Ansichten**: *globale Rangliste*, *Saison-Rangliste* und *Turnierplatzierung*. Sie hängen zusammen, beantworten aber unterschiedliche Fragen.",
      },
      {
        en: "**Simple rule:** every ranked match affects your *global ranking*. Only matches inside a season affect that *season*. *Tournament placement* depends on how far you move through the bracket.",
        de: "**Die einfache Regel ist:** Jedes gerankte Match beeinflusst deine *globale Rangliste*. Nur Matches innerhalb einer Saison zählen für diese *Saison*. Die *Turnierplatzierung* hängt davon ab, wie weit du im Bracket kommst.",
      },
    ],
  },
  {
    titleEn: "Global ranking",
    titleDe: "Globale Rangliste",
    details: [
      {
        en: "Your **global ranking** is your *long-term overall rating*. It includes **every active ranked match** you played, whether it was open play, part of a season, part of a tournament, or both.",
        de: "Deine **globale Rangliste** ist dein *langfristiger Gesamtwert*. Sie umfasst **jedes aktive gerankte Match**, das du gespielt hast, egal ob freies Spiel, Teil einer Saison, Teil eines Turniers oder beides.",
      },
      {
        en: "**Global ranking uses Elo.** In simple terms, Elo estimates your *overall skill level* across all ranked play, not just how you did in one short period.",
        de: "**Die globale Rangliste nutzt Elo.** Einfach gesagt schätzt Elo dein *allgemeines Spielniveau* über alle gerankten Matches hinweg ein und nicht nur, wie du dich in einem kurzen Zeitraum geschlagen hast.",
      },
      {
        en: "For **global Elo**, early results move faster: **0-9 match equivalents** are the fastest, **10-29** are calmer, and **30+** are steadier.",
        de: "Für die **globale Elo** bewegen frühe Ergebnisse den Wert stärker: **0-9 Match-Äquivalente** sind am schnellsten, **10-29** ruhiger und **ab 30** stabiler.",
      },
      {
        en: "If a ranked match is deleted later, it **stops counting**. Global ranking is **not limited** to one season or one tournament.",
        de: "Wenn ein geranktes Match später gelöscht wird, **zählt es nicht mehr**. Die globale Rangliste ist **nicht** auf eine Saison oder ein Turnier begrenzt.",
      },
      {
        en: "To be **fully qualified** in the global ranking, you need **at least 5 matches**. If you have fewer than 5, you still appear in the table, but **below all qualified players**.",
        de: "Um in der globalen Rangliste **voll qualifiziert** zu sein, brauchst du **mindestens 5 Matches**. Mit weniger als 5 Matches erscheinst du trotzdem in der Tabelle, aber **unter allen qualifizierten Spielern**.",
      },
      {
        en: "Players with **0 matches** are shown as *inactive*. They still appear in the list, but they have **not started building** a global ranking yet.",
        de: "Spieler mit **0 Matches** werden als *inaktiv* angezeigt. Sie erscheinen weiterhin in der Liste, haben aber **noch keine** globale Rangliste aufgebaut.",
      },
    ],
  },
  {
    titleEn: "Season ranking",
    titleDe: "Saison-Rangliste",
    details: [
      {
        en: "A **season** only looks at matches *inside that season*. Open-play matches outside the season **do not affect** the season table.",
        de: "Eine **Saison** betrachtet nur Matches *innerhalb dieser Saison*. Freie Matches außerhalb der Saison **beeinflussen** die Saison-Tabelle nicht.",
      },
      {
        en: "If a tournament is **linked to a season**, its tournament matches **also count** for that season.",
        de: "Wenn ein Turnier **mit einer Saison verknüpft** ist, zählen seine Turnier-Matches **auch** für diese Saison.",
      },
      {
        en: "**Season score uses Glicko-2**, not plain Elo. In simple terms: Elo mainly moves your number up or down, while **Glicko-2 also tracks how sure** the system is about that number.",
        de: "**Der Saison-Score nutzt Glicko-2**, nicht die normale Elo. Einfach gesagt: Elo verschiebt vor allem deine Zahl nach oben oder unten, während **Glicko-2 zusätzlich erfasst, wie sicher** sich das System bei dieser Zahl ist.",
      },
      {
        en: "That makes season scoring **better for short competitions**. The season rating is meant to reflect your *performance inside that season* more fairly, because it also considers **how reliable your results look** and applies any *attendance penalty* when showing the visible score.",
        de: "Das macht die Saisonwertung **besser für kürzere Wettbewerbe**. Das Saison-Rating soll deine *Leistung innerhalb dieser Saison* fairer abbilden, weil es auch **berücksichtigt, wie verlässlich deine Ergebnisse wirken**, und beim sichtbaren Wert eine *mögliche Teilnahme-Strafe* einbezieht.",
      },
      {
        en: "Unlike global Elo, **season Glicko-2 does not use the same 0-9 / 10-29 / 30+ step bands**. Its pace depends more on **uncertainty and reliability**: results can move more while the season picture is still unclear, then settle as it becomes more trustworthy.",
        de: "Anders als die globale Elo nutzt **Saison-Glicko-2 nicht dieselben Stufen 0-9 / 10-29 / ab 30**. Das Tempo hängt stärker von **Unsicherheit und Verlässlichkeit** ab: Ergebnisse können sich stärker bewegen, solange das Saisonbild noch unklar ist, und werden ruhiger, sobald es verlässlicher wird.",
      },
      {
        en: "The **visible season score** is **not** the raw Glicko-2 rating. SpinRank shows a *cautious version*: rating **minus two times uncertainty**, then **minus any attendance penalty**.",
        de: "Der **sichtbare Saison-Score** ist **nicht** das rohe Glicko-2-Rating. SpinRank zeigt eine *vorsichtige Version*: Rating **minus zweimal Unsicherheit**, dann **minus einer möglichen Teilnahme-Strafe**.",
      },
      {
        en: "That is why a **reset season** can start at **500 on screen** even though the base rating is 1200. That **500 example** is for a *fresh reset*, not for carry over. *Carry over* starts from your current rating, so the visible starting score is **not fixed** and can be above or below 500.",
        de: "Deshalb kann eine **zurückgesetzte Saison** auf dem Bildschirm bei **500** starten, obwohl das Basis-Rating 1200 ist. Dieses **500-Beispiel** gilt für einen *frischen Reset*, nicht für Übernehmen. *Übernehmen* startet mit deinem aktuellen Rating, daher ist der sichtbare Startwert **nicht fest** und kann über oder unter 500 liegen.",
      },
      {
        en: "**Attendance matters too.** After **two missed season weeks**, each extra missed week lowers the season score a little, up to **16 points total**.",
        de: "**Auch die Teilnahme zählt.** Nach **zwei verpassten Saisonwochen** senkt jede weitere verpasste Woche den Saison-Score ein wenig, insgesamt um **maximal 16 Punkte**.",
      },
    ],
  },
  {
    titleEn: "Tournament placement",
    titleDe: "Turnierplatzierung",
    details: [
      {
        en: "**Tournament placement** is based on the *bracket*, not on a separate rating number. The **winner** finishes first, then the finalist, then players who went out in earlier rounds.",
        de: "**Die Turnierplatzierung** basiert auf dem *Bracket*, nicht auf einer eigenen Rating-Zahl. Der **Sieger** ist auf Platz eins, dann der Finalist, danach die Spieler, die in früheren Runden ausgeschieden sind.",
      },
      {
        en: "Tournament matches **always count** for the tournament itself and for your *global ranking*. They only count for a *season* when that tournament is **linked to a season**.",
        de: "Turnier-Matches **zählen immer** für das Turnier selbst und für deine *globale Rangliste*. Für eine *Saison* zählen sie nur dann, wenn das Turnier **mit dieser Saison verknüpft** ist.",
      },
      {
        en: "So **one tournament match** can affect **more than one view** at the same time, but the *bracket result* still decides the tournament order.",
        de: "Ein **Turnier-Match** kann also **mehrere Ansichten gleichzeitig** beeinflussen, aber das *Bracket-Ergebnis* entscheidet weiterhin über die Turnierreihenfolge.",
      },
    ],
  },
  {
    titleEn: "Match types",
    titleDe: "Match-Typen",
    details: [
      {
        en: "Matches can be **singles or doubles**. You can play *one game* or *best-of-3*, and you choose whether a game goes to **11 or 21 points**.",
        de: "Matches können **Einzel oder Doppel** sein. Du kannst *ein Spiel* oder *Best-of-3* spielen und festlegen, ob ein Spiel bis **11 oder 21 Punkte** geht.",
      },
      {
        en: "**Singles affect ratings more** than doubles. Doubles still count, but with a **lighter 70% weight** in **both global and season rankings**.",
        de: "**Einzel beeinflussen Ratings stärker** als Doppel. Doppel zählen trotzdem, aber mit einem **leichteren Gewicht von 70 %** in **globaler und saisonaler Rangliste**.",
      },
      {
        en: "**Open-play matches** do not need a season or tournament. They still count toward your *global ranking*, but **not** toward a season table or tournament placement unless you add them there.",
        de: "**Freie Matches** brauchen keine Saison und kein Turnier. Sie zählen trotzdem für deine *globale Rangliste*, aber **nicht** für eine Saison-Tabelle oder Turnierplatzierung, solange du sie dort nicht zuordnest.",
      },
    ],
  },
  {
    titleEn: "Season start options",
    titleDe: "Optionen zum Saisonstart",
    details: [
      {
        en: "When you create a season, you can either **carry over** the current rating or **reset everyone to 1200**.",
        de: "Wenn du eine Saison erstellst, kannst du entweder das aktuelle Rating **übernehmen** oder **alle auf 1200 zurücksetzen**.",
      },
      {
        en: "**Carry over** means the season's Glicko-2 rating starts from your *current global rating*. **Reset** means the season's Glicko-2 rating starts fresh at **1200 for everyone**.",
        de: "**Übernehmen** bedeutet: Das Glicko-2-Rating der Saison startet mit deinem *aktuellen globalen Rating*. **Zurücksetzen** bedeutet: Das Glicko-2-Rating der Saison startet für alle neu bei **1200**.",
      },
      {
        en: "For the **visible season score**, *carry over* depends on your current global rating, so it can start **above or below 500**. *Reset* gives everyone the same fresh 1200 base, which is why a fresh reset starts at the same cautious visible score before matches are played.",
        de: "Für den **sichtbaren Saison-Score** hängt *Übernehmen* von deinem aktuellen globalen Rating ab und kann daher **über oder unter 500** starten. *Reset* gibt allen dieselbe frische 1200-Basis, deshalb startet ein frischer Reset vor den ersten Matches beim gleichen vorsichtigen sichtbaren Wert.",
      },
      {
        en: "**Basic difference:** *carry over* keeps the gap between stronger and weaker players from before the season. *Reset* removes those old gaps and lets season matches create the **new visible score step by step**.",
        de: "**Der Grundunterschied ist:** *Übernehmen* behält den Abstand zwischen stärkeren und schwächeren Spielern aus der Zeit vor der Saison. *Zurücksetzen* entfernt diese alten Abstände, und die Saison-Matches bauen den **neuen sichtbaren Wert Schritt für Schritt** auf.",
      },
    ],
  },
  {
    titleEn: "Deleting things",
    titleDe: "Löschen von Einträgen",
    details: [
      {
        en: "**Only the creator** can delete a *match*, *season*, or *tournament*.",
        de: "**Nur der Ersteller** kann ein *Match*, eine *Saison* oder ein *Turnier* löschen.",
      },
      {
        en: "Deleting means the item **stops counting** and no longer behaves like an active match, season, or tournament.",
        de: "Löschen bedeutet, dass der Eintrag **nicht mehr zählt** und sich nicht länger wie ein aktives Match, eine aktive Saison oder ein aktives Turnier verhält.",
      },
      {
        en: "Deleting a **match** removes its effect from scores. *Global Elo* is rolled back or recomputed, and if that match counted for a season or tournament, those scores are updated too.",
        de: "Das Löschen eines **Matches** entfernt seinen Einfluss auf die Werte. Die *globale Elo* wird zurückgerechnet oder neu berechnet, und wenn das Match für eine Saison oder ein Turnier gezählt hat, werden auch diese Werte aktualisiert.",
      },
      {
        en: "Deleting a **tournament** also deletes **all of its matches**. Those matches stop affecting *global ranking*, *season score* if linked, and the tournament view itself.",
        de: "Das Löschen eines **Turniers** löscht auch **alle zugehörigen Matches**. Diese Matches beeinflussen dann weder die *globale Rangliste* noch den *Saison-Score* bei verknüpfter Saison noch die Turnieransicht selbst.",
      },
      {
        en: "Deleting a **season** also deletes **its own matches**, **linked tournaments**, and **their matches**. After that, those results no longer count toward global or season-based scores.",
        de: "Das Löschen einer **Saison** löscht auch **ihre eigenen Matches**, **verknüpfte Turniere** und **deren Matches**. Danach zählen diese Ergebnisse weder für globale noch für saisonbasierte Werte.",
      },
      {
        en: "There is one extra rule for *tournament matches*: if a **later bracket round already depends on that result**, you cannot delete the older match. In practice, **only the latest tournament match** can be deleted safely.",
        de: "Für *Turnier-Matches* gibt es eine Zusatzregel: Wenn eine **spätere Bracket-Runde bereits von diesem Ergebnis abhängt**, kannst du das ältere Match nicht löschen. Praktisch heißt das: **Nur das aktuell letzte Turnier-Match** lässt sich sicher löschen.",
      },
      {
        en: "There is **no separate remove-player permission**. For seasons and tournaments, the creator changes the participant list by **editing and saving** the season or tournament.",
        de: "Es gibt **keine separate Spieler-entfernen-Berechtigung**. Bei Saisons und Turnieren ändert der Ersteller die Teilnehmerliste durch **Bearbeiten und Speichern** der Saison oder des Turniers.",
      },
      {
        en: "The creator is **kept in the participant list** and cannot remove themselves from the editor. Tournament participant editing is also locked once the bracket has **started or finished**. Season editing stops once the season is **completed, deleted, or past its end date**.",
        de: "Der Ersteller bleibt **in der Teilnehmerliste** und kann sich im Editor nicht selbst entfernen. Die Teilnehmerbearbeitung eines Turniers wird außerdem gesperrt, sobald das Bracket **gestartet hat oder abgeschlossen ist**. Die Bearbeitung einer Saison endet, sobald sie **abgeschlossen, gelöscht oder nach ihrem Enddatum** ist.",
      },
    ],
  },
  {
    titleEn: "Player dropdowns",
    titleDe: "Spieler-Dropdowns",
    details: [
      {
        en: "The dropdowns do **not always start with every player**. By default, they first show the players that are **most relevant to your current context**.",
        de: "Die Dropdowns starten **nicht immer mit allen Spielern**. Standardmäßig zeigen sie zuerst die Spieler, die **für deinen aktuellen Kontext am relevantesten** sind.",
      },
      {
        en: "In **season** and **tournament** editors, the default suggestions come from players who already have some connection to you, such as **recent matches**, **shared seasons**, or **shared tournaments**.",
        de: "In den Editoren für **Saisons** und **Turniere** kommen die Standardschläge aus Spielern, die bereits eine Verbindung zu dir haben, zum Beispiel durch **letzte Matches**, **gemeinsame Saisons** oder **gemeinsame Turniere**.",
      },
      {
        en: "If you **type a search**, the editor can look wider than the default suggestions. For a **season**, that wider search can find **any existing player**. For a **tournament linked to a season**, the search is limited to **players already in that season**.",
        de: "Wenn du **suchst**, kann der Editor weiter gehen als die Standardschläge. Für eine **Saison** kann diese Suche **jeden existierenden Spieler** finden. Für ein **Turnier mit verknüpfter Saison** ist die Suche auf **Spieler aus genau dieser Saison** begrenzt.",
      },
      {
        en: "In the **match** form, the dropdown starts from the players already known in the current context, and then narrows to what is **allowed**. If you picked a **season**, the choices are limited to that season's participants.",
        de: "Im **Match-Formular** startet das Dropdown mit den Spielern, die im aktuellen Kontext bereits bekannt sind, und begrenzt dann auf das, was **erlaubt** ist. Wenn du eine **Saison** gewählt hast, sind die Auswahlmöglichkeiten auf die Teilnehmer dieser Saison begrenzt.",
      },
      {
        en: "If you picked a **tournament bracket match**, the choices are limited even more: you can only select the players from **that bracket pairing**, and the wider remote search is turned off there.",
        de: "Wenn du ein **Turnier-Bracket-Match** gewählt hast, ist die Auswahl noch enger: Du kannst nur die Spieler aus **genau dieser Paarung** wählen, und die breitere Suche ist dort ausgeschaltet.",
      },
      {
        en: "For **open play** or a normal **season match without a tournament bracket**, typing lets you search more players. So the short version is: **relevant players show by default, wider search appears when you type, and context rules still limit who can actually be picked**.",
        de: "Für **freies Spiel** oder ein normales **Saison-Match ohne Turnier-Bracket** kannst du durch Tippen nach mehr Spielern suchen. Die Kurzfassung ist also: **Relevante Spieler werden zuerst gezeigt, die breitere Suche kommt beim Tippen dazu, und Kontextregeln begrenzen trotzdem, wer am Ende wirklich gewählt werden kann**.",
      },
    ],
  },
  {
    titleEn: "Public vs private",
    titleDe: "Öffentlich vs. privat",
    details: [
      {
        en: "A **season** can be *public* or limited to its creator and participants. If a season is **public**, other users can open and view it even if they are not in that season.",
        de: "Eine **Saison** kann *öffentlich* sein oder auf ihren Ersteller und ihre Teilnehmer beschränkt bleiben. Wenn eine Saison **öffentlich** ist, können andere Nutzer sie auch dann öffnen und ansehen, wenn sie nicht Teil dieser Saison sind.",
      },
      {
        en: "If a season is **not public**, only the **creator** and its **participants** can access it.",
        de: "Wenn eine Saison **nicht öffentlich** ist, können nur der **Ersteller** und ihre **Teilnehmer** darauf zugreifen.",
      },
      {
        en: "A **tournament** is different: it is currently visible only to the **creator** and that tournament's **participants**. There is **no separate public tournament setting** right now.",
        de: "Ein **Turnier** ist anders: Es ist aktuell nur für den **Ersteller** und die **Teilnehmer dieses Turniers** sichtbar. Es gibt derzeit **keine eigene öffentliche Turnier-Einstellung**.",
      },
      {
        en: "That also affects **matches**. A normal season match in a **public season** can be visible more broadly, but a **tournament match** is still tied to tournament access rules.",
        de: "Das wirkt sich auch auf **Matches** aus. Ein normales Saison-Match in einer **öffentlichen Saison** kann breiter sichtbar sein, aber ein **Turnier-Match** folgt weiterhin den Zugriffsregeln des Turniers.",
      },
      {
        en: "So if a tournament is linked to a public season, that does **not automatically make the tournament public**. You still need to be the creator or a tournament participant to see it.",
        de: "Wenn ein Turnier also mit einer öffentlichen Saison verknüpft ist, macht das das Turnier **nicht automatisch öffentlich**. Du musst weiterhin der Ersteller oder ein Teilnehmer des Turniers sein, um es zu sehen.",
      },
      {
        en: "In short: **public/private mainly changes season visibility**. Tournaments are still controlled by **tournament participation**.",
        de: "Kurz gesagt: **Öffentlich/privat ändert vor allem die Sichtbarkeit von Saisons**. Turniere werden weiterhin über die **Turnierteilnahme** gesteuert.",
      },
    ],
  },
  {
    titleEn: "Helpful buttons",
    titleDe: "Hilfreiche Buttons",
    details: [
      {
        en: "**\"Suggest fair matchup\"** fills the match form with players who look **close in strength**. For doubles, it tries to build **two balanced teams** around you.",
        de: "**\"Faires Matchup vorschlagen\"** füllt das Match-Formular mit Spielern, die **von der Stärke her nah beieinander** liegen. Im Doppel versucht die Funktion, **zwei ausgeglichene Teams** rund um dich zu bilden.",
      },
      {
        en: "**\"Suggest tournament\"** builds a bracket from the selected players and spreads **stronger players apart** in the draw so they do not all start on the same side.",
        de: "**\"Turnier vorschlagen\"** erstellt ein Bracket aus den ausgewählten Spielern und verteilt **stärkere Spieler** im Turnier, damit sie nicht alle auf derselben Seite starten.",
      },
    ],
  },
  {
    titleEn: "Achievements",
    titleDe: "Erfolge",
    details: [
      {
        en: "**Achievements** are milestone badges for things like playing matches, reaching rating targets, or staying active.",
        de: "**Erfolge** sind Meilenstein-Badges für Dinge wie gespielte Matches, erreichte Rating-Ziele oder regelmäßige Aktivität.",
      },
      {
        en: "Each achievement gives you **points** so you can track progress and compare how much you have unlocked over time.",
        de: "Jeder Erfolg gibt dir **Punkte**, damit du deinen Fortschritt sehen und vergleichen kannst, wie viel du im Laufe der Zeit freigeschaltet hast.",
      },
      {
        en: "**Important:** achievement points **do not currently affect** your *global ranking*, *season score*, or *tournament placement*.",
        de: "**Wichtig:** Erfolgspunkte **beeinflussen aktuell nicht** deine *globale Rangliste*, den *Saison-Score* oder die *Turnierplatzierung*.",
      },
    ],
  },
];

export const faqEntriesEs: FaqEntryEs[] = [
  {
    title: "¿Qué afecta a qué?",
    details: [
      "SpinRank muestra tres vistas: clasificación global, clasificación de temporada y posición en torneo.",
      "Regla simple: todo partido rankeado afecta a tu clasificación global; solo los partidos dentro de una temporada afectan a esa temporada; el torneo lo decide el avance en el bracket.",
    ],
  },
  {
    title: "Clasificación global",
    details: [
      "La clasificación global mide tu nivel general a largo plazo con Elo e incluye todos los partidos rankeados activos.",
      "Los primeros resultados mueven más rápido el Elo global (0-9 más rápido, 10-29 más estable, 30+ más calmado).",
      "Necesitas al menos 10 partidos para aparecer por encima de jugadores no cualificados.",
    ],
  },
  {
    title: "Clasificación de temporada",
    details: [
      "La temporada solo cuenta partidos dentro de esa temporada (y torneos vinculados a ella).",
      "La puntuación de temporada usa Glicko-2 (con incertidumbre), no Elo simple.",
      "La puntuación visible es prudente: rating menos incertidumbre y menos penalización de asistencia si aplica.",
    ],
  },
  {
    title: "Posición en torneo",
    details: [
      "La posición del torneo la determina el bracket, no una puntuación separada.",
      "Los partidos de torneo siempre afectan al torneo y al ranking global; solo afectan a temporada si el torneo está vinculado a esa temporada.",
    ],
  },
  {
    title: "Tipos de partido",
    details: [
      "Puedes jugar individual o dobles, a un juego o mejor de 3, y a 11 o 21 puntos.",
      "Individual suele impactar más al rating; dobles cuenta con peso reducido.",
      "Open play cuenta para global, pero no para temporada o torneo salvo que se vincule.",
    ],
  },
  {
    title: "Opciones de inicio de temporada",
    details: [
      "Al crear temporada puedes arrastrar rating actual o reiniciar a 1200.",
      "Arrastrar mantiene diferencias previas; reiniciar empieza limpio para todos.",
      "La puntuación visible inicial puede variar según modo y contexto.",
    ],
  },
  {
    title: "Eliminar elementos",
    details: [
      "Solo el creador puede eliminar partidos, temporadas o torneos.",
      "Eliminar un partido quita su impacto en rankings y segmentos relacionados.",
      "Eliminar torneo o temporada también elimina sus partidos dependientes según las reglas del sistema.",
    ],
  },
  {
    title: "Listas desplegables de jugadores",
    details: [
      "Por defecto se priorizan jugadores relevantes por contexto.",
      "Al escribir en búsqueda se amplía el alcance, pero siempre respetando reglas de temporada/torneo.",
      "En bracket de torneo solo puedes seleccionar la pareja definida por ese cruce.",
    ],
  },
  {
    title: "Público vs privado",
    details: [
      "Las temporadas pueden ser públicas o privadas según configuración.",
      "Los torneos actualmente se controlan por participación del torneo, no por ajuste público separado.",
      "Un torneo vinculado a una temporada pública no se vuelve automáticamente público.",
    ],
  },
  {
    title: "Botones útiles",
    details: [
      "\"Sugerir matchup justo\" propone emparejamientos de nivel parecido.",
      "\"Sugerir torneo\" construye el bracket y reparte jugadores fuertes para equilibrar el cuadro.",
    ],
  },
  {
    title: "Logros",
    details: [
      "Los logros son hitos por actividad, objetivos y progreso.",
      "Dan puntos de progreso, pero actualmente no modifican ranking global, puntuación de temporada ni posición de torneo.",
    ],
  },
];
