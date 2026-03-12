from agents import RunHooks, Runner, SQLiteSession
from loguru import logger
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

from app.agent import memory_agent
from app.config import get_settings


class LoggingHooks(RunHooks):
    async def on_agent_start(self, context, agent):
        logger.info("[agent] {} started", agent.name)

    async def on_tool_start(self, context, agent, tool):
        logger.info("[tool] calling {} | args: {}", tool.name, context.tool_arguments)

    async def on_tool_end(self, context, agent, tool, result):
        preview = str(result)[:200]
        logger.info("[tool] {} completed | result: {}", tool.name, preview)

    async def on_agent_end(self, context, agent, output):
        logger.info("[agent] {} finished", agent.name)


_hooks = LoggingHooks()


def _get_session(user_id: int) -> SQLiteSession:
    """Get a persistent SQLiteSession for a Telegram user, backed by the app's DB."""
    return SQLiteSession(
        session_id=str(user_id),
        db_path=get_settings().db_path,
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    message = update.message.text

    if not message:
        return

    logger.info("[msg] User {}: {}", user_id, message)

    try:
        session = _get_session(user_id)
        result = await Runner.run(
            memory_agent,
            message,
            session=session,
            hooks=_hooks,
        )
        response = result.final_output
    except Exception as e:
        logger.error("[error] Agent error for user {}: {}", user_id, e)
        response = "Something went wrong. Please try again."

    await update.message.reply_text(response)
    logger.info("[reply] Sent to user {}", user_id)


def build_bot_app():
    settings = get_settings()
    app = ApplicationBuilder().token(settings.telegram_bot_token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return app
