#!/usr/bin/env python3
"""Build the website from source/site.html.

Everything is written in one file, source/site.html. This turns it into the files the
website is actually served from: one page per address, plus the stylesheet, the script,
the photos, robots.txt and sitemap.xml.

Edit source/site.html (photos in images/, client logos in images/clients/, the cold mails
in mails.json, the client pieces in work.json), then run:

    python3 build.py
"""
import datetime
import json
import pathlib
import re
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent
SITE = "https://www.thedrytextco.in"
PHONE = "+917016227880"
EMAIL = "info@thedrytextco.in"
SOCIAL = ["https://www.instagram.com/thedrytextco/", "https://www.linkedin.com/company/the-dry-text-co/"]

# One entry per address. The blurb is what Google shows under the blue link.
PAGES = {
    "home": dict(
        file="index.html", path="/", alt="/gu",
        title="The Dry Text Co. | Content, marketing, advertising, branding and websites from Ahmedabad",
        desc="A content, marketing, advertising, branding and website agency from Ahmedabad, for brands anywhere that would rather be read than skimmed.",
    ),
    "work": dict(
        file="work.html", path="/work", crumb="Work",
        title="Our work | The Dry Text Co., content writers in Ahmedabad",
        desc="LinkedIn posts, outreach mails, a newspaper concept and 27 cold mails: the words we have written for brands, and the ones we wrote to get in the door.",
    ),
    "services": dict(
        file="services.html", path="/services", alt="/gu/services", crumb="Services",
        title="Content writing, advertising, branding and websites | The Dry Text Co.",
        desc="What we write and build: website content, social and marketing, long-form, advertising, strategy and websites. Priced per project, once we understand it.",
    ),
    "about": dict(
        file="about.html", path="/about", alt="/gu/about", crumb="About",
        title="About | The Dry Text Co., a content agency in Ahmedabad",
        desc="Four people in Ahmedabad who write the words brands get judged by, and build the websites those words live on. Meet the team and see how we work.",
    ),
    "contact": dict(
        file="contact.html", path="/contact", alt="/gu/contact", crumb="Hire the pen",
        title="Hire the pen | The Dry Text Co., Ahmedabad",
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
for rel in sorted(set(re.findall(r"url\((images/[^)]+)\)", css))):
    dest = images / pathlib.Path(rel).relative_to("images")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(HERE / rel, dest)

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
for p in EXTRA:
    # the questions are written once, in the page's header, so the page and the search result agree
    faq = "".join("<dt>%s</dt><dd>%s</dd>" % (q, a) for q, a in p.get("faq", []))
    p["markup"] = (p["markup"]
                   .replace("__NOTE_LIST__", note_list or '<li class="nt-soon">The first one is being written.</li>')
                   .replace("__FAQ__", '<dl class="faq">%s</dl>' % faq))

ALL = [dict(PAGES[n], name=n, markup=pages[n], data=(n == "work")) for n in PAGES] + EXTRA


def schema(page):
    """What the page is, in the form search engines read."""
    name, path = page["name"], page["path"]
    org = {
        "@type": "ProfessionalService",
        "@id": SITE + "/#org",
        "name": "The Dry Text Co.",
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
    graph = [org] if name == "home" else [{"@type": "Organization", "@id": SITE + "/#org", "name": "The Dry Text Co."}]
    if name == "home":
        graph.append({"@type": "WebSite", "@id": SITE + "/#site", "url": SITE + "/", "name": "The Dry Text Co.", "publisher": {"@id": SITE + "/#org"}})
    elif path:
        crumbs = [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"}]
        if page.get("parent"):
            parent = next((p for p in ALL if p["path"] == page["parent"]), None)
            if parent:
                crumbs.append({"@type": "ListItem", "position": 2, "name": parent.get("crumb", parent["title"]), "item": SITE + parent["path"]})
        crumbs.append({"@type": "ListItem", "position": len(crumbs) + 1, "name": page.get("crumb", page["title"]), "item": SITE + path})
        graph.append({"@type": "BreadcrumbList", "itemListElement": crumbs})
    if name == "services":
        graph.append({"@type": "ItemList", "name": "What we write and build", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@type": "Service", "name": s, "provider": {"@id": SITE + "/#org"}, "areaServed": "Worldwide"}}
            for i, s in enumerate(["Brand and web copywriting", "Social and marketing content", "Long-form writing and ghostwriting", "Advertising copy", "Content strategy", "Website design and build"])
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
            "inLanguage": "en-IN", "isPartOf": {"@type": "Blog", "@id": SITE + "/notes"},
        })
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":"))


def build_page(page):
    name, path = page["name"], page["path"]
    url = SITE + (path or "/")
    lang = page.get("lang", "en")
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
    ]
    twin = page.get("alt")
    if twin and not page.get("noindex"):
        pair = [("en", twin if lang == "gu" else path), ("gu", path if lang == "gu" else twin)]
        for code, href in pair:
            head.append('<link rel="alternate" hreflang="%s" href="%s%s">' % (code, SITE, href))
        head.append('<link rel="alternate" hreflang="x-default" href="%s%s">' % (SITE, pair[0][1]))
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
    swap = page.get("alt") or ("/" if lang == "gu" else "/gu")
    nav = nav.replace('href="__LANG__"', 'href="%s"' % swap)
    nav = nav.replace('data-lang-label', 'data-lang-label lang="%s"' % ("en" if lang == "gu" else "gu"))
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
        '<html lang="%s">' % ("gu-IN" if lang == "gu" else "en-IN"),
        "<head>",
        "\n".join(head),
        head_scripts,
        '<link rel="icon" href="/favicon.ico" sizes="any">',
        '<link rel="icon" type="image/png" href="/favicon.png" sizes="96x96">',
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<link rel="stylesheet" href="/assets/site.css">',
        prepaint.replace("(function (d) {", "(function (d) {\n  var isHome = %s;" % ("true" if name == "home" else "false"))
                .replace("if (!seen && !r.classList.contains('is-dry'))", "if (isHome && !seen && !r.classList.contains('is-dry'))"),
        '<script type="application/ld+json">%s</script>' % schema(page),
        "</head>",
        "<body>",
        "\n".join(p for p in body if p),
        "</body>",
        "</html>",
        "",
    ])


written = []
for page in ALL:
    out = OUT / page["file"]
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_page(page), encoding="utf-8")
    written.append(page["file"])

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
    % (SITE, p["path"], p.get("updated") or p.get("date") or today, "1.0" if p["name"] == "home" else "0.8")
    for p in listed if p.get("path") and not p.get("noindex"))
(OUT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls,
    encoding="utf-8")
(OUT / "vercel.json").write_text(json.dumps({
    "cleanUrls": True,
    "trailingSlash": False,
    "redirects": [{"source": "/index", "destination": "/", "permanent": True}],
}, indent=2) + "\n", encoding="utf-8")

print("Built %d pages:" % len(ALL), ", ".join(p["file"] for p in ALL))
if QUEUED:
    print("Waiting for its day:", ", ".join("%s (%s)" % (p["path"], p["date"]) for p in QUEUED))
print("Shared: assets/site.css %d KB, assets/site.js %d KB, %d images" % (
    (assets / "site.css").stat().st_size // 1024,
    (assets / "site.js").stat().st_size // 1024,
    len(list(images.rglob("*.*")))))
