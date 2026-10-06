/**
 * EVER working paper renderer.
 *
 * Shared by research.html (full list, with search + sort) and every
 * member page (pre-filtered to one author). Both read from the same
 * data/papers.json, generated automatically from the RePEc archive by
 * scripts/build_papers.py — so this file is the only place display
 * logic lives, and data/members.json is the only place author -> page
 * links are maintained.
 */
(function (global) {
  "use strict";

  var EVERPapers = {};

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function normalizeName(name) {
    return String(name).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("Failed to load " + url + " (HTTP " + r.status + ")");
      return r.json();
    });
  }

  function authorsHtml(authors, membersMap) {
    return (authors || [])
      .map(function (name) {
        var entry = membersMap[normalizeName(name)];
        if (entry && entry.url) {
          return (
            '<a class="author-link" href="' +
            escapeHtml(entry.url) +
            '">' +
            escapeHtml(name) +
            "</a>"
          );
        }
        return "<span>" + escapeHtml(name) + "</span>";
      })
      .join(", ");
  }

  function numberLabel(paper) {
    var parts = [];
    if (paper.number !== null && paper.number !== undefined) {
      parts.push("No. " + paper.number);
    }
    if (paper.year) {
      parts.push(String(paper.year));
    }
    return parts.join(" · "); // " · "
  }

  function paperCardHtml(paper, membersMap, idx) {
    var label = numberLabel(paper);
    var pdfBtn = paper.file_url
      ? '<a class="wp-pdf-btn" href="' +
        escapeHtml(paper.file_url) +
        '" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF</a>'
      : "";
    var jel = paper.jel
      ? '<div class="wp-jel">JEL: ' + escapeHtml(paper.jel) + "</div>"
      : "";

    return (
      '<li class="wp-item" data-idx="' +
      idx +
      '">' +
      '<div class="wp-header" onclick="EVERPapers.toggle(this)">' +
      '<div class="wp-meta">' +
      (label ? '<span class="wp-number">' + escapeHtml(label) + "</span>" : "") +
      '<h3 class="wp-title">' +
      escapeHtml(paper.title || "") +
      "</h3>" +
      '<p class="wp-authors">' +
      authorsHtml(paper.authors, membersMap) +
      "</p>" +
      "</div>" +
      '<div class="wp-actions">' +
      pdfBtn +
      '<button class="wp-toggle" aria-label="Toggle abstract">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="6 9 12 15 18 9"></polyline>' +
      "</svg>" +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="wp-abstract-wrap">' +
      '<div class="wp-abstract">' +
      '<span class="wp-abstract-label">Abstract</span>' +
      escapeHtml(paper.abstract || "") +
      jel +
      "</div>" +
      "</div>" +
      "</li>"
    );
  }

  EVERPapers.toggle = function (headerEl) {
    var item = headerEl.closest(".wp-item");
    var alreadyOpen = item.classList.contains("open");
    var list = item.closest(".wp-list");
    if (list) {
      list.querySelectorAll(".wp-item.open").forEach(function (el) {
        if (el !== item) el.classList.remove("open");
      });
    }
    item.classList.toggle("open", !alreadyOpen);
  };

  function render(container, papers, membersMap) {
    if (!papers.length) {
      container.innerHTML = '<p class="wp-empty">No working papers to show.</p>';
      return;
    }
    container.innerHTML = papers
      .map(function (p, i) {
        return paperCardHtml(p, membersMap, i);
      })
      .join("");
  }

  function sortPapers(papers, key, dir) {
    var sorted = papers.slice().sort(function (a, b) {
      var av, bv;
      if (key === "title") {
        av = (a.title || "").toLowerCase();
        bv = (b.title || "").toLowerCase();
      } else if (key === "author") {
        av = ((a.authors && a.authors[0]) || "").toLowerCase();
        bv = ((b.authors && b.authors[0]) || "").toLowerCase();
      } else if (key === "number") {
        av = a.number === null || a.number === undefined ? -Infinity : Number(a.number);
        bv = b.number === null || b.number === undefined ? -Infinity : Number(b.number);
      } else {
        av = Number(a.year) || 0;
        bv = Number(b.year) || 0;
      }
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  function filterPapers(papers, query) {
    if (!query) return papers;
    var q = query.trim().toLowerCase();
    if (!q) return papers;
    return papers.filter(function (p) {
      var inTitle = (p.title || "").toLowerCase().indexOf(q) !== -1;
      var inAuthors = (p.authors || []).some(function (a) {
        return a.toLowerCase().indexOf(q) !== -1;
      });
      return inTitle || inAuthors;
    });
  }

  function buildMembersMap(membersRaw) {
    var map = {};
    Object.keys(membersRaw || {}).forEach(function (name) {
      if (name === "_comment") return;
      map[normalizeName(name)] = membersRaw[name];
    });
    return map;
  }

  /**
   * Full list with search + sort, for research.html.
   * opts: { containerId, controlsId, papersUrl, membersUrl, onCount? }
   */
  EVERPapers.init = function (opts) {
    var container = document.getElementById(opts.containerId);
    var controlsEl = opts.controlsId ? document.getElementById(opts.controlsId) : null;

    Promise.all([
      fetchJSON(opts.papersUrl),
      opts.membersUrl ? fetchJSON(opts.membersUrl).catch(function () { return {}; }) : Promise.resolve({})
    ])
      .then(function (results) {
        var papers = results[0];
        var membersMap = buildMembersMap(results[1]);
        var state = { sortKey: "year", sortDir: "desc", query: "" };

        function apply() {
          var list = filterPapers(papers, state.query);
          list = sortPapers(list, state.sortKey, state.sortDir);
          render(container, list, membersMap);
          if (opts.onCount) opts.onCount(list.length, papers.length);
        }

        if (controlsEl) {
          var sortSelect = controlsEl.querySelector("[data-wp-sort]");
          var searchInput = controlsEl.querySelector("[data-wp-search]");
          if (sortSelect) {
            sortSelect.addEventListener("change", function () {
              var parts = sortSelect.value.split(":");
              state.sortKey = parts[0];
              state.sortDir = parts[1];
              apply();
            });
          }
          if (searchInput) {
            searchInput.addEventListener("input", function () {
              state.query = searchInput.value;
              apply();
            });
          }
        }

        apply();
      })
      .catch(function (err) {
        container.innerHTML =
          '<p class="wp-error">Could not load working papers (' + escapeHtml(err.message) + ").</p>";
        console.error(err);
      });
  };

  /**
   * Pre-filtered list for one author, for member pages.
   * opts: { containerId, authorName, papersUrl, membersUrl? }
   */
  EVERPapers.initMemberList = function (opts) {
    var container = document.getElementById(opts.containerId);
    var targetName = normalizeName(opts.authorName);

    Promise.all([
      fetchJSON(opts.papersUrl),
      opts.membersUrl ? fetchJSON(opts.membersUrl).catch(function () { return {}; }) : Promise.resolve({})
    ])
      .then(function (results) {
        var papers = results[0];
        var membersMap = buildMembersMap(results[1]);
        var mine = papers.filter(function (p) {
          return (p.authors || []).some(function (a) {
            return normalizeName(a) === targetName;
          });
        });

        if (!mine.length) {
          container.innerHTML =
            '<p class="wp-empty">No EVER working papers currently listed for this member.</p>';
          return;
        }

        render(container, sortPapers(mine, "year", "desc"), membersMap);
      })
      .catch(function (err) {
        container.innerHTML = '<p class="wp-error">Could not load working papers.</p>';
        console.error(err);
      });
  };

  global.EVERPapers = EVERPapers;
})(window);
