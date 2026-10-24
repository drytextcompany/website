#!/usr/bin/env python3
"""Build the website from source/site.html.

Everything is written in one file, source/site.html. This turns it into the files the
website is actually served from: one page per address, plus the stylesheet, the script,
the photos, robots.txt and sitemap.xml.

Edit source/site.html (photos in images/, client logos in images/clients/, the cold mails
in mails.json, the client pieces in work.json), then run:

    python3 build.py
"""
import collections
import datetime
import email.utils
import hashlib
import json
import math
import pathlib
import re
import shutil
import sys
from xml.sax.saxutils import escape as xml_escape

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent
SITE = "https://www.thedrytextco.in"
PHONE = "+917016227880"
EMAIL = "info@thedrytextco.in"
INDEXNOW_KEY = "81f14d291de60be2ba8a3df8c97460fb"
SOCIAL = ["https://www.instagram.com/thedrytextco/", "https://www.linkedin.com/company/the-dry-text-co/"]

# One entry per address. The blurb is what Google shows under the blue link.
PAGES = {
    "home": dict(
        file="index.html", path="/",
        title="The Dry Text Co. | Content, marketing, advertising, branding and websites from Ahmedabad",
        desc="Content, marketing, advertising, branding and websites, from Ahmedabad. We build shopfronts: the words on them, the sites behind them, the tools that run them.",
    ),
    "work": dict(
        file="work.html", path="/work", crumb="Work",
        title="Our work | The Dry Text Co., content writers in Ahmedabad",
        desc="LinkedIn posts, outreach mails, a newspaper concept and 27 cold mails: the words we have written for brands, and the ones we wrote to get in the door.",
    ),
    "services": dict(
        file="services.html", path="/services", crumb="Services",
        title="Services | Content writing, advertising, branding and websites | The Dry Text Co.",
        desc="What we make: content writing, marketing, advertising, branding, websites, strategy and outreach. Priced per project, once we understand it.",
    ),
    "about": dict(
        file="about.html", path="/about", crumb="About",
        title="About | The Dry Text Co., a content agency in Ahmedabad",
        desc="Four people in Ahmedabad who write the words brands get judged by, and build the websites those words live on. Meet the team and see how we work.",
    ),
    "contact": dict(
        file="contact.html", path="/contact", crumb="Hire the pen",
        title="Contact | Hire the pen | The Dry Text Co., Ahmedabad",
        desc="Tell us what you need in one line and we will reply. Content, advertising, branding and websites, from Ahmedabad for brands anywhere. WhatsApp or email us.",
    ),
    "missing": dict(file="404.html", path=None, title="Page not found | The Dry Text Co.", desc="That address does not exist.", noindex=True),
}
ORDER = ["home", "work", "services", "about", "contact"]

src = (HERE / "site.html").read_text(encoding="utf-8")


def cut(pattern, flags=re.S):
    m = re.search(pattern, src, flags)
    if not m:
        raise SystemExit("build.py: could not find " + pattern[:40])
    return m.group(1)


# --- take the file apart -------------------------------------------------------------
head_scripts = cut(r"(<!-- Google tag.*?display=swap\">)")
prepaint = cut(r"(<script>\n\(function \(d\).*?</script>)")
css = cut(r"<style>(.*?)</style>")
js = cut(r"<script>\n(\(\(\) => \{.*?\n\}\)\(\);)\n</script>")
intro = cut(r"(<div id=\"intro\">.*?</button>\s*</div>)")  # ends at the skip button, not the first nested div
header = cut(r"(<header class=\"top\">.*?</header>)")
footer = cut(r"(<footer class=\"foot\">.*?</footer>)")
after_footer = cut(r"</footer>\s*(<div class=\"toast\".*?)<script type=\"application/json\"")

pages = {name: block for name, block in re.findall(r"(?ms)^<div class=\"page\" data-page=\"(\w+)\"[^>]*>\n(.*?)^</div>$", src)}
missing = [n for n in PAGES if n not in pages]
if missing:
    raise SystemExit("build.py: no markup for " + ", ".join(missing))

# The form lives on the home page; the contact page gets its own copy of it.
form = cut(r"<div data-slot=\"form\" style=\"margin-top:22px\">\s*(<form class=\"pen-zone\".*?</form>)")
pages["contact"] = pages["contact"].replace('<div data-slot="form"></div>', form)

# --- the shared files ----------------------------------------------------------------
assets = OUT / "assets"
assets.mkdir(exist_ok=True)
(assets / "site.css").write_text(css.replace("url(images/", "url(/images/").strip() + "\n", encoding="utf-8")
(assets / "site.js").write_text(js + "\n", encoding="utf-8")

