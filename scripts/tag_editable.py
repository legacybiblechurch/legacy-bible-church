"""Give every editable piece of text on the church site a permanent id.

    python3 scripts/tag_editable.py            # tag all site pages in place
    python3 scripts/tag_editable.py --check    # report only, change nothing

The in-page editor (js/edit-mode.js) saves an edit by finding data-e="<id>" in
the page's source on GitHub and replacing what is inside that element. So the
ids must live in the source, be unique per page, and never change once given.
This script is idempotent: elements that already have data-e keep it, new
elements get the next free number.

What counts as editable mirrors what the editor used to auto-detect: headings,
paragraphs, card text and buttons inside the page body - never the nav, the
footer, forms, scripts, or anything wrapping an image.
"""
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index", "about", "leadership", "connect", "give", "watch", "sermons",
         "resources", "testimonies"]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
SKIP_INSIDE = {"nav", "footer", "form", "script", "style", "head", "svg", "select", "noscript"}
MEDIA = {"img", "svg", "canvas", "video", "audio", "iframe", "input", "textarea", "select"}
# An element is only editable as a whole if everything inside it is plain
# formatting. Anything else (a play button, a span the page's scripts or styles
# rely on) would be flattened by the editor, so we tag the pieces inside instead.
PLAIN = {"a", "strong", "em", "b", "i", "u", "br", "p", "ul", "ol", "li", "h3", "h4", "blockquote", "cite", "sup", "sub"}


class Node:
    __slots__ = ("tag", "attrs", "parent", "children", "pos", "raw", "text")

    def __init__(self, tag, attrs, parent, pos, raw):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children, self.pos, self.raw, self.text = [], pos, raw, ""

    def classes(self):
        return set((self.attrs.get("class") or "").split())

    def ancestors(self):
        n = self.parent
        while n:
            yield n
            n = n.parent

    def descendants(self):
        for c in self.children:
            yield c
            yield from c.descendants()

    def all_text(self):
        return self.text + "".join(c.all_text() for c in self.children)


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [], None, (0, 0), "")
        self.cur = self.root
        self.nodes = []

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur, self.getpos(), self.get_starttag_text())
        self.cur.children.append(n); self.nodes.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        n = Node(tag, attrs, self.cur, self.getpos(), self.get_starttag_text())
        self.cur.children.append(n); self.nodes.append(n)

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.text += data


def wanted(n: Node) -> bool:
    anc = list(n.ancestors())
    anc_tags = {a.tag for a in anc}
    if n.tag in SKIP_INSIDE or anc_tags & SKIP_INSIDE:
        return False
    if any("data-no-edit" in a.attrs for a in [n] + anc):
        return False
    # the site menu is a <ul class="nav__links"> inside a header, not always a <nav>
    chrome = {"nav", "nav__links", "nav__menu", "navbar", "footer", "site-footer", "mobile-menu"}
    if any((a.classes() & chrome) or a.attrs.get("id") in ("navbar", "nav", "footer") for a in [n] + anc):
        return False
    if not n.all_text().strip():
        return False
    if any(d.tag in MEDIA for d in n.descendants()):
        return False
    if any(d.tag not in PLAIN for d in n.descendants()):
        return False
    cls = n.classes()
    anc_cls = set().union(*[a.classes() for a in anc]) if anc else set()
    in_section = "section" in anc_tags or bool({"hero", "page-header"} & anc_cls) or "main" in anc_tags or "article" in anc_tags
    if "data-editable" in n.attrs or "data-e" in n.attrs:
        return True
    if n.tag == "span" and in_section and n.text.strip() and not n.children:
        return True
    if cls & {"prose", "card__body", "sermon-card__date", "sermon-card__desc", "series-card__label", "zelle-email"}:
        return True
    if n.tag in ("h1", "h2", "h3", "h4") and in_section:
        return True
    if n.tag == "p" and (in_section or "blockquote" in anc_tags or "text-muted" in cls):
        return True
    if n.tag in ("cite", "address") and in_section:
        return True
    if n.tag == "li" and in_section and not any(d.tag in ("a", "ul", "ol") for d in n.descendants()):
        return True
    if n.tag in ("a", "button") and cls & {"btn", "inline-link"}:
        return True
    return False


def tag_page(path: Path, check: bool) -> tuple[int, int]:
    src = path.read_text(encoding="utf-8")
    t = Tree(); t.feed(src); t.close()
    page = path.stem
    used = {int(m) for m in re.findall(r'data-e="%s-(\d+)"' % re.escape(page), src)}
    nxt = max(used) + 1 if used else 1

    chosen: list[Node] = []
    marked: set[int] = set()
    for n in t.nodes:                                  # document order: outermost first
        if any(id(a) in marked for a in n.ancestors()):
            continue                                   # never nest editables
        if wanted(n):
            chosen.append(n); marked.add(id(n))

    # line/col -> absolute offset
    starts = [0]
    for line in src.splitlines(keepends=True):
        starts.append(starts[-1] + len(line))
    edits = []
    chosen_ids = {id(n) for n in chosen}
    removals = []
    for n in t.nodes:
        if "data-e" in n.attrs and id(n) not in chosen_ids:
            off = starts[n.pos[0] - 1] + n.pos[1]
            m = re.search(r' data-e="[^"]*"', n.raw)
            removals.append((off + m.start(), off + m.end()))
    for n in chosen:
        if "data-e" in n.attrs:
            continue
        off = starts[n.pos[0] - 1] + n.pos[1]
        assert src[off:off + len(n.raw)] == n.raw, (path.name, n.tag, n.pos)
        # insert right after the tag name
        at = off + 1 + len(n.tag)
        edits.append((at, f' data-e="{page}-{nxt}"')); nxt += 1
    if not check and (edits or removals):
        ops = [(at, at, ins) for at, ins in edits] + [(a, b, "") for a, b in removals]
        for a, b, ins in sorted(ops, reverse=True):
            src = src[:a] + ins + src[b:]
        path.write_text(src, encoding="utf-8")
    return len(chosen), len(edits)


if __name__ == "__main__":
    check = "--check" in sys.argv
    total = new = 0
    for p in PAGES:
        f = ROOT / f"{p}.html"
        if not f.exists():
            continue
        c, e = tag_page(f, check)
        total += c; new += e
        print(f"{p + '.html':18s} editable={c:4d}  newly tagged={e:4d}")
    print(f"\n{total} editable elements, {new} {'would be ' if check else ''}newly tagged")
