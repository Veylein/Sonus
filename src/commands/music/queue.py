from discord import Embed
import discord
from discord.ext import commands
from src.utils.audit import log_action


def register(bot):
    @bot.command(name="queue")
    async def _queue(ctx):
        try:
            items = bot.player.all()
        except Exception:
            items = getattr(bot, "sonus_queues", {}).get(ctx.guild.id, [])

        if not items:
            await ctx.send("Queue is empty")
            return

        e = Embed(title="Queue")
        for i, t in enumerate(items[:10], start=1):
            e.add_field(name=f"{i}. {t.get('title')}", value=t.get("uri", t.get('webpage_url', '')), inline=False)
        view = QueueView(bot, ctx.guild.id)
        await ctx.send(embed=e, view=view)
        await log_action(bot, ctx.author.id, 'queue_view', {'size': len(items)})

    @bot.tree.command(name='queue')
    async def _queue_slash(interaction: discord.Interaction):
        await interaction.response.defer()
        ctx = await commands.Context.from_interaction(interaction)
        await _queue(ctx)


    class QueueView(discord.ui.View):
        def __init__(self, bot, guild_id: int):
            super().__init__(timeout=300)
            self.bot = bot
            self.guild_id = guild_id

        @discord.ui.button(label='Skip', style=discord.ButtonStyle.secondary, custom_id='sonus_queue_skip')
        async def skip(self, button: discord.ui.Button, interaction: discord.Interaction):
            await interaction.response.defer(ephemeral=True)
            ctx = await commands.Context.from_interaction(interaction)
            # reuse skip command behavior
            try:
                vc = ctx.guild.voice_client
                if vc and vc.is_playing():
                    vc.stop()
                    await interaction.followup.send('Skipped.', ephemeral=True)
                    await log_action(self.bot, interaction.user.id, 'skip', {'via': 'queue_button'})
                    return
                player = getattr(self.bot, 'player', None)
                if player and hasattr(player, 'skip'):
                    player.skip()
                    await interaction.followup.send('Skipped (player).', ephemeral=True)
                    await log_action(self.bot, interaction.user.id, 'skip', {'via': 'player_button'})
                    return
                await interaction.followup.send('Nothing to skip.', ephemeral=True)
            except Exception as exc:
                await interaction.followup.send(f'Error skipping: {exc}', ephemeral=True)