images = OUT / "images"
if images.exists():
    shutil.rmtree(images)
# Every image the stylesheet asks for, plus every one the markup does. Miss the
# second set and a page ships with a broken picture, because this folder is rebuilt
# from scratch each time.
picture_refs = set(re.findall(r"url\((images/[^)]+)\)", css))
for markup in [(HERE / "site.html").read_text(encoding="utf-8")] + [
        f.read_text(encoding="utf-8") for f in sorted((HERE / "pages").glob("*.html"))]:
    picture_refs |= {m.lstrip("/") for m in re.findall(r'src="(/?images/[^"]+)"', markup)}
for rel in sorted(picture_refs):
    source_file = HERE / rel
    if not source_file.exists():
        raise SystemExit("missing image: source/%s" % rel)
    dest = images / pathlib.Path(rel).relative_to("images")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_file, dest)

data_blocks = ""
for token, name, block_id in (("__MAILS_JSON__", "mails.json", "mailData"), ("__WORK_JSON__", "work.json", "workData")):
    payload = json.dumps(json.loads((HERE / name).read_text(encoding="utf-8")), ensure_ascii=False).replace("</", "<\\/")
    data_blocks += '<script type="application/json" id="%s">%s</script>\n' % (block_id, payload)


# --- the extra pages: services, notes, case studies. One file each in source/pages/ ------
# A piece with a date in the future is written but not published yet: the build leaves it
# out until its day arrives. Run "python3 build.py --all" to see the queue on a preview.
SHOW_ALL = "--all" in sys.argv
TODAY = datetime.date.today().isoformat()

EXTRA, QUEUED = [], []
for f in sorted((HERE / "pages").glob("*.html")):
    raw = f.read_text(encoding="utf-8")
    meta_raw, _, markup = raw.partition("-->")
    meta = json.loads(meta_raw.replace("<!--", "", 1).strip())
    meta["markup"] = markup.strip()
    meta["name"] = meta["path"].strip("/").replace("/", "-")
    meta["file"] = meta["path"].lstrip("/") + ".html"
    if meta.get("date", "") > TODAY and not SHOW_ALL:
        QUEUED.append(meta)
        continue
    EXTRA.append(meta)

notes = sorted([p for p in EXTRA if p.get("kind") == "note"], key=lambda p: p["date"], reverse=True)
note_list = "\n".join(
    '<li><a href="%s"><span class="nt-d">%s</span><span class="nt-t">%s</span><span class="nt-b">%s</span></a></li>'
    % (n["path"], datetime.date.fromisoformat(n["date"]).strftime("%d %b %Y"), n["title_short"], n["blurb"])
    for n in notes)


# --- what to read next --------------------------------------------------------------
# A piece reachable only from the index tends to sit unindexed for months, so every one
# links to four others, and the second pass makes sure every one is linked to four times.
WANT, CEILING = 4, 6
STOP = set("""a an and are as at be but by can for from has have how in into is it its not of on or
             should that the their them these they this to want was what when which why will with
             you your our ours we do does doesnt dont one two""".split())


def topic_words(note):
    text = " ".join([note["title_short"], note.get("blurb", ""), note.get("crumb", "")]).lower()
    return {w for w in re.findall(r"[a-z]{3,}", text) if w not in STOP}


def pick_related(notes):
    """Four neighbours each, chosen by what the pieces are actually about."""
    bag = {n["path"]: topic_words(n) for n in notes}
    recent = {n["path"]: i for i, n in enumerate(notes)}          # notes arrive newest first

    # A word shared by half the pieces ("page", "write", "india") says almost nothing
    # about whether two of them belong together. A rare one says a great deal.
    seen = collections.Counter(w for words in bag.values() for w in words)
    weight = {w: 1.0 / (1 + math.log(n)) for w, n in seen.items()}

    def nearness(mine, other):
        shared = mine & bag[other["path"]]
        return (-round(sum(weight[w] for w in shared), 4), recent[other["path"]])

    related = {n["path"]: [o["path"] for o in sorted(
        (o for o in notes if o["path"] != n["path"]), key=lambda o: nearness(bag[n["path"]], o))[:WANT]]
        for n in notes}

    # Whoever is still short of four ways in gets added to their nearest neighbours, as
    # long as that neighbour is not already carrying a wall of links.
    inbound = collections.Counter(p for picks in related.values() for p in picks)
    for n in sorted(notes, key=lambda n: inbound[n["path"]]):
        hosts = sorted((o for o in notes
                        if o["path"] != n["path"]
                        and n["path"] not in related[o["path"]]
                        and len(related[o["path"]]) < CEILING),
                       key=lambda o: nearness(bag[n["path"]], o))
        while inbound[n["path"]] < WANT and hosts:
            related[hosts.pop(0)["path"]].append(n["path"])
            inbound[n["path"]] += 1
    return related


