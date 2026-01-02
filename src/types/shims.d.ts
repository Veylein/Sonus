// Lightweight shims to prevent TS build failures on hosts that compile before deps are present.
declare module 'discord.js';
declare module '@discordjs/voice';
declare module 'ytdl-core';
declare module 'yt-search';
declare module 'ffmpeg-static';
declare module 'node-fetch';
declare module 'child_process';
declare module 'fs/promises';
declare module 'fs';
declare module 'path';

declare const require: any;
declare var __dirname: any;
declare var process: any;

// Minimal NodeJS namespace to satisfy some TS checks
declare namespace NodeJS {
  interface Process {
    env: { [key: string]: string | undefined };
  }
}
