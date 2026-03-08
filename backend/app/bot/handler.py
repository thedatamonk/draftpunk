from agents import Runner
from loguru import logger
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

from app.agent import memory_agent
from app.config import get_settings


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    message = update.message.text

    if not message:
        return

    logger.info("User {}: {}", user_id, message)

    try:
        result = await Runner.run(
            memory_agent,
            message,
            session_id=str(user_id),
        )
        response = result.final_output
    except Exception as e:
        logger.error("Agent error for user {}: {}", user_id, e)
        response = "Something went wrong. Please try again."

    await update.message.reply_text(response)
    logger.info("Reply to {}: {}", user_id, response[:100])


def build_bot_app():
    settings = get_settings()
    app = ApplicationBuilder().token(settings.telegram_bot_token).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return app
