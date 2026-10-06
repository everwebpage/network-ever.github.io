#!/usr/bin/env python3
"""
build_members.py

Generates data/members.json from data/members.csv, so you only maintain
ONE member list (the CSV your member.html already uses) instead of a
second, hand-duplicated one.

What it does:
  1. Reads each row's first_name/last_name.
  2. Strips academic titles ("Prof.", "Dr.", "h.c.", etc.) from first_name
     to build a MATCH NAME, e.g. "Prof. Dr. Dr. h.c. Uschi" + "Backes-Gellner"
     -> "Uschi Backes-Gellner". This is the dict key, and it must match the
     Author-Name field in your RePEc .rdf files exactly -- that's how
     wp-render.js matches a paper's author to a member.
  3. Separately builds the member-detail URL using the EXACT SAME slug
     algorithm as js/members.js and js/profile.js -- i.e. from the RAW
     name (titles included), lowercased, with runs of non a-z0-9 characters
     collapsed to a single hyphen. This is deliberately NOT the same string
     as the match name in (2): the slug keeps titles, the match name doesn't.

     NOTE: this replicates members.js/profile.js's algorithm exactly,
     including its existing quirk that ö/ü/other non-ASCII letters are
     silently dropped rather than transliterated (so "Zöllner" degrades to
     "z-llner", "Mühlemann" to "m-hlemann"). Those links still work --
     profile.html?id=... resolves correctly -- they just look broken. See
     scripts/fix-unicode-slugs.md for an optional one-line fix to the
     slug algorithm in both members.js and profile.js, which I'm not
     applying automatically since it would change existing profile URLs.
  4. De-duplicates people who appear in more than one CSV section
     (e.g. board members who are also listed under "member").

Usage:
    python3 scripts/build_members.py [--csv data/members.csv] [--out data/members.json]
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

# Must stay "profile.html?id={slug}" to match js/profile.js's routing.
MEMBER_URL_TEMPLATE = "profile.html?id={slug}"

TITLE_TOKENS = {
    "prof", "dr", "hc", "pd", "mag", "lic", "mr", "mrs", "ms",
}


def strip_titles(raw_first_name: str) -> str:
    """Remove leading academic titles from a first_name field, handling
    both 'Prof. Dr. Uschi' and sloppily-spaced 'Dr.Luke' forms. Used for
    the MATCH NAME only (not the slug)."""
    name = re.sub(r"(?i)\b(prof|dr)\.(?=[A-Za-z])", r"\1. ", raw_first_name)
    tokens = name.split()
    i = 0
    while i < len(tokens):
        bare = tokens[i].replace(".", "").lower()
        if bare in TITLE_TOKENS:
            i += 1
        else:
            break
    remaining = tokens[i:] if i < len(tokens) else tokens
    return " ".join(remaining).strip()


def raw_full_name(first_name: str, last_name: str) -> str:
    """Exactly mirrors members.js/profile.js:
    [person.first_name, person.last_name].filter(Boolean).join(" ").trim()
    -- titles included, nothing stripped."""
    parts = [p.strip() for p in (first_name, last_name) if p and p.strip()]
    return " ".join(parts).strip()


def site_slug(full_name_raw: str) -> str:
    """Exactly mirrors members.js/profile.js:
    fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    Deliberately does NOT transliterate ö/ü/etc -- matches the site's
    current (buggy-looking but functional) behavior exactly."""
    s = full_name_raw.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def build(csv_path: Path) -> dict:
    members: dict = {}
    warnings = []

    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            raw_first = (row.get("first_name") or "").strip()
            last = (row.get("last_name") or "").strip()
            if not raw_first or not last:
                continue

            match_name = f"{strip_titles(raw_first)} {last}".strip()
            slug = site_slug(raw_full_name(raw_first, last))
            url = MEMBER_URL_TEMPLATE.format(slug=slug)

            entry = {
                "url": url,
                "slug": slug,
                "affiliation": (row.get("affiliation") or "").strip(),
                "image": (row.get("image") or "").strip(),
                "external_website": (row.get("website") or "").strip(),
            }

            if match_name in members and members[match_name] != entry:
                warnings.append(
                    f"warning: '{match_name}' appears more than once in the CSV "
                    f"with different data -- keeping the first occurrence."
                )
                continue

            members[match_name] = entry

    for w in warnings:
        print(w)

    return members


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=Path("data/members.csv"))
    parser.add_argument("--out", type=Path, default=Path("data/members.json"))
    args = parser.parse_args()

    members = build(args.csv)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(members, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(members)} member(s) to {args.out}")


if __name__ == "__main__":
    main()
