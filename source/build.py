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

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent
SITE = "https://www.thedrytextco.in"
PHONE = "+917016227880"
EMAIL = "info@thedrytextco.in"
SOCIAL = ["https://www.instagram.com/thedrytextco/", "https://www.linkedin.com/company/the-dry-text-co/"]

# One entry per address. The blurb is what Google shows under the blue link.
PAGES = {
    "home": dict(
        file="index.html", path="/",
        title="The Dry Text Co. | Content, marketing, advertising, branding and websites from Ahmedabad",
        desc="A content, marketing, advertising, branding and website agency from Ahmedabad, for brands anywhere that would rather be read than skimmed.",
    ),
    "work": dict(
        file="work.html", path="/work", crumb="Work",
        title="Our work | The Dry Text Co., content writers in Ahmedabad",
        desc="LinkedIn posts, outreach mails, a newspaper concept and 27 cold mails: the words we have written for brands, and the ones we wrote to get in the door.",
    ),
    "services": dict(
        file="services.html", path="/services", crumb="Services",
        title="Content writing, advertising, branding and websites | The Dry Text Co.",
        desc="What we write and build: website content, social and marketing, long-form, advertising, strategy and websites. Priced per project, once we understand it.",
    ),
    "about": dict(
        file="about.html", path="/about", crumb="About",
        title="About | The Dry Text Co., a content agency in Ahmedabad",
        desc="Four people in Ahmedabad who write the words brands get judged by, and build the websites those words live on. Meet the team and see how we work.",
    ),
    "contact": dict(
        file="contact.html", path="/contact", crumb="Hire the pen",
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
head_scripts = cut(r"(<!-- Google tag.*?</script>\s*<link rel=\"icon\".*?display=swap\">)")
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


def schema(name, page):
    """What the page is, in the form search engines read."""
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
    elif page["path"]:
        graph.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": page.get("crumb", page["title"]), "item": SITE + page["path"]},
        ]})
    if name == "services":
        graph.append({"@type": "ItemList", "name": "What we write and build", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@type": "Service", "name": s, "provider": {"@id": SITE + "/#org"}, "areaServed": "Worldwide"}}
            for i, s in enumerate(["Brand and web copywriting", "Social and marketing content", "Long-form writing and ghostwriting", "Advertising copy", "Content strategy", "Website design and build"])
        ]})
    if name == "contact":
        graph.append({"@type": "ContactPage", "url": SITE + "/contact", "about": {"@id": SITE + "/#org"}})
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False, separators=(",", ":"))


def build_page(name, page):
    url = SITE + (page["path"] or "/")
    nav = header
    if page["path"] and page["path"] != "/":
        nav = nav.replace('href="%s"' % page["path"], 'href="%s" aria-current="page"' % page["path"], 1)
    head = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<title>%s</title>" % page["title"],
        '<meta name="description" content="%s">' % page["desc"],
        '<meta name="theme-color" content="#FBFBF9">',
    ]
    if page.get("noindex"):
        head.append('<meta name="robots" content="noindex">')
    else:
        head += [
            '<link rel="canonical" href="%s">' % url,
            '<meta property="og:type" content="website">',
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
        pages[name],
        "</div>",
        "</main>",
        footer,
        after_footer.strip(),
        data_blocks if name == "work" else "",
        '<script src="/assets/site.js" defer></script>',
    ]
    return "\n".join([
        "<!doctype html>",
        '<html lang="en-IN">',
        "<head>",
        "\n".join(head),
        head_scripts,
        '<link rel="stylesheet" href="/assets/site.css">',
        prepaint.replace("(function (d) {", "(function (d) {\n  var isHome = %s;" % ("true" if name == "home" else "false"))
                .replace("if (!seen && !r.classList.contains('is-dry'))", "if (isHome && !seen && !r.classList.contains('is-dry'))"),
        '<script type="application/ld+json">%s</script>' % schema(name, page),
        "</head>",
        "<body>",
        "\n".join(p for p in body if p),
        "</body>",
        "</html>",
        "",
    ])


for name, page in PAGES.items():
    (OUT / page["file"]).write_text(build_page(name, page), encoding="utf-8")

# --- the files that tell search engines what exists ------------------------------------
(OUT / "robots.txt").write_text("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE, encoding="utf-8")
today = datetime.date.today().isoformat()
urls = "".join(
    "  <url><loc>%s%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n"
    % (SITE, PAGES[n]["path"] if PAGES[n]["path"] != "/" else "/", today, "1.0" if n == "home" else "0.8")
    for n in ORDER)
(OUT / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % urls,
    encoding="utf-8")
(OUT / "vercel.json").write_text(json.dumps({
    "cleanUrls": True,
    "trailingSlash": False,
    "redirects": [{"source": "/index", "destination": "/", "permanent": True}],
}, indent=2) + "\n", encoding="utf-8")

sizes = ", ".join("%s %d KB" % (PAGES[n]["file"], (OUT / PAGES[n]["file"]).stat().st_size // 1024) for n in ORDER)
print("Built:", sizes)
print("Shared: assets/site.css %d KB, assets/site.js %d KB, %d images" % (
    (assets / "site.css").stat().st_size // 1024,
    (assets / "site.js").stat().st_size // 1024,
    len(list(images.rglob("*.*")))))
