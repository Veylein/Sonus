import discord
from discord.ext import commands
from discord import app_commands

from src.utils.guild_settings import load, set_prefix, set_color


def register(bot: commands.Bot):
    @bot.group(name='settings', invoke_without_command=True)
    async def _settings(ctx: commands.Context):
        if ctx.invoked_subcommand is None:
            data = load(ctx.guild.id) if ctx.guild else {"prefix": "S!", "color": "#1DB954"}
            e = discord.Embed(title='Server Settings', color=int(data.get('color', '#1DB954').lstrip('#'), 16))
            e.add_field(name='Prefix', value=data.get('prefix', 'S!'), inline=True)
            e.add_field(name='Color', value=data.get('color', '#1DB954'), inline=True)
            await ctx.send(embed=e)

    @_settings.command(name='prefix')
    async def _set_prefix(ctx: commands.Context, *, prefix: str):
        # require Manage Guild
        perms = ctx.author.guild_permissions
        if not perms.manage_guild:
            await ctx.send('You need the Manage Server permission to change settings.')
            return
        # show previous value in embed and confirm change
        data_before = load(ctx.guild.id) if ctx.guild else {"prefix": "S!", "color": "#1DB954"}
        old = data_before.get('prefix', 'S!')
        set_prefix(ctx.guild.id, prefix)
        color = data_before.get('color', '#1DB954')
        e = discord.Embed(title='Server Settings Updated', color=int(color.lstrip('#'), 16))
        e.add_field(name='Setting', value='Prefix', inline=True)
        e.add_field(name='Old', value=old, inline=True)
        e.add_field(name='New', value=prefix, inline=True)
        await ctx.send(embed=e)

    @_settings.command(name='color')
    async def _set_color(ctx: commands.Context, color: str):
        perms = ctx.author.guild_permissions
        if not perms.manage_guild:
            await ctx.send('You need the Manage Server permission to change settings.')
            return
        # validate hex
        if color.startswith('#') and len(color) in (4, 7):
            set_color(ctx.guild.id, color)
            await ctx.send(f'Color set to: {color}')
            return
        await ctx.send('Provide a color in hex form, e.g. #1DB954')

    @bot.tree.command(name='settings-prefix')
    @app_commands.describe(prefix='New command prefix for this server')
    async def _set_prefix_slash(interaction: discord.Interaction, prefix: str):
        await interaction.response.defer(ephemeral=True)
        perms = interaction.user.guild_permissions
        if not perms.manage_guild:
            await interaction.followup.send('You need the Manage Server permission to change settings.', ephemeral=True)
            return
        data_before = load(interaction.guild.id) if interaction.guild else {"prefix": "S!", "color": "#1DB954"}
        old = data_before.get('prefix', 'S!')
        set_prefix(interaction.guild.id, prefix)
        color = data_before.get('color', '#1DB954')
        e = discord.Embed(title='Server Settings Updated', color=int(color.lstrip('#'), 16))
        e.add_field(name='Setting', value='Prefix', inline=True)
        e.add_field(name='Old', value=old, inline=True)
        e.add_field(name='New', value=prefix, inline=True)
        await interaction.followup.send(embed=e, ephemeral=True)

    @bot.tree.command(name='settings-color')
    @app_commands.describe(color='Hex color, e.g. #1DB954')
    async def _set_color_slash(interaction: discord.Interaction, color: str):
        await interaction.response.defer(ephemeral=True)
        perms = interaction.user.guild_permissions
        if not perms.manage_guild:
            await interaction.followup.send('You need the Manage Server permission to change settings.', ephemeral=True)
            return
        if color.startswith('#') and len(color) in (4, 7):
            set_color(interaction.guild.id, color)
            await interaction.followup.send(f'Color set to: {color}', ephemeral=True)
            return
        await interaction.followup.send('Provide a color in hex form, e.g. #1DB954', ephemeral=True)
