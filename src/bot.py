import importlib
import pkgutil
from pathlib import Path

import discord
from discord.ext import commands

from src.config import Config
from src.logger import setup_logger
from src.audio.player import Player

logger = setup_logger(__name__)


def _register_event_modules(bot):
    try:
        import src.events as events_pkg
    except Exception:
        logger.exception("Could not import src.events package")
        return

    for finder, name, ispkg in pkgutil.iter_modules(events_pkg.__path__):
        full = f"{events_pkg.__name__}.{name}"
        try:
            mod = importlib.import_module(full)
            if hasattr(mod, "register"):
                mod.register(bot)
                logger.info(f"Registered event module: {full}")
        except Exception:
            logger.exception(f"Failed to register event module: {full}")


async def _register_command_modules(bot):
    """Automatically load all cogs from src.commands and src.ui as Cogs."""
    for pkg_name in ["src.commands", "src.ui"]:
        try:
            pkg = importlib.import_module(pkg_name)
        except Exception:
            logger.exception(f"Could not import {pkg_name} package")
            continue

        for finder, name, ispkg in pkgutil.walk_packages(pkg.__path__, pkg.__name__ + "."):
            try:
                mod = importlib.import_module(name)
                # Modern approach: cogs must have async def setup(bot) for loading
                if hasattr(mod, "setup"):
                    await mod.setup(bot)
                    logger.info(f"Loaded cog: {name}")
            except Exception:
                logger.exception(f"Failed to load cog: {name}")


def create_bot():
    intents = discord.Intents.default()
    intents.message_content = True
    intents.guilds = True
    intents.voice_states = True

    bot = commands.Bot(
        command_prefix=commands.when_mentioned_or("S!"),
        intents=intents
    )

    bot.config = Config()
    bot.logger = logger

    # attach lightweight in-memory audio primitives
    try:
        bot.player = Player()
        try:
            from src.audio.queue import TrackQueue

            bot.track_queue = TrackQueue()
        except Exception:
            bot.track_queue = []
    except Exception:
        logger.exception("Failed to attach audio primitives")

    # Auto-register event modules
    _register_event_modules(bot)

    # Command / UI modules are loaded asynchronously as cogs
    # We'll handle that in on_ready
    @bot.event
    async def on_ready():
        logger.info(f"Bot ready as {bot.user}")
        # Load commands and UI cogs
        await _register_command_modules(bot)
        # Sync slash commands globally
        try:
            await bot.tree.sync()
            logger.info("✅ Slash commands synced successfully")
        except Exception:
            logger.exception("❌ Failed to sync slash commands")

    return bot
