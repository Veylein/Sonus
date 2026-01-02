# Sonus — Ultimate Discord Audio Ecosystem

Lightweight scaffold for Sonus: a Discord audio infrastructure bot. This repo provides a TypeScript skeleton, command loader, audio manager stub, and registration script for slash commands.

## Quick start

1. Copy `.env.example` to `.env` and fill `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` for development.

2. Install dependencies:

```bash
npm install
```

3. Register slash commands (development guild):

```bash
npm run register-commands
```

4. Run in dev mode:

```bash
npm run dev
```

5. Build and run production:

```bash
npm run build
npm start
```

## What's included

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
