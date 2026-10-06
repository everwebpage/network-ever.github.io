#!/usr/bin/env python3
"""
build_papers.py

Walks a RePEc archive directory tree, parses every ReDIF-Paper template
file (.rdf) it finds, and writes the result to data/papers.json.

This script is the automation bridge between your RePEc archive (which
you must maintain anyway, correctly formatted, for RePEc itself) and
your website's working paper listing. Run it manually, or let the
GitHub Action in .github/workflows/build-papers.yml run it for you on
every push that touches the RePEc/ folder.

Usage:
    python3 scripts/build_papers.py [--repec-dir RePEc] [--out data/papers.json]

No third-party dependencies required (standard library only).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

# A new ReDIF field line looks like "Key-Name: value" or "Key-Name:value".
# Keys are letters, digits and hyphens, starting with a letter.
FIELD_RE = re.compile(r"^([A-Za-z][A-Za-z0-9-]*):\s?(.*)$")


def parse_redif_records(text: str) -> List[Dict[str, List[str]]]:
    """
    Parse raw ReDIF text into a list of records. Each record is a dict
    mapping field name -> list of values (fields can repeat, e.g.
    Author-Name). A new record starts whenever a Template-Type line is
    seen after at least one field has already been collected.
    """
    records: List[Dict[str, List[str]]] = []
    current: Dict[str, List[str]] = {}
    current_key: Optional[str] = None

    def flush():
        nonlocal current, current_key
        if current:
            records.append(current)
        current = {}
        current_key = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip("\n")
        if not line.strip():
            # Blank lines are separators between some fields but NOT
            # reliably between records in real-world .rdf files, so we
            # don't flush here -- only a new Template-Type flushes.
            continue

        m = FIELD_RE.match(line)
        if m:
            key, value = m.group(1), m.group(2).strip()
            if key.lower() == "template-type" and current:
                flush()
            current.setdefault(key, []).append(value)
            current_key = key
        else:
            # Continuation of the previous field's value (common for
            # long Abstract fields wrapped across lines).
            if current_key:
                current[current_key][-1] = (
                    current[current_key][-1] + " " + line.strip()
                ).strip()

    flush()
    return records


def first(record: Dict[str, List[str]], *keys: str) -> Optional[str]:
    for key in keys:
        for k, v in record.items():
            if k.lower() == key.lower() and v:
                return v[0]
    return None


def all_values(record: Dict[str, List[str]], key: str) -> List[str]:
    for k, v in record.items():
        if k.lower() == key.lower():
            return v
    return []


def extract_year(record: Dict[str, List[str]]) -> Optional[int]:
    date_str = first(record, "Creation-Date", "Revision-Date")
    if date_str:
        m = re.search(r"(\d{4})", date_str)
        if m:
            return int(m.group(1))
    handle = first(record, "Handle")
    if handle:
        m = re.search(r"(\d{4})", handle)
        if m:
            return int(m.group(1))
    return None


def extract_number(record: Dict[str, List[str]]) -> Optional[int]:
    num = first(record, "Number")
    if num is not None:
        m = re.search(r"-?\d+", num)
        if m:
            return int(m.group(0))
    handle = first(record, "Handle")
    if handle:
        tail = handle.rstrip(":").split(":")[-1]
        m = re.search(r"-?\d+$", tail)
        if m:
            return int(m.group(0))
    return None


def extract_file_url(record: Dict[str, List[str]]) -> Optional[str]:
    urls = all_values(record, "File-URL")
    formats = all_values(record, "File-Format")
    if not urls:
        return None
    # Prefer an entry whose File-Format mentions PDF, else take the first.
    for url, fmt in zip(urls, formats):
        if fmt and "pdf" in fmt.lower():
            return url
    return urls[0]


def record_to_paper(record: Dict[str, List[str]], source_path: Path) -> Optional[dict]:
    template_type = first(record, "Template-Type") or ""
    if "redif-paper" not in template_type.lower():
        return None

    title = first(record, "Title")
    if not title:
        return None  # malformed record, skip rather than crash the build

    authors = all_values(record, "Author-Name")
    abstract = first(record, "Abstract") or ""
    jel_raw = first(record, "Classification-JEL") or ""
    jel = ", ".join(part.strip() for part in jel_raw.split(";") if part.strip())

    return {
        "handle": first(record, "Handle"),
        "number": extract_number(record),
        "year": extract_year(record),
        "title": title.strip(),
        "authors": [a.strip() for a in authors if a.strip()],
        "abstract": abstract.strip(),
        "jel": jel,
        "file_url": extract_file_url(record),
        "source_file": str(source_path),
    }


def build(repec_dir: Path) -> List[dict]:
    papers: List[dict] = []
    if not repec_dir.is_dir():
        print(f"warning: {repec_dir} does not exist, writing empty paper list", file=sys.stderr)
        return papers

    for rdf_file in sorted(repec_dir.rglob("*.rdf")):
        try:
            text = rdf_file.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = rdf_file.read_text(encoding="latin-1")

        for record in parse_redif_records(text):
            paper = record_to_paper(record, rdf_file.relative_to(repec_dir.parent))
            if paper:
                papers.append(paper)

    # Sensible default ordering: newest year first, then highest number
    # first. The frontend can still re-sort on top of this.
    def sort_key(p: dict):
        return (-(p["year"] or 0), -(p["number"] if p["number"] is not None else -10**9))

    papers.sort(key=sort_key)
    return papers


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repec-dir",
        type=Path,
        default=Path("RePEc"),
        help="Path to the RePEc archive root (default: RePEc)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/papers.json"),
        help="Where to write the generated JSON (default: data/papers.json)",
    )
    args = parser.parse_args()

    papers = build(args.repec_dir)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(papers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(papers)} paper(s) to {args.out}")


if __name__ == "__main__":
    main()
