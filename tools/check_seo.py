#!/usr/bin/env python3
"""SEO and AI-crawl checks for the static Autonomy Ladder site. Exits non-zero on failure."""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://autonomy-ladder.io"
BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]
BANNED = [re.compile(r"inwood", re.I), re.compile(r"75244"), re.compile(r"750M")]
errors = []


def fail(msg):
    errors.append(msg)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self._in_title = False
        self.meta = {}
        self.canonical = None
        self.ld = []
        self._in_ld = False
        self._buf = ""
        self.imgs = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        elif tag == "script" and a.get("type") == "application/ld+json":
            self._in_ld = True
            self._buf = ""
        elif tag == "img":
            self.imgs.append(a.get("alt"))

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_ld:
            self.ld.append(self._buf)
            self._in_ld = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_ld:
            self._buf += data


def is_gsc_file(path):
    """Search Console HTML-file check. It is not a page."""
    if not re.fullmatch(r"google[0-9a-f]+\.html", path.name):
        return False
    body = path.read_text(encoding="utf-8").strip()
    return body == f"google-site-verification: {path.name}"


def main():
    pages = sorted(
        p for p in ROOT.rglob("*.html")
        if ".git" not in p.parts and "tools" not in p.parts and not is_gsc_file(p)
    )
    titles = {}
    locs = set()
    for f in pages:
        raw = f.read_text(encoding="utf-8")
        p = Page()
        p.feed(raw)
        where = f.relative_to(ROOT).as_posix()
        if not p.title.strip():
            fail(f"{where}: missing title")
        titles.setdefault(p.title.strip(), []).append(where)
        desc = p.meta.get("description", "")
        if not 50 <= len(desc) <= 170:
            fail(f"{where}: meta description length {len(desc)}")
        noindex = "noindex" in p.meta.get("robots", "")
        if not p.canonical or not p.canonical.startswith(ORIGIN):
            fail(f"{where}: canonical {p.canonical!r}")
        elif not noindex:
            locs.add(p.canonical)
        for key in ("og:title", "og:description", "og:url", "og:image", "twitter:card", "twitter:title", "twitter:description", "twitter:image"):
            if not p.meta.get(key):
                fail(f"{where}: missing {key}")
        if p.meta.get("og:image") and not p.meta.get("og:image:alt"):
            fail(f"{where}: missing og:image:alt")
        if p.meta.get("og:url") and p.meta.get("og:url") != p.canonical:
            fail(f"{where}: og:url does not match canonical")
        for alt in p.imgs:
            if not alt:
                fail(f"{where}: img missing alt")
        for blob in p.ld:
            try:
                json.loads(blob)
            except json.JSONDecodeError as e:
                fail(f"{where}: JSON-LD {e}")
        for rx in BANNED:
            if rx.search(raw) and "750M" not in rx.pattern:
                fail(f"{where}: banned pattern {rx.pattern}")

    for title, ws in titles.items():
        if len(ws) > 1:
            fail(f"duplicate title {title!r}: {ws}")

    robots = (ROOT / "robots.txt").read_text()
    for bot in BOTS:
        if not re.search(rf"User-agent: {bot}\nAllow: /\n", robots):
            fail(f"robots.txt does not allow {bot}")
    sm = (ROOT / "sitemap.xml").read_text()
    sm_locs = set(re.findall(r"<loc>(.*?)</loc>", sm))
    if sm_locs != locs:
        fail(f"sitemap mismatch missing {sorted(locs - sm_locs)} extra {sorted(sm_locs - locs)}")
    llms = (ROOT / "llms.txt").read_text()
    full = (ROOT / "llms-full.txt").read_text()
    if not llms.startswith("# ") or not full.startswith("# "):
        fail("llms files must start with an H1")
    if "llms-full.txt" not in llms:
        fail("llms.txt does not link llms-full.txt")
    for url in locs:
        if url not in llms:
            fail(f"llms.txt missing {url}")
        if url not in full:
            fail(f"llms-full.txt missing {url}")
    for rx in BANNED:
        if rx.search(llms) or rx.search(full) or rx.search(robots):
            fail(f"crawl file matches {rx.pattern}")
    pricing = (ROOT / "pricing" / "index.html").read_text()
    if '"@type": "Product"' not in pricing or '"price": "0"' not in pricing:
        fail("pricing page missing the $0 Product offers")
    if re.search(r'"price":\s*"(?!0")', pricing):
        fail("pricing page has a paid Product price")
    if errors:
        print("\n".join(errors))
        return 1
    print(f"all checks passed: {len(pages)} pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
