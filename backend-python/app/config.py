from pathlib import Path

from pydantic_settings import BaseSettings
from functools import lru_cache

# Resolve project root .env regardless of where uvicorn is launched from.
# Inside Docker: env vars come from docker-compose, so .env file is optional.
# Locally:       picks up D:\Jayant\Trade-Analyser\.env
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    # Database
    database_url: str

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    # Vision model — used to analyse images in uploaded PDFs (candlestick charts, indicator screenshots).
    # gpt-4o-mini supports vision and is ~25x cheaper than gpt-4o.
    openai_vision_model: str = "gpt-4o-mini"

    # Vision pipeline tuning
    enable_pdf_vision: bool = True            # set False to skip image analysis (faster, cheaper uploads)
    vision_max_images_per_pdf: int = 60       # hard cap per document — 200-page PDFs won't burn 200 vision calls
    vision_min_image_pixels:   int = 40_000   # 200×200 — filter tiny icons/logos
    vision_concurrency:        int = 4        # parallel vision calls per document

    # Auth (shared secret with Node backend)
    jwt_secret: str

    # Processing
    chunk_size: int = 1000
    chunk_overlap: int = 200
    retrieval_top_k: int = 5

    # File storage
    upload_dir: str = "/app/uploads"

    # Internal service URL
    node_service_url: str = "http://localhost:3001"

    # Tavily web search (optional — leave blank to disable real-time news search)
    tavily_api_key: str = ""

    class Config:
        env_file = str(_ENV_FILE)
        case_sensitive = False
        extra = "ignore"   # ignore extra keys in .env (Node/frontend keys etc.)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
