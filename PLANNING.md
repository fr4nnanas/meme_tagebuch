# PLANNING.md – Architektur & Entscheidungen

Dieses Dokument ist die Wahrheitsquelle für alle Architektur-Entscheidungen.
Cursor AI soll dieses Dokument als Kontext bei jedem Paket lesen.

---

## 1. Finale Architektur-Entscheidungen

| Frage | Entscheidung |
|---|---|
| Max. Projekte | ~99 (kein Hard-Limit, Pagination im UI) |
| User in mehreren Projekten | Ja, ein User kann Mitglied in mehreren Projekten sein |
| KI Text/Vision | `gpt-4o` |
| KI Bildgenerierung | `gpt-image-2` |
| Einladungslinks | Kein Ablaufdatum, mehrfach nutzbar |
| Tägliches KI-Bild-Limit | 5 Generierungen pro User pro Tag (Admin kann anpassen) |
| Standard-Meme-Typ | Typ A (KI-Vollbild) ist Standard; Typ B (Canvas) ist immer zusätzlich wählbar |

---

## 2. Die zwei Meme-Typen

### Typ A – KI-Vollbild (`meme_type = 'ai_generated'`)
- Das hochgeladene Foto wird an `gpt-image-2` übergeben
- Die KI generiert ein komplett neues Meme-Bild
- **Limitiert**: 5 Generierungen pro User pro Tag
- Zwei Varianten werden generiert; User wählt eine

### Typ B – Canvas-Overlay (`meme_type = 'canvas_overlay'`)
- `gpt-4o` analysiert das Foto und generiert einen lustigen Text
- Die KI gibt vor, wo Text erscheint: oben (`overlay_text_top`) und/oder unten (`overlay_text_bottom`)
- Die App klebt den Text via HTML5 Canvas auf das Originalbild
- **Unlimitiert** – spart API-Tokens, kein Bildgenerierungs-Kontingent
- Immer als Option sichtbar, auch wenn Typ-A-Limit nicht erreicht

---

## 3. Die zwei KI-Pipelines (für beide Meme-Typen nutzbar)

### Pipeline A – Direkt
1. User lädt Foto hoch (zwingend auf 3:4 gecroppt)
2. User gibt optional Text-Idee / Skript ein
3. Direkte Übergabe an KI (je nach Meme-Typ)
4. 2 Varianten werden generiert

### Pipeline B – Assistiert
1. User lädt Foto hoch
2. `gpt-4o` analysiert das Bild → generiert 4 Meme-Ideen als Text
3. User wählt eine Idee (mit "Neu generieren"-Button)
4. Foto + gewählte Idee gehen an KI (je nach Meme-Typ)
5. 2 Varianten werden generiert

---

## 4. Rollen & Zugang

| Rolle | Rechte |
|---|---|
| `admin` | Masteraccount: Projekte anlegen, User zuweisen, Limits ändern, Einladungslinks generieren, alles löschen |
| `member` | Eigene Bilder hochladen/löschen, kommentieren, liken, eigenes Profil bearbeiten |

- Registrierung nur über Einladungslink (Token in DB, kein Ablauf, mehrfach nutzbar)
- Der erste User in der DB erhält automatisch die Rolle `admin`

---

## 5. Asynchrone Job-Verarbeitung

Da KI-Aufrufe 10–30 Sekunden dauern können:
- Beim Absenden des Uploads wird ein Eintrag in der `jobs`-Tabelle erstellt (Status: `pending`)
- Der User sieht einen globalen Ladebalken / Spinner
- Der User kann wegnavigieren; die App pollt den Job-Status im Hintergrund
- Wenn der Job fertig ist (`completed`), erscheint eine Notification
- Status-Werte: `pending` | `processing` | `completed` | `failed`

---

## 6. Bild-Upload-Regeln

- Alle Bilder werden **zwingend auf 3:4 gecroppt** (via `react-image-crop`) vor dem Upload
- EXIF-GPS-Daten werden **vor dem Upload** via `exif-js` aus dem Original extrahiert und als `lat` / `lng` in der DB gespeichert
- Das Originalfoto und das generierte Meme werden **getrennt** in Supabase Storage gespeichert
- Storage-Buckets: `avatars` (public), `originals` (private), `memes` (private)

---

## 7. Supabase Storage Buckets

| Bucket | Zugang | Inhalt |
|---|---|---|
| `avatars` | Öffentlich | Profilbilder |
| `originals` | Privat (nur Projektmitglieder) | Original-Urlaubsfotos (3:4) |
| `memes` | Privat (nur Projektmitglieder) | Fertige Memes (Typ A + Typ B) |

Pfadstruktur: `/{project_id}/{user_id}/{post_id}.jpg`

---

## 8. Umgebungsvariablen

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

---

## 9. Row Level Security (RLS) – Kernregeln

1. Ein User sieht nur Daten (Posts, Kommentare, etc.) aus Projekten, in denen er `project_members`-Eintrag hat
2. Ein User kann nur seine **eigenen** Posts und Kommentare löschen
3. Der `admin` hat uneingeschränkten Zugriff auf alle Tabellen
4. `invitation_tokens` sind nur für `admin` lesbar/schreibbar
5. `settings` sind nur für `admin` schreibbar, für alle lesbar

---

## 10. Export-Konzept

- User (oder Admin) klickt "Projekt exportieren"
- Frontend sammelt via Supabase alle Posts + Kommentare + Likes des Projekts als JSON
- Alle Meme-Bilder werden aus Supabase Storage geladen
- Eine statische `index.html` (offline Galerie im Feed-Design) wird generiert
- Alles wird via `jszip` + `file-saver` als `.zip` heruntergeladen
- ZIP-Struktur:
  ```
  /export_[projektname]_[datum].zip
    index.html
    /images
      [post_id].jpg
    data.json
  ```

---

## 11. Karten-Feature

- Library: `react-leaflet` mit OpenStreetMap (kostenlos, open-source)
- Eigener Tab im geschützten Bereich
- Zeigt alle Posts des aktiven Projekts mit GPS-Koordinaten als Pins
- Pins zeigen Meme-Thumbnail (bei nahen Pins: Cluster-Ansicht)
- Dropdown-Filter: nach User, nach Zeitraum

---

## 12. Cursor AI – Wichtige Hinweise für alle Pakete

- **Immer TypeScript** verwenden, niemals `any` typisieren
- **Kein direkter DB-Zugriff** im Frontend – immer über Supabase Client oder Server Routes
- **OpenAI-Aufrufe immer** über Next.js Server Routes (`/app/api/...`), niemals im Client
- **RLS ist primäre Sicherheitsschicht** – Frontend-Guards sind nur UI, keine Sicherheit
- **Mobile First**: alle Komponenten zuerst für 390px Breite designen
- **Bottom Navigation Bar** als primäre Navigation (wie Instagram)
