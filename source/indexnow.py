#!/usr/bin/env python3
"""Tell Bing and Yandex that a page changed, the morning it changes.

Google ignores IndexNow entirely and waits for the sitemap, so this is about Bing,
and through Bing about the assistants that search with it. Run it after a push:

    python3 indexnow.py              what the sitemap says changed today
    python3 indexnow.py --all        every page, for a first submission
    python3 indexnow.py /longhand/x  named pages only
"""
import datetime
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

OUT = pathlib.Path(__file__).resolve().parent.parent
SITE = "https://www.thedrytextco.in"
HOST = "www.thedrytextco.in"
ENDPOINT = "https://api.indexnow.org/indexnow"

# The key lives in the file the build writes to the root; search engines fetch it
# from there to check the submission is really ours.
keys = [f for f in OUT.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}", f.stem)]
if not keys:
    raise SystemExit("no IndexNow key file at the site root: run build.py first")
KEY = keys[0].stem

sitemap = (OUT / "sitemap.xml").read_text(encoding="utf-8")
entries = re.findall(r"<loc>(.*?)</loc>\s*<lastmod>(.*?)</lastmod>", sitemap)

args = [a for a in sys.argv[1:] if a != "--all"]
if args:
    urls = [SITE + a if a.startswith("/") else a for a in args]
elif "--all" in sys.argv:
    urls = [loc for loc, _ in entries]
else:
    today = datetime.date.today().isoformat()
    urls = [loc for loc, mod in entries if mod == today]

if not urls:
    print("nothing changed today, nothing submitted")
    raise SystemExit(0)

payload = json.dumps({
    "host": HOST,
    "key": KEY,
    "keyLocation": "%s/%s.txt" % (SITE, KEY),
    "urlList": urls,
}).encode("utf-8")

request = urllib.request.Request(
    ENDPOINT, data=payload,
    headers={"Content-Type": "application/json; charset=utf-8"})
try:
    with urllib.request.urlopen(request, timeout=30) as reply:
        print("submitted %d url(s), got %s" % (len(urls), reply.status))
except urllib.error.HTTPError as problem:
    # 202 means accepted while they check the key, which is a pass, not a failure.
    note = {400: "the request was malformed", 403: "the key file did not check out",
            422: "a url did not belong to this host", 429: "too many submissions today"}
    if problem.code == 202:
        print("submitted %d url(s), accepted (202, key being checked)" % len(urls))
    else:
        raise SystemExit("IndexNow refused: %s %s" % (problem.code, note.get(problem.code, "")))
except urllib.error.URLError as problem:
    raise SystemExit("could not reach IndexNow: %s" % problem.reason)

for u in urls:
    print("  ", u)
