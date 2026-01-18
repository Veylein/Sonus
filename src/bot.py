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
                # Support two module styles:
                # 1) Modern Cog-style modules exposing `async def setup(bot)`
                # 2) Legacy modules exposing `def register(bot)` which attach commands/events
                if hasattr(mod, "setup"):
                    await mod.setup(bot)
                    logger.info(f"Loaded cog: {name}")
                elif hasattr(mod, "register"):
                    try:
                        mod.register(bot)
                        logger.info(f"Registered module via register(): {name}")
                    except Exception:
                        logger.exception(f"register() failed for module: {name}")
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
    async def _on_ready_internal():
        logger.info(f"Bot ready as {bot.user}")
        # Load commands and UI cogs
        await _register_command_modules(bot)
        # Sync slash commands globally
        try:
            await bot.tree.sync()
            logger.info("✅ Slash commands synced successfully")
            try:
                slash_count = sum(1 for _ in bot.tree.walk_commands())
                prefix_count = len(bot.commands)
                slash_names = [c.name for c in bot.tree.walk_commands()]
                prefix_names = [c.name for c in bot.commands]
                logger.info(f"Registered slash commands: {slash_count} -> {slash_names}")
                logger.info(f"Registered prefix commands: {prefix_count} -> {prefix_names}")
            except Exception:
                logger.exception("Failed to enumerate registered commands for diagnostics")
        except Exception:
            logger.exception("❌ Failed to sync slash commands")

    # Add as an event listener without overwriting any existing on_ready handlers
    bot.add_listener(_on_ready_internal, "on_ready")

    return bot