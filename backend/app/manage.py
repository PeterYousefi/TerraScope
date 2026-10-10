"""Explicit local database administration; no cloud actions."""

import argparse

from .config import Settings
from .store import Store

parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["init", "clear-cache"])
args = parser.parse_args()
store = Store(Settings().database_url)
if args.action == "clear-cache":
    store.clear_cache()
    print("Provider cache cleared; investigations retained.")
else:
    print("Local SQLite database initialized.")
