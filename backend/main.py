import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure the working directory is always the backend folder so that
# relative paths (.env, memory_ledger.json) resolve correctly whether
# main.py is invoked from the repo root or from inside backend/.
_HERE = Path(__file__).parent.resolve()
import os
os.chdir(_HERE)

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from app.api.routes import router
from app.config import get_settings

# Configure loguru
logger.remove()
logger.add(sys.stderr, level="INFO", format="{time:HH:mm:ss} | {level:<7} | {message}")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch the Telegram bot
    if not settings.telegram_bot_token:
        logger.warning("TELEGRAM_BOT_TOKEN not set — bot will not start")
    else:
        from app.bot.handler import build_bot_app

        bot_app = build_bot_app()
        app.state.bot = bot_app
        await bot_app.initialize()
        await bot_app.start()
        await bot_app.updater.start_polling(drop_pending_updates=True)
        logger.info("Telegram bot started (polling)")

    yield

    # Shutdown: stop the Telegram bot
    bot_app = getattr(app.state, "bot", None)
    if bot_app:
        await bot_app.updater.stop()
        await bot_app.stop()
        await bot_app.shutdown()
        logger.info("Telegram bot stopped")


app = FastAPI(title="Memory Ledger", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("{} {}", request.method, request.url.path)
    response: Response = await call_next(request)
    logger.info("→ {}", response.status_code)
    return response


app.include_router(router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, app_dir=str(_HERE))
