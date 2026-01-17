import importlib
import pkgutil
from pathlib import Path

import discord
from discord.ext import commands

from src.config import Config
from src.logger import setup_logger
from src.audio.player import Player
from src.audio.queue import TrackQueue

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


def _register_command_modules(bot):
    try:
        import src.commands as commands_pkg
    except Exception:
        logger.exception("Could not import src.commands package")
        return

    for finder, name, ispkg in pkgutil.walk_packages(commands_pkg.__path__, commands_pkg.__name__ + "."):
        try:
            mod = importlib.import_module(name)
            if hasattr(mod, "register"):
                mod.register(bot)
                logger.info(f"Registered command module: {name}")
        except Exception:
            logger.exception(f"Failed to register command module: {name}")


def create_bot():
    intents = discord.Intents.default()
    intents.message_content = True
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
        bot.track_queue = TrackQueue()
    except Exception:
        logger.exception("Failed to attach audio primitives")

    # Auto-register event and command modules found under src.events and src.commands
    _register_event_modules(bot)
    _register_command_modules(bot)

    return bot
