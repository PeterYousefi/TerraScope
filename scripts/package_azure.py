"""Package only runtime code and prebuilt browser assets; never local keys or data."""

import sys
import tomllib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
frontend = root / "lovable/dist/client"
if not (frontend / "_shell.html").is_file():
    raise SystemExit("Build first: STATIC_HOSTING=true VITE_API_BASE_URL=/ npm run build")
output = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/terrascope-azure.zip")
dependencies = tomllib.loads((root / "backend/pyproject.toml").read_text())["project"][
    "dependencies"
]
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for path in sorted((root / "backend/app").glob("*.py")):
        archive.write(path, f"app/{path.name}")
    for path in sorted(frontend.rglob("*")):
        if path.is_file() and not any(p.startswith(".") for p in path.relative_to(frontend).parts):
            archive.write(path, f"frontend/{path.relative_to(frontend).as_posix()}")
    archive.writestr("requirements.txt", "\n".join(dependencies) + "\n")
print(f"Created {output} ({output.stat().st_size / 1024 / 1024:.2f} MiB)")
