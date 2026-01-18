<<<<<<< HEAD
import asyncio
from typing import Optional, Dict, Any, List

import discord
from discord import app_commands
from discord.ext import commands
import yt_dlp

from src.logger import setup_logger
from src.utils.audit import log_action

logger = setup_logger(__name__)
=======
<<<<<<< HEAD
from discord import Embed
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9


YTDL_OPTS = {
    'format': 'bestaudio/best',
    'quiet': True,
    'nocheckcertificate': True,
    'no_warnings': True,
}


def _select_audio_url(info: Dict[str, Any]) -> Optional[str]:
    if not info:
        return None
    if info.get('url'):
        return info['url']
    formats: List[Dict[str, Any]] = info.get('formats') or []
    audio_only = [f for f in formats if (not f.get('vcodec') or f.get('vcodec') == 'none') and f.get('acodec') and f.get('acodec') != 'none']
    if audio_only:
        audio_only.sort(key=lambda f: (f.get('abr') or 0, f.get('tbr') or 0), reverse=True)
        return audio_only[0].get('url')
    for f in formats:
        if f.get('url'):
            return f.get('url')
    return None


async def _yt_search(query: str, attempts: int = 3, backoff: float = 0.5) -> Optional[dict]:
    loop = asyncio.get_running_loop()

    def run(q):
        with yt_dlp.YoutubeDL(YTDL_OPTS) as ytdl:
            try:
                return ytdl.extract_info(q, download=False)
            except Exception:
                logger.exception('yt-dlp extract failed for query/url: %s', q)
                return None

    for i in range(attempts):
        info = await loop.run_in_executor(None, run, query)
        if info:
            return info
        await asyncio.sleep(backoff * (2 ** i))
    return None


def _ensure_guild_queue(bot, guild_id: int):
    q = getattr(bot, 'sonus_queues', None)
    if q is None:
        bot.sonus_queues = {}
        q = bot.sonus_queues
    if guild_id not in q:
        q[guild_id] = []
    return q[guild_id]


async def _create_player_with_probe(url: str, ffmpeg_options: Dict[str, str], timeout: float = 12.0):
    loop = asyncio.get_running_loop()

    def do_probe(u):
        return discord.FFmpegOpusAudio.from_probe(u, **ffmpeg_options)

    def do_plain(u):
        return discord.FFmpegOpusAudio(u, **ffmpeg_options)

    try:
        player = await asyncio.wait_for(loop.run_in_executor(None, do_probe, url), timeout=timeout)
        return player
    except Exception as exc:
        logger.exception('Probe attempt failed for %s: %s', url, exc)
        # fallback to plain construction
        try:
            player = await loop.run_in_executor(None, do_plain, url)
            return player
        except Exception as exc2:
            logger.exception('Plain FFmpeg construction failed for %s: %s', url, exc2)
            raise

<<<<<<< HEAD
=======
        e = Embed(title="Enqueued", description=f"{query}")
        await ctx.send(embed=e)
=======
import asyncio
from typing import Optional, Dict, Any, List

import discord
import asyncio
from typing import Optional, Dict, Any, List

import discord
from discord import app_commands
from discord.ext import commands
import yt_dlp
import time

from src.logger import setup_logger
from src.utils.audit import log_action

logger = setup_logger(__name__)


YTDL_OPTS = {
    'format': 'bestaudio/best',
    'quiet': True,
    'nocheckcertificate': True,
    'no_warnings': True,
}


def _select_audio_url(info: Dict[str, Any]) -> Optional[str]:
    # prefer top-level 'url' (direct stream), else pick best audio-only format
    if not info:
        return None
    if info.get('url'):
        return info['url']
    formats: List[Dict[str, Any]] = info.get('formats') or []
    # find audio-only formats first
    audio_only = [f for f in formats if (not f.get('vcodec') or f.get('vcodec') == 'none') and f.get('acodec') and f.get('acodec') != 'none']
    if audio_only:
        # pick highest abr or filesize
        audio_only.sort(key=lambda f: (f.get('abr') or 0, f.get('tbr') or 0), reverse=True)
        return audio_only[0].get('url')
    # fallback: pick best format that has an url
    for f in formats:
        if f.get('url'):
            return f.get('url')
    return None


async def _yt_search(query: str, attempts: int = 3, backoff: float = 0.5) -> Optional[dict]:
    loop = asyncio.get_running_loop()

    def run(q):
        with yt_dlp.YoutubeDL(YTDL_OPTS) as ytdl:
            try:
                return ytdl.extract_info(q, download=False)
            except Exception:
                return None

    for i in range(attempts):
        info = await loop.run_in_executor(None, run, query)
        if info:
            return info
        await asyncio.sleep(backoff * (2 ** i))
    return None


def _ensure_guild_queue(bot, guild_id: int):
    q = getattr(bot, 'sonus_queues', None)
    if q is None:
        bot.sonus_queues = {}
        q = bot.sonus_queues
    if guild_id not in q:
        q[guild_id] = []
    return q[guild_id]

>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9

