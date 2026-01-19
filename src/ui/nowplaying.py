import asyncio
import discord
from discord import Embed
from discord.ext import commands
from typing import Optional

VIEW_TIMEOUT = None


def _build_embed(track: Optional[dict]) -> Embed:
    if not track:
        return Embed(title="Now Playing", description="Nothing is playing.")
    title = track.get('title', 'Unknown')
    url = track.get('webpage_url') or track.get('url')
    e = Embed(title="Now Playing", description=f"**{title}**")
    if url:
        e.add_field(name="Source", value=f"[link]({url})")
    return e


class NowPlayingView(discord.ui.View):
    def __init__(self, bot: commands.Bot, guild_id: int):
        super().__init__(timeout=VIEW_TIMEOUT)
        self.bot = bot
        self.guild_id = guild_id

    async def _get_ctx(self, interaction: discord.Interaction):
        return await commands.Context.from_interaction(interaction)

    @discord.ui.button(label='⏯️ Play/Pause', style=discord.ButtonStyle.primary, custom_id='np_playpause')
    async def play_pause(self, button: discord.ui.Button, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        ctx = await self._get_ctx(interaction)
        vc = ctx.guild.voice_client
        try:
            if vc and vc.is_playing():
                vc.pause()
                await interaction.followup.send('Paused', ephemeral=True)
            elif vc and vc.is_paused():
                vc.resume()
                await interaction.followup.send('Resumed', ephemeral=True)
            else:
                # try to start playback if queue exists
                player = getattr(self.bot, 'player', None)
                if player and hasattr(player, 'resume'):
                    player.resume()
                    await interaction.followup.send('Resumed player', ephemeral=True)
                else:
                    await interaction.followup.send('No active playback to toggle.', ephemeral=True)
        except Exception as exc:
            await interaction.followup.send(f'Error toggling playback: {exc}', ephemeral=True)

    @discord.ui.button(label='⏭️ Skip', style=discord.ButtonStyle.secondary, custom_id='np_skip')
    async def skip(self, button: discord.ui.Button, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        ctx = await self._get_ctx(interaction)
        try:
            vc = ctx.guild.voice_client
            if vc and vc.is_playing():
                vc.stop()
                await interaction.followup.send('Skipped track', ephemeral=True)
            else:
                player = getattr(self.bot, 'player', None)
                if player and hasattr(player, 'skip'):
                    player.skip()
                    await interaction.followup.send('Skipped (player)', ephemeral=True)
                else:
                    await interaction.followup.send('Nothing to skip.', ephemeral=True)
        except Exception as exc:
            await interaction.followup.send(f'Error skipping: {exc}', ephemeral=True)

    @discord.ui.button(label='Vol -', style=discord.ButtonStyle.secondary, custom_id='np_vol_down')
    async def vol_down(self, button: discord.ui.Button, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            vc = interaction.guild.voice_client
            if not vc or not vc.source:
                await interaction.followup.send('No active audio source.', ephemeral=True)
                return
            current = getattr(vc.source, 'volume', 1.0)
            new = max(0.0, current - 0.1)
            if not hasattr(vc.source, 'volume'):
                vc.source = discord.PCMVolumeTransformer(vc.source)
            vc.source.volume = new
            await interaction.followup.send(f'Volume: {int(new*100)}%', ephemeral=True)
        except Exception as exc:
            await interaction.followup.send(f'Failed to change volume: {exc}', ephemeral=True)

    @discord.ui.button(label='Vol +', style=discord.ButtonStyle.secondary, custom_id='np_vol_up')
    async def vol_up(self, button: discord.ui.Button, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)
        try:
            vc = interaction.guild.voice_client
            if not vc or not vc.source:
                await interaction.followup.send('No active audio source.', ephemeral=True)
                return
            current = getattr(vc.source, 'volume', 1.0)
            new = min(2.0, current + 0.1)
            if not hasattr(vc.source, 'volume'):
                vc.source = discord.PCMVolumeTransformer(vc.source)
            vc.source.volume = new
            await interaction.followup.send(f'Volume: {int(new*100)}%', ephemeral=True)
        except Exception as exc:
            await interaction.followup.send(f'Failed to change volume: {exc}', ephemeral=True)


async def _updater_loop(bot: commands.Bot):
    await bot.wait_until_ready()
    while not bot.is_closed():
        try:
            meta = getattr(bot, 'sonus_now_message_meta', {})
            now_playing = getattr(bot, 'sonus_now_playing', None)
            for guild_id, m in list(meta.items()):
                try:
                    channel = bot.get_channel(m['channel_id'])
                    if not channel:
                        continue
                    msg = None
                    try:
                        msg = await channel.fetch_message(m['message_id'])
                    except Exception:
                        # message deleted or not cached
                        continue
                    new_embed = _build_embed(now_playing)
                    await msg.edit(embed=new_embed, view=NowPlayingView(bot, guild_id))
                except Exception:
                    pass
        except Exception:
            pass
        await asyncio.sleep(2.0)


def register(bot: commands.Bot):
    @bot.command(name='nowplaying')
    async def _nowplaying(ctx: commands.Context):
        """Post or refresh a persistent now-playing embed with playback controls."""
        embed = _build_embed(getattr(bot, 'sonus_now_playing', None))
        view = NowPlayingView(bot, ctx.guild.id)
        msg = await ctx.send(embed=embed, view=view)
        meta = getattr(bot, 'sonus_now_message_meta', {})
        meta[ctx.guild.id] = {'channel_id': ctx.channel.id, 'message_id': msg.id}
        bot.sonus_now_message_meta = meta
        await ctx.send('Now-playing message posted (persistent).', ephemeral=True)

    @bot.tree.command(name='nowplaying')
    async def _nowplaying_slash(interaction: discord.Interaction):
        await interaction.response.defer()
        ctx = await commands.Context.from_interaction(interaction)
        await _nowplaying(ctx)

    # start background updater task
    if not hasattr(bot, '_sonus_now_updater'):
        bot._sonus_now_updater = bot.loop.create_task(_updater_loop(bot))

    # Ensure persistent views are registered for existing now-playing messages
    try:
        meta = getattr(bot, 'sonus_now_message_meta', {}) or {}
        for guild_id, m in list(meta.items()):
            try:
                # Register a persistent view for the message so button interactions work across restarts
                view = NowPlayingView(bot, guild_id)
                bot.add_view(view, message_id=m.get('message_id'))
            except Exception:
                pass
    except Exception:
        pass
