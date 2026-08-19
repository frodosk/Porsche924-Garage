/* =========================================================
   Porsche 924 Garage — Firebase-Konfiguration (optional)
   =========================================================

   Standardmäßig läuft die App komplett lokal (Speicherung im
   Browser des jeweiligen Geräts). Wenn ihr die Fahrten, Tankungen
   und Wartungseinträge zwischen allen Geräten synchronisieren
   wollt, richtet ein kostenloses Firebase-Projekt ein (Spark-Plan,
   keine Kreditkarte nötig) und tragt eure Zugangsdaten unten ein.

   SO GEHT'S (dauert ca. 5 Minuten):

   1. Gehe zu https://console.firebase.google.com/
   2. "Projekt hinzufügen" → Namen vergeben (z. B. "porsche924-garage")
      → Google Analytics kann deaktiviert werden.
   3. Im Projekt links auf "Build" → "Firestore Database" →
      "Datenbank erstellen" → Modus "Testmodus" wählen (für den Start
      völlig ausreichend, kein Geld nötig).
   4. Links auf das Zahnrad → "Projekteinstellungen" → ganz unten bei
      "Meine Apps" auf das Web-Symbol "</>" klicken → App registrieren
      (Name z. B. "garage-app", Firebase Hosting NICHT nötig).
   5. Firebase zeigt dir ein Code-Snippet mit einem Objekt wie unten.
      Kopiere genau diese Werte hierher.
   6. Speichern, Datei committen, GitHub Pages aktualisiert sich
      automatisch. Alle vier Fahrer sehen ab sofort dieselben Daten.

   Wichtig: Die Firestore-Regeln im "Testmodus" sind 30 Tage lang
   offen und laufen danach ab. Setzt danach in der Firebase-Konsole
   unter Firestore → "Regeln" z. B. folgende einfache Regel (jeder mit
   dem Link darf lesen/schreiben – für eine private Gruppen-App okay):

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }

   ========================================================= */

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDYD_GmD8izNMKssw8wxm9X6ZtERmsvOKc",
  authDomain: "porsche924-garage.firebaseapp.com",
  projectId: "porsche924-garage",
  storageBucket: "porsche924-garage.firebasestorage.app",
  messagingSenderId: "781942671516",
  appId: "1:781942671516:web:84c309b3ab22547846c559"
};

/* Optional: eindeutige Kennung, falls mehrere Fahrzeuge/Gruppen
   dieselbe Firebase-Datenbank nutzen sollen. Für ein einzelnes Auto
   kann der Standardwert bleiben. */
window.FIREBASE_GARAGE_ID = 'porsche924-default';