def register(bot: commands.Bot):
    @bot.command(name='play')
    async def _play(ctx: commands.Context, *, query: str):
        """Prefix: S!play <query|url> — enqueue or play immediately."""
        guild = ctx.guild
        if guild is None:
            await ctx.send('Playback is only available in a guild.')
            return

        info = await _yt_search(query)
        if not info:
            await ctx.send('Could not find or extract the requested media.')
            return

<<<<<<< HEAD
=======
        # prefer direct url if available
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
        url = info.get('url') or (info.get('formats') and info['formats'][0].get('url'))
        title = info.get('title') or query

        track = {'title': title, 'url': url, 'webpage_url': info.get('webpage_url')}

        q = _ensure_guild_queue(bot, guild.id)
        q.append(track)

<<<<<<< HEAD
=======
        # ensure voice connection
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
        vc = guild.voice_client
        try:
            if not vc or not vc.is_connected():
                if ctx.author.voice and ctx.author.voice.channel:
                    vc = await ctx.author.voice.channel.connect()
                else:
                    await ctx.send('Bot is not connected to a voice channel and you are not in one.')
                    await log_action(bot, ctx.author.id, 'play_failed', {'title': title, 'reason': 'no_channel'})
                    return
            else:
<<<<<<< HEAD
=======
                # if connected to a different channel, try to move to the author's channel
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
                author_chan = getattr(ctx.author.voice, 'channel', None)
                if author_chan and vc.channel != author_chan:
                    try:
                        await vc.move_to(author_chan)
                    except Exception:
<<<<<<< HEAD
=======
                        # ignore move failures, continue using current vc
                        pass

            if not vc.is_playing():
                await ctx.send(f'Now playing: {title}')
                await _play_next(bot, guild.id)
            else:
                await ctx.send(f'Enqueued: {title}')

            await log_action(bot, ctx.author.id, 'play', {'title': title})
        except Exception as exc:
            await ctx.send(f'Failed to prepare playback: {exc}')
            await log_action(bot, ctx.author.id, 'play_failed', {'title': title, 'error': str(exc)})

    @bot.tree.command(name='play')
    @app_commands.describe(query='Search term or URL')
    async def _play_slash(interaction: discord.Interaction, query: str):
        await interaction.response.defer()
        ctx = await commands.Context.from_interaction(interaction)
        await _play(ctx, query=query)
async def _play_next(bot: commands.Bot, guild_id: int):
    q = getattr(bot, 'sonus_queues', {}).get(guild_id, [])
    if not q:
        return

    track = q.pop(0)
    guild = bot.get_guild(guild_id)
    if not guild:
        return
    vc = guild.voice_client
    if not vc:
        return

    # FFmpeg options
    ffmpeg_options = {
        'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
        'options': '-vn'
    }

    source_url = track.get('url') or track.get('webpage_url')
    if not source_url:
        return

    tried_sources = []
    # Attempt to probe the current stored URL first, then fallback to re-extracting formats
    candidate_urls = [source_url]

    async def _extract_candidates(url_or_page: str) -> List[str]:
        info = await _yt_search(url_or_page)
        if not info:
            return []
        urls = []
        direct = _select_audio_url(info)
        if direct:
            urls.append(direct)
        # include webpage_url as last resort
        if info.get('webpage_url') and info.get('webpage_url') not in urls:
            urls.append(info.get('webpage_url'))
        return urls

    # If the stored url looks like a webpage or is a known host, try extracting more candidates
    lower_src = (source_url or '').lower()
    if not source_url.startswith('http') or ('youtube' in lower_src) or ('soundcloud' in lower_src) or ('spotify' in lower_src):
        candidate_urls = await _extract_candidates(source_url)
    else:
        # still try to re-extract using webpage_url if present
        if track.get('webpage_url'):
            candidate_urls += await _extract_candidates(track.get('webpage_url'))

    # dedupe while preserving order
    seen = set()
    candidate_urls = [u for u in candidate_urls if u and (u not in seen and not seen.add(u))]

    for src in candidate_urls:
        tried_sources.append(src)
        try:
            player = discord.FFmpegOpusAudio.from_probe(src, **ffmpeg_options)
            vc.play(player, after=lambda e: asyncio.get_event_loop().create_task(_after_play(bot, guild_id, e)))
            return
        except Exception as exc:
            logger.exception('Probe failed for %s: %s', src, exc)
            # try next

    # all attempts failed: log and skip
    logger.error('All probes failed for track %s (tried: %s)', track.get('title'), tried_sources)
    await log_action(bot, 0, 'playback_error', {'guild_id': guild_id, 'track': track.get('title'), 'tried': tried_sources})
    # continue to next track
    await _play_next(bot, guild_id)
        try:
            if not vc or not vc.is_connected():
                if ctx.author.voice and ctx.author.voice.channel:
                    vc = await ctx.author.voice.channel.connect()
                else:
                    await ctx.send('Bot is not connected to a voice channel and you are not in one.')
                    await log_action(bot, ctx.author.id, 'play_failed', {'title': title, 'reason': 'no_channel'})
                    return
            else:
                # if connected to a different channel, try to move to the author's channel
                author_chan = getattr(ctx.author.voice, 'channel', None)
                if author_chan and vc.channel != author_chan:
                    try:
                        await vc.move_to(author_chan)
                    except Exception:
                        # ignore move failures, continue using current vc
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
                        pass

            if not vc.is_playing():
                await ctx.send(f'Now playing: {title}')
                await _play_next(bot, guild.id)
            else:
                await ctx.send(f'Enqueued: {title}')

            await log_action(bot, ctx.author.id, 'play', {'title': title})
        except Exception as exc:
            await ctx.send(f'Failed to prepare playback: {exc}')
            await log_action(bot, ctx.author.id, 'play_failed', {'title': title, 'error': str(exc)})

    @bot.tree.command(name='play')
    @app_commands.describe(query='Search term or URL')
    async def _play_slash(interaction: discord.Interaction, query: str):
        await interaction.response.defer()
        ctx = await commands.Context.from_interaction(interaction)
        await _play(ctx, query=query)


