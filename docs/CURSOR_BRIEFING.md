# Cursor AI Briefing – Aufgabenpakete

**Wichtig:** Lies vor jedem Paket die Dateien `PLANNING.md` und `docs/schema.sql` als Kontext.
Jedes Paket muss vollständig getestet sein, bevor das nächste beginnt.

---

## Paket 1 – Projekt-Setup, Supabase & Authentifizierung

**Ziel:** Die Grundstruktur steht. Nutzer können sich registrieren und einloggen.

**Aufgaben:**

1. Erstelle ein neues **Next.js 15** Projekt mit **TypeScript** und **Tailwind CSS** (App Router).
2. Installiere und konfiguriere den **Supabase JS Client** (`@supabase/supabase-js`, `@supabase/ssr`).
3. Erstelle eine `.env.local.example` Datei mit diesen Variablen (ohne echte Werte):
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   OPENAI_API_KEY=
   ```
4. Erstelle einen **Supabase Server Client** und **Supabase Browser Client** in `/lib/supabase/`.
5. Erstelle eine **Login-Page** (`/app/(auth)/login/page.tsx`): E-Mail + Passwort, Link zur Registrierung.
6. Erstelle eine **Registrierungs-Page** (`/app/(auth)/register/page.tsx`):
   - Nur aufrufbar mit gültigem Einladungstoken (`?token=...` in der URL)
   - Token wird gegen die `invitation_tokens`-Tabelle in Supabase geprüft (Server-seitig)
   - Felder: Username, E-Mail, Passwort
   - Nach Registrierung: Redirect zum Feed
7. Implementiere **Supabase Auth** mit E-Mail/Passwort (kein Magic Link).
8. Schütze alle Seiten unter `/app/(app)/` mit einem **Middleware-Check** (`middleware.ts`): Nicht eingeloggte User werden zu `/login` redirected.
9. Erstelle eine **Server Action** zum Logout.

**Tech-Details:**
- Alle OpenAI-Aufrufe kommen NICHT in dieses Paket – nur Auth
- Username wird beim Registrieren in `raw_user_meta_data` übergeben (der DB-Trigger in `schema.sql` erstellt dann den `users`-Eintrag)

---

## Paket 2 – Datenbank-Schema & Storage Buckets

**Ziel:** Schema ist in Supabase eingespielt, Storage ist konfiguriert, RLS ist aktiv.

**Aufgaben:**

1. Führe den kompletten SQL-Code aus `docs/schema.sql` im **Supabase SQL-Editor** aus.
2. Verifiziere, dass alle Tabellen korrekt angelegt wurden.
3. Erstelle im Supabase Dashboard die **3 Storage Buckets**:
   - `avatars` – **öffentlich**
   - `originals` – **privat**
   - `memes` – **privat**
4. Schreibe **Storage Policies** (im Supabase Dashboard oder via SQL):
   - `avatars`: Jeder kann lesen, nur eingeloggte User können eigene Dateien schreiben
   - `originals`: Nur Projektmitglieder können lesen/schreiben (via RLS-äquivalente Storage-Regel)
   - `memes`: Nur Projektmitglieder können lesen/schreiben
5. Erstelle TypeScript-Typen für alle Tabellen in `/lib/database.types.ts` (kann mit Supabase CLI generiert werden: `npx supabase gen types typescript`).

**Hinweis:** Es ist nicht nötig, Testdaten einzupflegen – das passiert im UI.

---

## Paket 3 – UI-Grundgerüst, Navigation & Profil-Page

**Ziel:** Die App sieht aus wie Instagram und man kann navigieren.

**Aufgaben:**

1. Erstelle eine **Bottom Navigation Bar** (mobile-first, wie Instagram) mit 5 Tabs:
   - Feed (Haus-Icon)
   - Karte (Map-Pin-Icon)
   - Upload (Kamera-Icon, mittig, größer)
   - Profil (Person-Icon)
   - Admin (Zahnrad-Icon – nur sichtbar wenn `role = 'admin'`)
2. Erstelle das **Layout** für den geschützten Bereich (`/app/(app)/layout.tsx`) mit der Bottom-Nav.
3. Erstelle die **Profil-Page** (`/app/(app)/profile/[userId]/page.tsx`):
   - Profilbild (klickbar zum Hochladen, Upload in `avatars` Bucket)
   - Username + Bio (editierbar per Modal/Inline-Edit)
   - Grid-View aller eigenen Posts (Memes), gefiltert nach aktivem Projekt
   - Dropdown-Selector: aktives Projekt wechseln
4. Erstelle einen **Projekt-Selektor** als globaler State (via React Context oder Zustand): Das aktuell ausgewählte Projekt ist app-weit verfügbar.
5. Erstelle eine **leere Feed-Hülle** (`/app/(app)/feed/page.tsx`) mit Placeholder-Karten.
6. Erstelle eine **leere Karten-Hülle** (`/app/(app)/map/page.tsx`).

**Design-Vorgaben:**
- Dark Mode als Standard (dunkler Hintergrund, helle Schrift)
- Farb-Akzent: leuchtendes Orange oder Lila (eine Farbe, konsistent)
- Rounded Corners, großzügige Abstände, keine eckigen Designs
- Alle Icons von `lucide-react`

---

## Paket 4 – Der Upload-Flow & die Meme-Engine (Herzstück)

**Ziel:** Fotos hochladen, KI generiert Memes, asynchrone Verarbeitung mit Ladescreen.

**Dieses Paket in folgende Schritte unterteilen:**

### Schritt 4a – Upload-UI & EXIF
1. Upload-Page (`/app/(app)/upload/page.tsx`):
   - Foto-Auswahl (Kamera oder Galerie)
   - **Zwingender 3:4-Crop** via `react-image-crop` – erst nach Crop geht es weiter
   - EXIF-GPS-Extraktion via `exif-js` vor dem Crop (aus dem Original-File)
   - Toggle: **Pipeline A** (Direkt) vs **Pipeline B** (Assistiert)
   - Toggle: **Meme-Typ A** (KI-Vollbild, limitiert) vs **Meme-Typ B** (Canvas-Overlay, unlimitiert)
   - Kontingent-Anzeige: "Heute noch X von 5 KI-Generierungen verfügbar" (nur für Typ A)

### Schritt 4b – Server Routes für KI
2. Erstelle `/app/api/meme/generate-ai/route.ts`:
   - Prüft zuerst das Tageslimit (`daily_usage` Tabelle + `settings.daily_ai_image_limit`)
   - Nimmt entgegen: Bild (base64), Pipeline-Typ, optionaler User-Text
   - Ruft `gpt-image-2` auf (OpenAI API)
   - Gibt 2 Bildvarianten zurück
3. Erstelle `/app/api/meme/generate-canvas-text/route.ts`:
   - Nimmt entgegen: Bild (base64)
   - Ruft `gpt-4o` mit Vision auf
   - Gibt zurück: `{ top: string | null, bottom: string }` (Meme-Texte + Platzierung)
   - Kein Limit – immer verfügbar
4. Erstelle `/app/api/meme/generate-captions/route.ts` (für Pipeline B):
   - `gpt-4o` analysiert Bild → gibt 4 Meme-Ideen als Array zurück

### Schritt 4c – Asynchrone Job-Verarbeitung
5. Beim Absenden des Uploads:
   - Original-Foto in `originals` Bucket hochladen
   - `posts`-Eintrag mit `meme_image_url = null` erstellen
   - `jobs`-Eintrag mit `status = 'pending'` erstellen
   - KI-Aufruf in einer **Next.js Server Action** oder **Route Handler** starten
   - Globaler Ladebalken im UI (oben, wie bei GitHub) zeigt Fortschritt
   - User kann wegnavigieren; App pollt Job-Status alle 3 Sekunden
   - Bei `completed`: Toast-Notification "Dein Meme ist fertig!"

### Schritt 4d – Varianten-Auswahl & Post
6. Nach KI-Fertigstellung: Modal mit 2 generierten Varianten
   - User wählt eine Variante → wird als `meme_image_url` in `posts` gespeichert, in `memes` Bucket hochgeladen
   - Nicht gewählte Variante: Download-Button (lokaler Download via `<a download>`)
   - Optional: Caption eingeben oder per KI generieren (Button → `gpt-4o` analysiert fertiges Meme)

**Wichtige Hinweise:**
- `gpt-image-2` Aufrufe NIEMALS im Frontend/Client – immer über Server Route
- Fehlerbehandlung: Wenn KI-Aufruf scheitert → `jobs.status = 'failed'`, User bekommt Fehlermeldung
- Tagesverbrauch bei Typ A IMMER in `daily_usage` erhöhen, BEVOR der KI-Aufruf startet

---

## Paket 5 – Social Features & Feed

**Ziel:** Der Feed lebt. User können interagieren.

**Aufgaben:**

1. **Main-Feed** (`/app/(app)/feed/page.tsx`):
   - Lädt alle Posts des aktiven Projekts, chronologisch (neueste zuerst)
   - Infinite Scroll (oder "Mehr laden"-Button) mit Pagination
   - Jede Post-Karte zeigt: Meme-Bild (3:4), Username + Avatar, Caption, Like-Counter, Kommentar-Button
2. **Like-Funktion** (Post-Likes):
   - Herz-Button an jeder Post-Karte
   - Optimistisches Update (UI reagiert sofort, DB-Schreibung im Hintergrund)
   - Counter zeigt Anzahl der Likes
3. **Kommentar-Sektion**:
   - Klick auf Kommentar-Icon öffnet Kommentar-Sheet (von unten)
   - Kommentare chronologisch laden
   - Kommentar schreiben (Text-Input + Absenden)
   - Likes auf Kommentare (kleines Herz neben Kommentar)
   - Eigene Kommentare können gelöscht werden (Swipe oder Long-Press)
4. **Caption-KI** (nachträgliches Generieren):
   - Button unter der Caption "KI-Caption generieren"
   - Ruft `/app/api/meme/generate-captions` auf (mit fertigem Meme-Bild)
   - Gibt einen Vorschlag-Text zurück, der editierbar ist
   - User bestätigt → wird in `posts.caption` gespeichert
5. **Post löschen**:
   - Drei-Punkte-Menü an eigenen Posts
   - Löscht Post, Bild aus Storage, alle Kommentare/Likes (CASCADE in DB)

---

## Paket 6 – Admin-Panel & Limits

**Ziel:** Masteraccount hat volle Kontrolle.

**Aufgaben:**

1. **Admin-Panel** (`/app/(app)/admin/page.tsx`, nur sichtbar für `role = 'admin'`):
   - Middleware prüft Admin-Rolle, Nicht-Admins → 403-Seite
2. **Projekte verwalten**:
   - Liste aller Projekte
   - Neues Projekt anlegen (Name, Beschreibung)
   - User einem Projekt zuweisen / entfernen (Dropdown mit allen Users)
3. **Einladungslinks**:
   - Liste aller aktiven Tokens
   - Neuen Token generieren (Button → erzeugt Token in DB)
   - Kopierbarer Link: `https://[deine-domain]/register?token=[token]`
   - Token löschen