BY_PATH = {n["path"]: n for n in notes}
RELATED = pick_related(notes) if len(notes) > 1 else {}


def read_next(path):
    picks = [BY_PATH[p] for p in RELATED.get(path, [])]
    if not picks:
        return ""
    items = "".join(
        '<li><a href="%s"><span class="nx-t">%s</span><span class="nx-b">%s</span></a></li>'
        % (p["path"], p["title_short"], p["blurb"]) for p in picks)
    return ('<section class="sec nx" aria-labelledby="nx-h">'
            '<div class="row sec-head"><div><p class="eyebrow">Read next</p>'
            '<h2 class="h2" id="nx-h">More Longhand.</h2></div></div>'
            '<div class="row"><ul class="nx-list">%s</ul></div></section>') % items
for p in EXTRA:
    # the questions are written once, in the page's header, so the page and the search result agree
    faq = "".join("<dt>%s</dt><dd>%s</dd>" % (q, a) for q, a in p.get("faq", []))
    p["markup"] = (p["markup"]
                   .replace("__NOTE_LIST__", note_list or '<li class="nt-soon">The first one is being written.</li>')
                   .replace("__FAQ__", '<dl class="faq">%s</dl>' % faq))
    if p.get("kind") == "note":
        close = p["markup"].rfind("</div>")
        p["markup"] = p["markup"][:close] + read_next(p["path"]) + p["markup"][close:]

ALL = [dict(PAGES[n], name=n, markup=pages[n], data=(n == "work")) for n in PAGES] + EXTRA


# The ways people type our name into a search box
ALT_NAMES = ["Dry Text Co.", "The Dry Text Company", "Dry Text", "DryText", "thedrytextco"]


PREPAINT_OPEN = "(function (d) {"
PREPAINT_INTRO = "if (!seen && !r.classList.contains('is-dry'))"


def patch_prepaint(is_home):
    """Tell the prepaint which page it is on, so only Home ever plays the intro."""
    for literal in (PREPAINT_OPEN, PREPAINT_INTRO):
        if prepaint.count(literal) != 1:
            raise SystemExit("prepaint no longer contains %r exactly once; update build.py with it" % literal)
    return (prepaint.replace(PREPAINT_OPEN, PREPAINT_OPEN + "\n  var isHome = %s;" % ("true" if is_home else "false"))
            .replace(PREPAINT_INTRO, "if (isHome && " + PREPAINT_INTRO[4:]))


