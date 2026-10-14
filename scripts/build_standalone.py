"""Package the current dashboard as one HTML file that opens offline."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "След участника — дашборд.html"


def replace_once(html: str, old: str, new: str) -> str:
    if html.count(old) != 1:
        raise ValueError(f"Expected exactly one occurrence of {old!r}")
    return html.replace(old, new, 1)


def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    if re.search(r"</style|@import|url\(", css, re.IGNORECASE):
        raise ValueError("Review stylesheet dependencies before packaging")
    html = replace_once(
        html, '<link rel="stylesheet" href="styles.css" />',
        f"<style>\n{css}\n    </style>",
    )

    scripts = []
    for filename in ("assets/data.js", "dashboard.js"):
        html = replace_once(html, f'<script src="{filename}" defer></script>', "")
        script = (ROOT / filename).read_text(encoding="utf-8")
        # Keep literal closing tags inside data strings from ending the script.
        script = re.sub(r"</script", lambda match: r"<\/" + match[0][2:], script, flags=re.IGNORECASE)
        script = script.replace("<!--", r"\x3c!--")
        scripts.append(f"<script>\n{script}\n</script>")

    # Inline classic scripts execute immediately, so place them after the DOM.
    html = replace_once(html, "</body>", "\n".join(scripts) + "\n  </body>")
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Created {OUTPUT.name} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
