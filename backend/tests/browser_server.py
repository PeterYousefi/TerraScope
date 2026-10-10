"""Explicit browser test fixture server. Never imported by production app."""

from pathlib import Path
from tempfile import TemporaryDirectory

from app.config import Settings
from app.main import create_app
from tests.test_api import FixtureProviders

_directory = TemporaryDirectory(prefix="sitesignal-browser-test-")
app = create_app(
    Settings(
        database_url=f"sqlite:///{Path(_directory.name) / 'tests.db'}",
        cors_origins="http://127.0.0.1:5174,http://localhost:5174",
    ),
    FixtureProviders,
)