4. **User-Verwaltung**:
   - Liste aller User (Username, Rolle, Registrierungsdatum)
   - Admin-Rolle vergeben/entziehen
5. **KI-Limit anpassen**:
   - Input-Feld für `settings.daily_ai_image_limit`
   - Speichern → aktualisiert `settings`-Tabelle
   - Aktueller Wert wird angezeigt

---

## Paket 7 – Interaktive Karte

**Ziel:** Memes auf einer Karte sehen.

**Aufgaben:**

1. Installiere `react-leaflet` und `leaflet` (+ Typen `@types/leaflet`).
2. **Karten-Page** (`/app/(app)/map/page.tsx`):
   - OpenStreetMap als Basis (kostenlos, kein API-Key nötig)
   - Lädt alle Posts des aktiven Projekts, die `lat` und `lng` haben
   - Zeigt Marker an GPS-Koordinaten
   - Bei nahen Markern: Cluster-Ansicht (via `react-leaflet-cluster`)
   - Klick auf Marker: Popup mit Meme-Thumbnail + Username + Datum
3. **Filter-Dropdown**:
   - "Alle User" (Standard)
   - Einzelne User auswählen (zeigt nur deren Posts auf der Karte)
4. **Wichtig für Next.js:** `react-leaflet` erfordert `dynamic import` mit `ssr: false`, da Leaflet `window` nutzt. Immer so einbinden:
   ```typescript
   const Map = dynamic(() => import('@/components/Map'), { ssr: false });
   ```