async def _play_next(bot: commands.Bot, guild_id: int):
    q = getattr(bot, 'sonus_queues', {}).get(guild_id, [])
    if not q:
        return

    track = q.pop(0)
    guild = bot.get_guild(guild_id)
    if not guild:
        return
    vc = guild.voice_client
    if not vc:
        return

<<<<<<< HEAD
=======
    # FFmpeg options
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
    ffmpeg_options = {
        'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
        'options': '-vn'
    }

    source_url = track.get('url') or track.get('webpage_url')
    if not source_url:
        return

    tried_sources = []
<<<<<<< HEAD
=======
    # Attempt to probe the current stored URL first, then fallback to re-extracting formats
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
    candidate_urls = [source_url]

    async def _extract_candidates(url_or_page: str) -> List[str]:
        info = await _yt_search(url_or_page)
        if not info:
            return []
        urls = []
        direct = _select_audio_url(info)
        if direct:
            urls.append(direct)
<<<<<<< HEAD
=======
        # include webpage_url as last resort
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
        if info.get('webpage_url') and info.get('webpage_url') not in urls:
            urls.append(info.get('webpage_url'))
        return urls

<<<<<<< HEAD
=======
    # If the stored url looks like a webpage or is a known host, try extracting more candidates
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
    lower_src = (source_url or '').lower()
    if not source_url.startswith('http') or ('youtube' in lower_src) or ('soundcloud' in lower_src) or ('spotify' in lower_src):
        candidate_urls = await _extract_candidates(source_url)
    else:
<<<<<<< HEAD
        if track.get('webpage_url'):
            candidate_urls += await _extract_candidates(track.get('webpage_url'))

=======
        # still try to re-extract using webpage_url if present
        if track.get('webpage_url'):
            candidate_urls += await _extract_candidates(track.get('webpage_url'))

    # dedupe while preserving order
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
    seen = set()
    candidate_urls = [u for u in candidate_urls if u and (u not in seen and not seen.add(u))]

    for src in candidate_urls:
        tried_sources.append(src)
        try:
<<<<<<< HEAD
            player = await _create_player_with_probe(src, ffmpeg_options, timeout=12.0)
            # mark now playing for UI and commands
            try:
                setattr(bot, 'sonus_now_playing', track)
            except Exception:
                pass
            try:
                vc.play(player, after=lambda e: asyncio.get_event_loop().create_task(_after_play(bot, guild_id, e)))
            except Exception as play_exc:
                logger.exception('vc.play failed for %s: %s', src, play_exc)
                # cleanup and try next source
                try:
                    player.cleanup()
                except Exception:
                    pass
                continue
            return
        except Exception as exc:
            logger.exception('Probe/plain creation failed for %s: %s', src, exc)
            # try next

    logger.error('All probes failed for track %s (tried: %s)', track.get('title'), tried_sources)
    await log_action(bot, 0, 'playback_error', {'guild_id': guild_id, 'track': track.get('title'), 'tried': tried_sources})
    try:
        setattr(bot, 'sonus_now_playing', None)
    except Exception:
        pass
    await _play_next(bot, guild_id)


async def _after_play(bot: commands.Bot, guild_id: int, error):
    if error:
        logger.exception('Error in playback: %s', error)
    try:
        setattr(bot, 'sonus_now_playing', None)
    except Exception:
        pass
    await _play_next(bot, guild_id)
=======
            player = discord.FFmpegOpusAudio.from_probe(src, **ffmpeg_options)
            vc.play(player, after=lambda e: asyncio.get_event_loop().create_task(_after_play(bot, guild_id, e)))
            return
        except Exception as exc:
            logger.exception('Probe failed for %s: %s', src, exc)
            # try next

    # all attempts failed: log and skip
    logger.error('All probes failed for track %s (tried: %s)', track.get('title'), tried_sources)
    await log_action(bot, 0, 'playback_error', {'guild_id': guild_id, 'track': track.get('title'), 'tried': tried_sources})
    # continue to next track
    await _play_next(bot, guild_id)

>>>>>>> 54ccf42 (music: parity UI and volume modal/cooldowns; harden yt-dlp fallbacks)
>>>>>>> b17e71ce5e6888c2ecaebf88bb89cfcd69c2dde9
