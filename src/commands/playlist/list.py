from discord.ext import commands
from discord import app_commands
from src.utils.playlist_store import list_playlists, get_playlist


def register(bot: commands.Bot):
    @bot.command(name='playlist_list')
    async def _list(ctx: commands.Context, only_mine: bool = False):
        """S!playlist list [only_mine] - list playlists or only your playlists"""
        owner = ctx.author.id if only_mine else None
        pls = list_playlists(owner)
        if not pls:
            await ctx.send('No playlists found.')
            return
        lines = [f"{p['id']}: {p['name']} (tracks: {len(p.get('tracks', []))})" for p in pls]
        await ctx.send('Playlists:\n' + '\n'.join(lines))

    @bot.tree.command(name='playlist-list')
    @app_commands.describe(only_mine='Show only your playlists')
    async def _list_slash(interaction: commands.Context, only_mine: bool = False):
        await interaction.response.defer(ephemeral=True)
        ctx = await commands.Context.from_interaction(interaction)
        await _list(ctx, only_mine=only_mine)
