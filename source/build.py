#!/usr/bin/env python3
"""Build ../index.html from site.html: one self-contained file with the photos embedded.

Edit site.html (the photos live in images/, client logos in images/clients/, the cold mails in mails.json, the client pieces in work.json), then run:  python3 build.py
"""
import base64
import json
import pathlib
import re

here = pathlib.Path(__file__).resolve().parent
html = (here / "site.html").read_text(encoding="utf-8")


def embed(match):
    path = here / match.group(1)
    mime = "image/png" if path.suffix == ".png" else "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode()
    return f'url("data:{mime};base64,{data}")'


html = re.sub(r"url\((images/[^)]+\.(?:jpg|png))\)", embed, html)
for token, name in (("__MAILS_JSON__", "mails.json"), ("__WORK_JSON__", "work.json")):
    data = json.loads((here / name).read_text(encoding="utf-8"))
    html = html.replace(token, json.dumps(data, ensure_ascii=False).replace("</", "<\\/"))
out = here.parent / "index.html"
out.write_text(html, encoding="utf-8")
print(f"Built {out} ({out.stat().st_size // 1024} KB)")
