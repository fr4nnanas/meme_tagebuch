# Vacation Meme Feed

Eine private, mobile-first Web-App für Urlaubsgruppen. Fotos werden per KI in Memes verwandelt, in einem gemeinsamen Feed geteilt und auf einer interaktiven Karte visualisiert.

## Kurzübersicht

- **Private Gruppen** (Projekte): Jeder Urlaub ist ein isolierter Feed
- **KI-Meme-Generierung**: Zwei Pipelines (direkt oder assistiert), zwei Meme-Typen
- **Social Features**: Likes, Kommentare, Nutzerprofile
- **Interaktive Karte**: Memes auf OpenStreetMap via GPS-Daten aus EXIF
- **Export**: Ganzer Urlaub als ZIP (Bilder + offline HTML-Galerie)

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Datenbank | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Deployment | Vercel |
| KI Text/Vision | OpenAI `gpt-4o` |
| KI Bildgenerierung | OpenAI `gpt-image-2` |
| Karte | react-leaflet + OpenStreetMap |
| EXIF-Auslesen | exif-js |
| Bild-Cropping | react-image-crop |
| ZIP-Export | jszip + file-saver |
| Canvas-Overlay | HTML5 Canvas API |

## Schnellstart (nach Setup)

```bash
npm install
cp .env.local.example .env.local
# .env.local befüllen (siehe PLANNING.md)
npm run dev
```

## Projektstruktur (geplant)

```
/app
  /api          → Next.js Server Routes (KI-Aufrufe, Export)
  /(auth)       → Login, Register
  /(app)        → Geschützte Seiten
    /feed        → Projekt-Feed
    /upload      → Meme-Upload-Flow
    /profile     → Nutzerprofil
    /map         → Interaktive Karte
    /admin       → Masteraccount-Panel
/components     → Wiederverwendbare UI-Komponenten
/lib            → Supabase-Client, Hilfsfunktionen
/docs           → Technische Dokumentation
```

## Dokumentation

- [`PLANNING.md`](./PLANNING.md) – Alle Architektur-Entscheidungen
- [`docs/schema.sql`](./docs/schema.sql) – Datenbank-Schema (für Supabase SQL-Editor)
- [`docs/CURSOR_BRIEFING.md`](./docs/CURSOR_BRIEFING.md) – Cursor AI Aufgabenpakete

## Umgebungsvariablen

Siehe `.env.local.example` – alle Werte müssen vor dem ersten Start gesetzt werden.
