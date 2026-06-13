# Transparent Lyrics

Transparent Lyrics is a local Windows desktop music player built with Electron, React, TypeScript, and Vite.

The app is designed for personal local use: import local songs, play music, manage a lightweight library, match lyrics, upload backgrounds, and prepare for immersive draggable lyric styling. It does not require a server deployment.

## Development

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Project Structure

- `src/`: React renderer UI and player logic
- `electron/`: Electron main process and preload APIs for local files, tags, and lyric lookup
- `public/stitch/`: Stitch-generated visual reference pages used by the current UI

## Notes

- Local music files, test audio, build output, logs, and private AI Team records are intentionally ignored.
- This is a local desktop app; no backend server is required.