---

## Paket 8 – ZIP-Expor

**Ziel:** Ganzen Urlaub als offline-fähiges ZIP exportieren.

**Aufgaben:**

1. Installiere `jszip` und `file-saver`.
2. **Export-Button** im Admin-Panel (und optional im Feed als "Projekt exportieren"):
3. **Export-Logik** (Client-seitig, in einer Funktion):
   - Lade alle Posts des Projekts (inkl. User, Captions, Kommentare, Like-Counts) als JSON
   - Lade alle Meme-Bilder aus dem `memes` Supabase-Bucket (als Blob)
   - Generiere eine `index.html` als offline Galerie:
     - Dunkles Design, Grid-Layout
     - Jedes Meme als Bild + Caption + Kommentare + Like-Count
     - Bilder referenzieren lokale Pfade (`./images/[post_id].jpg`)
   - Erstelle `data.json` mit den Roh-Daten
   - Packe alles in ein ZIP:
     ```
     /export_[projektname]_[datum].zip
       index.html
       data.json
       /images
         [post_id].jpg
         ...
     ```
   - Download via `file-saver`
4. **Ladebalken** während des Exports (kann bei vielen Bildern dauern).

**Template für die `index.html`** (innerhalb der Export-Funktion als Template-String generieren):
- Standalone HTML (kein Framework, keine externe CSS-Abhängigkeit)
- Inline-CSS mit dunklem Design
- Bilder referenzieren `./images/[post_id].jpg`

---

## Allgemeine Cursor-Regeln (für alle Pakete)

```
- Immer TypeScript, niemals 'any'
- Alle OpenAI-Aufrufe ausschließlich in /app/api/ Server Routes
- Supabase-Abfragen im Server-Kontext bevorzugen (Server Components / Server Actions)
- Mobile First: Alle Designs zuerst für 390px, dann für Desktop
- Dark Mode als Standard
- Icons ausschließlich aus 'lucide-react'
- Fehler immer dem User anzeigen (Toast-Notifications via 'sonner' oder ähnlich)
- Ladezeiten immer mit Skeleton-Screens oder Spinners überbrücken
- Kein direkter Zugriff auf 'process.env' im Client-Code
```