def schema(page):
    """What the page is, in the form search engines read."""
    name, path = page["name"], page["path"]
    org = {
        "@type": "ProfessionalService",
        "@id": SITE + "/#org",
        "name": "The Dry Text Co.",
        "alternateName": ALT_NAMES,
        "url": SITE + "/",
        "image": SITE + "/og-image.png",
        "logo": SITE + "/og-image.png",
        "description": PAGES["home"]["desc"],
        "telephone": PHONE,
        "email": EMAIL,
        "priceRange": "Per project",
        "address": {"@type": "PostalAddress", "addressLocality": "Ahmedabad", "addressRegion": "Gujarat", "addressCountry": "IN"},
        "areaServed": [{"@type": "City", "name": "Ahmedabad"}, {"@type": "Country", "name": "India"}, "Worldwide"],
        "founder": {"@type": "Person", "name": "Granth Hirapara", "jobTitle": "Founder and CEO"},
        "knowsLanguage": ["en", "gu", "hi"],
        "sameAs": SOCIAL,
    }
    graph = [org] if name == "home" else [{"@type": "Organization", "@id": SITE + "/#org", "name": "The Dry Text Co.", "alternateName": ALT_NAMES}]
    if name == "home":
        graph.append({"@type": "WebSite", "@id": SITE + "/#site", "url": SITE + "/", "name": "The Dry Text Co.", "alternateName": ALT_NAMES, "publisher": {"@id": SITE + "/#org"}})
    elif path:
        crumbs = [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"}]
        if page.get("parent"):
            parent = next((p for p in ALL if p["path"] == page["parent"]), None)
            if parent:
                crumbs.append({"@type": "ListItem", "position": 2, "name": parent.get("crumb", parent["title"]), "item": SITE + parent["path"]})
        crumbs.append({"@type": "ListItem", "position": len(crumbs) + 1, "name": page.get("crumb", page["title"]), "item": SITE + path})
        graph.append({"@type": "BreadcrumbList", "itemListElement": crumbs})
    if name == "services":
        graph.append({"@type": "ItemList", "name": "What we make", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@type": "Service", "name": s, "provider": {"@id": SITE + "/#org"}, "areaServed": "Worldwide"}}
            for i, s in enumerate(["Content writing", "Marketing", "Advertising", "Branding", "Website design and build", "Strategy", "Outreach"])
        ]})
    if name == "contact":
        graph.append({"@type": "ContactPage", "url": SITE + "/contact", "about": {"@id": SITE + "/#org"}})
    if page.get("kind") == "service":
        graph.append({
            "@type": "Service", "name": page["service"], "serviceType": page["service"],
            "provider": {"@id": SITE + "/#org"}, "url": SITE + path,
            "areaServed": [{"@type": "City", "name": "Ahmedabad"}, {"@type": "Country", "name": "India"}, "Worldwide"],
            "offers": {"@type": "Offer", "priceCurrency": "INR", "price": str(page["from"]),
                       "description": "Priced per project. From INR %s." % page["from"]},
        })
    if page.get("faq"):
        graph.append({"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in page["faq"]]})
    if page.get("kind") == "case":
        graph.append({
            "@type": "Article", "headline": page["title_short"], "description": page["desc"],
            "url": SITE + path, "datePublished": page["date"], "dateModified": page.get("updated", page["date"]),
            "author": {"@type": "Person", "name": page.get("author", "Granth Hirapara")},
            "publisher": {"@id": SITE + "/#org"}, "image": SITE + "/og-image.png", "inLanguage": "en-IN",
            "about": {"@type": "Organization", "name": page["client"]},
        })
    if page.get("kind") == "note":
        graph.append({
            "@type": "BlogPosting", "headline": page["title_short"], "description": page["desc"],
            "url": SITE + path, "datePublished": page["date"], "dateModified": page.get("updated", page["date"]),
            "author": {"@type": "Person", "name": page.get("author", "Granth Hirapara")},
            "publisher": {"@id": SITE + "/#org"}, "image": SITE + "/og-image.png",
            "inLanguage": "en-IN", "isPartOf": {"@type": "Blog", "@id": SITE + "/longhand", "url": SITE + "/longhand", "name": "Longhand"},
        })
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":"))


def build_page(page):
    name, path = page["name"], page["path"]
    url = SITE + (path or "/")
    nav = header
    top = page.get("parent") or path
    if top and top != "/":
        nav = nav.replace('href="%s"' % top, 'href="%s" aria-current="page"' % top, 1)
    head = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<title>%s</title>" % page["title"],
        '<meta name="description" content="%s">' % page["desc"],
        '<meta name="theme-color" content="#FBFBF9">',
        '<link rel="alternate" type="application/rss+xml" title="Longhand | The Dry Text Co." href="/feed.xml">',
    ]
    if page.get("noindex"):
        head.append('<meta name="robots" content="noindex">')
    else:
        head += [
            '<link rel="canonical" href="%s">' % url,
            '<meta property="og:type" content="%s">' % ("article" if page.get("kind") == "note" else "website"),
            '<meta property="og:url" content="%s">' % url,
            '<meta property="og:site_name" content="The Dry Text Co.">',
            '<meta property="og:title" content="%s">' % page["title"],
            '<meta property="og:description" content="%s">' % page["desc"],
            '<meta property="og:image" content="%s/og-image.png">' % SITE,
            '<meta name="twitter:card" content="summary_large_image">',
        ]
    body = [
        '<a class="skip" href="#main">Skip to content</a>',
        intro if name == "home" else "",
        nav,
        '<main id="main">',
        '<div class="page" data-page="%s">' % name,
        page["markup"],
        "</div>",
        "</main>",
        footer,
        after_footer.strip(),
        data_blocks if page.get("data") else "",
        '<script src="/assets/site.js" defer></script>',
    ]
    return "\n".join([
        "<!doctype html>",
        '<html lang="en-IN">',
        "<head>",
        "\n".join(head),
        head_scripts,
        '<link rel="icon" href="/favicon.ico" sizes="any">',
        '<link rel="icon" type="image/png" href="/favicon.png" sizes="96x96">',
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="stylesheet" href="/assets/site.css">',
        patch_prepaint(name == "home"),
        '<script type="application/ld+json">%s</script>' % schema(page),
        "</head>",
        "<body>",
        "\n".join(p for p in body if p),
        "</body>",
        "</html>",
        "",
    ])


