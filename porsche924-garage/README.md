# 🏎️ Porsche 924 Garage

Ein kostenloses digitales Bordbuch als Web-App (PWA) für unseren gemeinsam genutzten Porsche 924 — für Silas, Jason, Elias & Samuel.

Verwaltet Kilometerstände, Fahrten, Tankkosten (fair aufgeteilt nach gefahrenen Kilometern) und Wartungsarbeiten. Läuft direkt im Browser, kann "Zum Home-Bildschirm" hinzugefügt werden wie eine echte App, und funktioniert komplett kostenlos auf GitHub Pages.

## Inhalt

- [Features](#features)
- [1. App auf GitHub Pages veröffentlichen](#1-app-auf-github-pages-veröffentlichen)
- [2. App auf dem Handy installieren](#2-app-auf-dem-handy-installieren)
- [3. Geräteübergreifende Synchronisierung (Firebase)](#3-geräteübergreifende-synchronisierung-firebase)
- [4. Bedienung](#4-bedienung)
- [Lokaler Modus vs. Cloud-Sync](#lokaler-modus-vs-cloud-sync)
- [Backup & Export](#backup--export)
- [Projektstruktur](#projektstruktur)
- [Troubleshooting](#troubleshooting)

## Features

- **Dashboard** — aktueller Kilometerstand, Jahreslimit (4.000 km) mit Fortschrittsbalken, Fahrer-Ranking
- **Fahrtenbuch** — Fahrer, Datum, Start-/Endkilometerstand, automatische km-Berechnung, Filter pro Fahrer
- **Tankbuch** — Liter, Betrag, automatischer Preis/Liter, optionale Tankstelle & Beleg-Foto
- **Kostenaufteilung** — faire Verteilung der Tankkosten nach gefahrenen Kilometern pro Fahrer (Guthaben/Schulden)
- **Statistik** — Balkendiagramme für Kilometer & Kosten pro Fahrer, Jahresübersicht
- **Wartung** — Ölwechsel, TÜV/HU, Reifenwechsel, Reparaturen mit Kosten & Notizen
- **Fahrer-Verwaltung** — Fahrer hinzufügen/entfernen, "Sonstige/r Fahrer:in" als Freitext-Option
- **Fahrzeugdaten** — Foto, Baujahr, Motor, PS, Fahrgestellnummer
- **CSV- & PDF-Export** — alle Daten als Excel-kompatible CSV oder zum Ausdrucken
- **Backup** — komplette Daten als JSON exportieren/importieren
- **PWA** — installierbar auf dem Homescreen, funktioniert offline (Grundfunktionen)
- **Cloud-Synchronisierung** — optional über ein kostenloses Firebase-Projekt, damit alle vier Fahrer dieselben Daten sehen

## 1. App auf GitHub Pages veröffentlichen

1. Erstellt ein neues (kostenloses) GitHub-Repository, z. B. `porsche924-garage`.
2. Ladet den kompletten Inhalt dieses Ordners in das Repository hoch (per Weboberfläche "Add file → Upload files" oder per `git push`).
3. Geht im Repository auf **Settings → Pages**.
4. Bei **"Build and deployment"** wählt als Source **"Deploy from a branch"**, als Branch `main` und als Ordner `/ (root)`. Speichern.
5. Nach ca. 1–2 Minuten ist die App erreichbar unter:
   `https://<euer-github-name>.github.io/porsche924-garage/`
6. Diesen Link könnt ihr an alle vier Fahrer schicken.

Kein Build-Prozess nötig — die App besteht nur aus HTML, CSS und JavaScript und läuft direkt so, wie sie ist.

## 2. App auf dem Handy installieren

**iPhone (Safari):**
Link öffnen → Teilen-Symbol → "Zum Home-Bildschirm" → Hinzufügen.

**Android (Chrome):**
Link öffnen → Menü (⋮) → "App installieren" bzw. "Zum Startbildschirm hinzufügen".

Die App erscheint danach mit eigenem Icon wie eine normale App und öffnet sich im Vollbildmodus ohne Browserleiste.

## 3. Geräteübergreifende Synchronisierung (Firebase)

Standardmäßig speichert die App alle Daten **nur lokal** im Browser des jeweiligen Geräts — jeder Fahrer sieht zunächst nur seine eigenen Eingaben auf seinem eigenen Handy. Damit **alle vier Fahrer dieselben Fahrten, Tankungen und Wartungen** sehen, richtet ihr einmalig ein kostenloses Firebase-Projekt ein (Google, Spark-Plan, **keine Kreditkarte nötig**):

1. Geht zu [console.firebase.google.com](https://console.firebase.google.com/) und meldet euch mit einem Google-Konto an.
2. **"Projekt hinzufügen"** → Namen vergeben (z. B. `porsche924-garage`) → Google Analytics könnt ihr deaktivieren.
3. Im Projekt links auf **"Build" → "Firestore Database"** → **"Datenbank erstellen"** → Modus **"Testmodus"** wählen (für den Start völlig ausreichend).
4. Links auf das Zahnrad-Symbol → **"Projekteinstellungen"** → ganz unten bei "Meine Apps" auf das Web-Symbol `</>` klicken → App registrieren (Name z. B. `garage-app`, Firebase Hosting **nicht** nötig).
5. Firebase zeigt euch ein Code-Snippet mit einem `firebaseConfig`-Objekt. Öffnet die Datei `js/firebase-config.js` in diesem Projekt und tragt die Werte dort ein:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIzaSy...",
     authDomain: "porsche924-garage.firebaseapp.com",
     projectId: "porsche924-garage",
     storageBucket: "porsche924-garage.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890"
   };
   ```

6. Datei speichern, ins Repository hochladen/committen — GitHub Pages aktualisiert sich automatisch. Ab sofort sehen alle vier Fahrer dieselben Daten in Echtzeit (Statusanzeige oben rechts in der App wechselt von "Lokal" zu "Online").

**Wichtig:** Die Firestore-Regeln im "Testmodus" laufen nach 30 Tagen ab. Öffnet danach in der Firebase-Konsole **Firestore Database → Regeln** und setzt z. B. folgende einfache Regel (jeder mit dem Link darf lesen/schreiben — für eine private Gruppen-App okay):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Fotos (Tankbelege, Fahrzeugfotos) werden bewusst **nicht** synchronisiert, sondern bleiben lokal auf dem jeweiligen Gerät — das hält die kostenlose Firebase-Nutzung dauerhaft im Gratis-Kontingent.

## 4. Bedienung

- **Neue Fahrt**: Dashboard oder Fahrtenbuch → "+ Fahrt" → Fahrer wählen, Datum, Start-/Endkilometerstand eingeben. Die gefahrenen Kilometer werden automatisch berechnet.
- **Tanken**: Tab "Tanken" → "+ Tankung" → Liter und Betrag eingeben (Preis/Liter wird automatisch berechnet), optional Tankstelle und Beleg-Foto.
- **Kostenaufteilung**: Im Tankbuch seht ihr unter "Faire Kostenverteilung", wer wie viel bezahlt hat im Vergleich zu seinem Kilometeranteil — mit Guthaben oder Nachzahlung.
- **Wartung**: Unter "Mehr → Wartung" könnt ihr Ölwechsel, TÜV/HU, Reifenwechsel, Reparaturen und Ersatzteile mit Kosten und Notizen erfassen.
- **Fahrer verwalten**: "Mehr → Fahrer-Verwaltung" — Fahrer hinzufügen oder entfernen.
- **Einstellungen**: "Mehr → Einstellungen" — Jahreslimit, Start-Kilometerstand, Erinnerungen für Ölwechsel/TÜV.
- **Export**: In der Statistik-Ansicht könnt ihr alle Daten als CSV (Excel-kompatibel) exportieren oder als PDF ausdrucken.

## Lokaler Modus vs. Cloud-Sync

| | **Lokal (Standard)** | **Cloud-Sync (Firebase)** |
|---|---|---|
| Kosten | 0 € | 0 € (Spark-Plan) |
| Setup | keins nötig | ca. 5 Minuten einmalig |
| Daten sichtbar für | nur das eigene Gerät | alle vier Fahrer, in Echtzeit |
| Fotos | lokal gespeichert | bleiben lokal (nicht synchronisiert) |
| Internetverbindung | nicht nötig | nötig zum Synchronisieren |

Die App funktioniert in beiden Modi identisch — Cloud-Sync lässt sich jederzeit nachträglich aktivieren, ohne dass bestehende lokale Daten verloren gehen (Backup vorher empfohlen, siehe unten).

## Backup & Export

Unter **Mehr → Einstellungen → Datensicherung** könnt ihr jederzeit:

- **Backup exportieren** — alle Daten als JSON-Datei herunterladen (z. B. bevor ihr Firebase aktiviert, oder als Sicherheitskopie)
- **Backup importieren** — eine zuvor exportierte JSON-Datei wieder einspielen

## Projektstruktur

```
porsche924-garage/
├── index.html              App-Shell mit allen Ansichten
├── manifest.json            PWA-Manifest (Name, Icons, Farben)
├── service-worker.js        Offline-Caching des App-Shells
├── css/
│   └── style.css             Design: dunkles Cockpit-Theme
├── js/
│   ├── data.js                Datenmodell & lokale Speicherung
│   ├── firebase-config.js     Firebase-Zugangsdaten (s. Abschnitt 3)
│   ├── sync.js                 Cloud-Synchronisierung
│   └── app.js                  UI-Logik aller Ansichten
└── icons/                    App-Icons (verschiedene Größen)
```

## Troubleshooting

- **App zeigt keine Daten von anderen Fahrern**: Firebase noch nicht konfiguriert, siehe Abschnitt 3. Prüft die Statusanzeige oben rechts in der App ("Lokal" vs. "Online").
- **Änderungen erscheinen nicht auf GitHub Pages**: GitHub Pages braucht nach jedem Update 1–2 Minuten zum Neuladen. Browser-Cache mit Strg+F5 (bzw. Cmd+Shift+R) leeren.
- **Icon fehlt nach Installation**: Sicherstellen, dass der `icons/`-Ordner mit hochgeladen wurde.
- **Firestore-Fehler nach 30 Tagen**: Testmodus-Regeln sind abgelaufen, siehe die Regel in Abschnitt 3 zum manuellen Setzen.

---

Viel Spaß mit dem 924! 🏁
