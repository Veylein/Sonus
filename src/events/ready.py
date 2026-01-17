from src.logger import setup_logger
import discord

logger = setup_logger(__name__)


def register(bot):
    @bot.event
    async def on_ready():
        logger.info(f"Logged in as {bot.user} (id={bot.user.id})")
        # Sync application commands to the development guild when available
        try:
            gid = getattr(bot.config, "GUILD_ID", None)
            if gid:
                await bot.tree.sync(guild=discord.Object(id=int(gid)))
                logger.info("Synced app commands to guild %s", gid)
            else:
                await bot.tree.sync()
                logger.info("Synced global app commands")
        except Exception:
            logger.exception("Failed to sync app commands")

        # start player loop if available
        try:
            if hasattr(bot, "player") and bot.player:
                bot.loop.create_task(bot.player.play_loop(bot))
                logger.info("Started player play_loop task")
        except Exception:
            logger.exception("Failed to start player loop")