# A page's lastmod should mean "this changed", not "the build ran". Stamping every page
# with today each time teaches search engines to ignore the dates, so each page keeps the
# day its own contents last moved.
STAMPS = OUT / ".lastmod.json"
stamps = json.loads(STAMPS.read_text(encoding="utf-8")) if STAMPS.exists() else {}
fresh = {}

written = []
for page in ALL:
    out = OUT / page["file"]
    out.parent.mkdir(parents=True, exist_ok=True)
    html = build_page(page)
    out.write_text(html, encoding="utf-8")
    written.append(page["file"])
    digest = hashlib.sha1(html.encode("utf-8")).hexdigest()
    was = stamps.get(page["path"] or "/")
    fresh[page["path"] or "/"] = {
        "hash": digest,
        "date": was["date"] if was and was["hash"] == digest else datetime.date.today().isoformat(),
    }
if not SHOW_ALL:
    STAMPS.write_text(json.dumps(fresh, indent=1, sort_keys=True), encoding="utf-8")

# Anything this build made last time but not this time is taken down: a piece whose day
# has not come yet, or a page that was renamed.
manifest = OUT / ".pages.json"
if manifest.exists() and not SHOW_ALL:
    for old_file in json.loads(manifest.read_text(encoding="utf-8")):
        if old_file not in written:
            stale = OUT / old_file
            if stale.exists():
                stale.unlink()
                print("took down", old_file)
            if stale.parent != OUT and not any(stale.parent.iterdir()):
                stale.parent.rmdir()
if not SHOW_ALL:
    manifest.write_text(json.dumps(sorted(written), indent=1), encoding="utf-8")

# --- the files that tell search engines what exists ------------------------------------
(OUT / "robots.txt").write_text("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE, encoding="utf-8")
today = datetime.date.today().isoformat()
listed = [dict(PAGES[n], name=n) for n in ORDER] + EXTRA
urls = "".join(
    "  <url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n"
    % (SITE, p["path"], fresh.get(p["path"] or "/", {}).get("date", today), "1.0" if p["name"] == "home" else "0.8")
    for p in listed if p.get("path") and not p.get("noindex"))
(OUT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls,
    encoding="utf-8")
# The feed, so a new piece can be found the morning it goes up rather than whenever a
# crawler next wanders past the index.
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


def published(day):
    """Nine in the morning, Ahmedabad, which is when the day's piece goes out."""
    return email.utils.format_datetime(
        datetime.datetime.fromisoformat(day).replace(hour=9, minute=4, tzinfo=IST))


ITEM = """  <item>
    <title>%s</title>
    <link>%s%s</link>
    <guid isPermaLink="true">%s%s</guid>
    <description>%s</description>
    <pubDate>%s</pubDate>
  </item>
"""
CHANNEL = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Longhand | The Dry Text Co.</title>
  <link>%s/longhand</link>
  <atom:link href="%s/feed.xml" rel="self" type="application/rss+xml"/>
  <description>Writing about writing, from a content agency in Ahmedabad. A new piece most mornings.</description>
  <language>en-IN</language>
  <lastBuildDate>%s</lastBuildDate>
%s</channel>
</rss>
"""
feed_items = "".join(
    ITEM % (xml_escape(n["title_short"]), SITE, n["path"], SITE, n["path"],
            xml_escape(n.get("blurb") or n["desc"]), published(n["date"]))
    for n in notes[:25])
(OUT / "feed.xml").write_text(
    CHANNEL % (SITE, SITE, published(notes[0]["date"]) if notes else published(today), feed_items),
    encoding="utf-8")

# IndexNow proves the site is ours by serving the key back at the root. Bing and Yandex
# read it; Google ignores the whole protocol and waits for the sitemap instead.
(OUT / (INDEXNOW_KEY + ".txt")).write_text(INDEXNOW_KEY + "\n", encoding="utf-8")

(OUT / "vercel.json").write_text(json.dumps({
    "cleanUrls": True,
    "trailingSlash": False,
    "redirects": [{"source": "/index", "destination": "/", "permanent": True}],
}, indent=2) + "\n", encoding="utf-8")

print("Built %d pages:" % len(ALL), ", ".join(p["file"] for p in ALL))
if QUEUED:
    print("Waiting for its day:", ", ".join("%s (%s)" % (p["path"], p["date"]) for p in QUEUED))
print("Feed: %d pieces in feed.xml" % len(notes[:25]))
print("Shared: assets/site.css %d KB, assets/site.js %d KB, %d images" % (
    (assets / "site.css").stat().st_size // 1024,
    (assets / "site.js").stat().st_size // 1024,
    len(list(images.rglob("*.*")))))
