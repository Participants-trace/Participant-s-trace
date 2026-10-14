"""Synchronize the static GitHub Pages artifact in ``dist``."""

from pathlib import Path
from shutil import copy2


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

FILES = (
    "index.html",
    "styles.css",
    "dashboard.js",
    "site.webmanifest",
    "assets/data.js",
    "assets/favicon-32.png",
    "assets/favicon-192.png",
    "assets/favicon-512.png",
    "assets/apple-touch-icon.png",
)


def main() -> None:
    for relative_name in FILES:
        source = ROOT / relative_name
        destination = DIST / relative_name
        if not source.is_file():
            raise FileNotFoundError(f"Required site file is missing: {relative_name}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        copy2(source, destination)

    (DIST / ".nojekyll").touch()
    print(f"Prepared GitHub Pages artifact in {DIST}")


if __name__ == "__main__":
    main()
