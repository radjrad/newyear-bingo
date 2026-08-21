"""Bundle the app into single self-contained HTML files.

Two outputs land in share/:

  newyear-bingo.html  a complete page. Send it over WhatsApp or email and it
                      opens by double-clicking, no server and no internet.
  artifact.html       the same page as a fragment (no <html>/<head>/<body>),
                      which is the shape the Artifact publisher expects.

Run it after editing anything in css/ or js/:  python3 build.py
"""

import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
SHARE = os.path.join(ROOT, "share")

FONT_IMPORT = (
    "@import url('https://fonts.googleapis.com/css2"
    "?family=Poppins:wght@600;700;800&display=swap');\n"
)

JS_FILES = ["js/suggestions.js", "js/storage.js", "js/export.js", "js/app.js"]


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return fh.read()


def build():
    html = read("index.html")

    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
    if not body:
        raise SystemExit("index.html has no <body>")
    content = body.group(1)

    # Drop the external <script src> tags; the code gets inlined below.
    content = re.sub(r'\s*<script src="[^"]+"></script>', "", content).strip()

    css = FONT_IMPORT + read("css/styles.css")
    js = "\n\n".join(f"/* ===== {name} ===== */\n{read(name)}" for name in JS_FILES)

    style = f"<style>\n{css}\n</style>"
    script = f"<script>\n{js}\n</script>"

    os.makedirs(SHARE, exist_ok=True)

    standalone = (
        "<!DOCTYPE html>\n"
        '<html lang="en">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        "<title>New Year's Bingo</title>\n"
        '<link rel="icon" href="data:image/svg+xml,'
        "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
        "<text y='.9em' font-size='90'>&#127881;</text></svg>\">\n"
        f"{style}\n"
        f"</head>\n<body>\n{content}\n{script}\n</body>\n</html>\n"
    )
    write(os.path.join(SHARE, "newyear-bingo.html"), standalone)

    fragment = f"<title>New Year's Bingo</title>\n{style}\n{content}\n{script}\n"
    write(os.path.join(SHARE, "artifact.html"), fragment)


def write(path, text):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text)
    print("wrote %s (%.0f KB)" % (path, len(text.encode("utf-8")) / 1024))


if __name__ == "__main__":
    build()
