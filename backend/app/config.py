from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    nlr_api_key: str = ""
    census_api_key: str = ""
    openrouteservice_api_key: str = ""
    openai_api_key: str = ""
    openai_model: str = ""
    enable_openai: bool = False
    database_url: str = Field(default="sqlite:///./data/sitesignal.db", pattern=r"^sqlite:///")
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    data_mode: Literal["live"] = "live"
    acs_year: int = Field(default=2024, ge=2020, le=2024)
    max_candidates: int = Field(default=80, ge=5, le=200)
    grid_meters: int = Field(default=3000, ge=1500, le=10000)
    catchment_meters: int = Field(default=2000, ge=500, le=5000)
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    max_jobs_per_hour: int = Field(default=10, ge=1, le=100)
    request_timeout: int = Field(default=60, ge=5, le=120)
    max_queue: int = Field(default=5, ge=1, le=20)
    static_dir: str = ""
    weights: dict[str, float] = {
        "Demand proxy": 0.35,
        "Coverage gap": 0.30,
        "Destinations": 0.20,
        "Road proximity": 0.15,
    }

    @property
    def ai_available(self):
        return self.enable_openai and bool(self.openai_api_key and self.openai_model)
