# Sonus — Ultimate Discord Audio Ecosystem

Lightweight scaffold for Sonus: a Discord audio infrastructure bot. This repo provides a TypeScript skeleton, command loader, audio manager stub, and registration script for slash commands.

## Quick start

1. Copy `.env.example` to `.env` and fill `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` for development.

2. Install dependencies:

n# Sonus — Ultimate Discord Audio Ecosystem

Sonus is a TypeScript Discord bot focused on high-quality audio playback, per-server radios, and user playlists. It uses `discord.js` and `@discordjs/voice`, with an FFmpeg-backed audio pipeline for EQ, loudness normalization, and smooth crossfades.

Features

- YouTube playback via `ytdl-core` and FFmpeg processing
- Per-guild EQ presets and inline volume control
- Two-player crossfade and gapless transitions
- Per-user playlists and persistent radios
- Slash (`/`) and prefix (`S!`) command interfaces
- Simple JSON persistence in `data/` for quick deployment

Prerequisites

- Node.js 18+ recommended
- No system FFmpeg required (uses `ffmpeg-static`), but platform binaries are supported

Quick start

1. Copy environment variables:

```powershell
cp .env.example .env
```

2. Edit `.env` and set `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID`.

3. Install dependencies:

```powershell
npm install
```

4. Register slash commands in your development guild:

```powershell
npm run register-commands
```

5. Run in development:

```powershell
npm run dev
```

Production build & run

```powershell
npm run build
npm start
```

Key files

- `src/index.ts` — bot entry point, command loader, and handlers
- `src/services/audioManager.ts` — playback pipeline, FFmpeg filter strings, crossfade logic
- `src/services/storage.ts` — JSON storage helpers for `data/`
- `data/` — runtime persisted settings (`settings.json`) and `playlists.json`

Deployment notes

- `ffmpeg-static` is included so most hosts work without installing system FFmpeg.
- Recommended Node: 18+. Use a modern host (Render, Fly, Heroku) for 24/7 uptime.
- To deploy on Render: connect the GitHub repo `github.com/Veylein/Sonus`, set `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, and run using the provided `Procfile` or `npm start`.

Smoke tests

- Confirm `GUILD_ID` is set and bot is invited to the test server.
- Run `/ping` and `S!help`.
- Join a voice channel and run `S!play <url or query>` or `/play`.
- Try `/eq`, `S!radio` and check `data/settings.json` for persistence.

Troubleshooting

- If `npm install` fails on Windows due to native builds, we removed native DB deps; JSON storage is used by default.
- If audio doesn't stream, ensure the host allows outbound access to YouTube and that `ffmpeg-static` is functional.

Contributing

- Open PRs against `main`. I can add a `CONTRIBUTING.md` and CI if you want.

License

- See the included `LICENSE` file for license details.

If you'd like, I can also add a short `CONTRIBUTING.md`, create GitHub Actions for linting, or expand the README with command examples and screenshots.

- TypeScript bot skeleton (`src/index.ts`)
- Command loader (`src/commands/*.ts`) with `/ping` and `/play` (stub)
- `AudioManager` service scaffold (`src/services/audioManager.ts`)
- `scripts/register-commands.ts` to deploy slash commands to a guild
- `.env.example` and instructions

## Next steps (ideas)

- Implement full playback using `@discordjs/voice` and `ytdl-core`
- Build radio system, playlists, queue intelligence
- Add DB-backed persistence for playlists and radios
- Add tests, CI, and Render deploy config

If you want, I can now implement the radio system, playlist DB, or full play pipeline. Which should I do next?
