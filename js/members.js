document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const CSV_FILE = "data/members.csv";
    const PLACEHOLDER_IMAGE = "img/member/placeholder.png";

    const sectionConfig = {
        board: {
            containerId: "board-members",
            imageFolder: "board",
            defaultTitle: "Board",
            sortMode: "order"
        },
        administration: {
            containerId: "administration-members",
            imageFolder: "admin",
            defaultTitle: "Administration",
            sortMode: "order"
        },
        member: {
            containerId: "network-members",
            imageFolder: "members",
            defaultTitle: "Member",
            sortMode: "year"
        }
    };

    function normalizeSection(value) {
        const section = String(value || "").trim().toLowerCase();

        if (section === "admin" || section === "administration") {
            return "administration";
        }

        if (section === "member" || section === "members") {
            return "member";
        }

        if (section === "board") {
            return "board";
        }

        return "";
    }

    function detectDelimiter(firstLine) {
        const semicolons = (firstLine.match(/;/g) || []).length;
        const commas = (firstLine.match(/,/g) || []).length;
        return semicolons >= commas ? ";" : ",";
    }

    function parseCsvLine(line, delimiter) {
        const fields = [];
        let current = "";
        let quoted = false;

        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];

            if (char === '"') {
                if (quoted && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    quoted = !quoted;
                }
            } else if (char === delimiter && !quoted) {
                fields.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }

        fields.push(current.trim());
        return fields;
    }

    function parseCsv(text) {
        const cleaned = text.replace(/^\uFEFF/, "").trim();

        if (!cleaned) {
            return [];
        }

        const lines = cleaned
            .split(/\r?\n/)
            .filter(function (line) {
                return line.trim() !== "";
            });

        const delimiter = detectDelimiter(lines[0]);
        const headers = parseCsvLine(lines[0], delimiter).map(function (header) {
            return header.trim().toLowerCase();
        });

        return lines.slice(1).map(function (line) {
            const values = parseCsvLine(line, delimiter);
            const row = {};

            headers.forEach(function (header, index) {
                row[header] = String(values[index] || "").trim();
            });

            row.section = normalizeSection(row.section);
            return row;
        });
    }

    function compareNames(a, b) {
        const lastNameComparison = String(a.last_name || "").localeCompare(
            String(b.last_name || ""),
            "en",
            { sensitivity: "base" }
        );

        if (lastNameComparison !== 0) {
            return lastNameComparison;
        }

        return String(a.first_name || "").localeCompare(
            String(b.first_name || ""),
            "en",
            { sensitivity: "base" }
        );
    }

    function compareByOrder(a, b) {
        const orderA = Number.parseInt(a.sort_order, 10);
        const orderB = Number.parseInt(b.sort_order, 10);

        const safeOrderA = Number.isFinite(orderA)
            ? orderA
            : Number.MAX_SAFE_INTEGER;

        const safeOrderB = Number.isFinite(orderB)
            ? orderB
            : Number.MAX_SAFE_INTEGER;

        if (safeOrderA !== safeOrderB) {
            return safeOrderA - safeOrderB;
        }

        return compareNames(a, b);
    }

    function compareMembers(a, b) {
        const yearA = Number.parseInt(a.year, 10);
        const yearB = Number.parseInt(b.year, 10);

        const safeYearA = Number.isFinite(yearA)
            ? yearA
            : Number.MAX_SAFE_INTEGER;

        const safeYearB = Number.isFinite(yearB)
            ? yearB
            : Number.MAX_SAFE_INTEGER;

        if (safeYearA !== safeYearB) {
            return safeYearA - safeYearB;
        }

        return compareNames(a, b);
    }

    function getImagePath(person, section) {
        const image = String(person.image || "").trim();

        if (!image) {
            return PLACEHOLDER_IMAGE;
        }

        if (
            image.startsWith("http://") ||
            image.startsWith("https://") ||
            image.startsWith("/") ||
            image.startsWith("img/")
        ) {
            return image;
        }

        return "img/member/" +
            sectionConfig[section].imageFolder +
            "/" +
            image;
    }

    function createDiv(className, text) {
        const element = document.createElement("div");
        element.className = className;
        element.textContent = text;
        return element;
    }

    function createCard(person, section) {
        const config = sectionConfig[section];
        const card = document.createElement("div");
        card.className = "member-card";

        const fullName = [person.first_name, person.last_name]
            .filter(Boolean)
            .join(" ")
            .trim();

        const image = document.createElement("img");
        image.className = "member-photo";
        image.alt = fullName || "EVER member";
        image.loading = "lazy";
        image.src = getImagePath(person, section);

        image.addEventListener("error", function () {
            if (!image.dataset.placeholderApplied) {
                image.dataset.placeholderApplied = "true";
                image.src = PLACEHOLDER_IMAGE;
            }
        });

        card.appendChild(image);

        if (fullName) {
            card.appendChild(createDiv("member-name", fullName));
        }

        const title = String(person.position || config.defaultTitle).trim();
        const year = String(person.year || "").trim();
        const roleText = year ? title + " from " + year : title;

        if (roleText) {
            card.appendChild(createDiv("member-role", roleText));
        }

        const affiliation = String(person.affiliation || "").trim();

        if (affiliation) {
            card.appendChild(createDiv("member-affiliation", affiliation));
        }

        const website = String(person.website || "").trim();

        if (website) {
            const link = document.createElement("a");
            link.className = "member-website";
            link.href = website;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.setAttribute(
                "aria-label",
                "Open personal website of " +
                (fullName || "this person") +
                " in a new window"
            );

            const label = document.createElement("span");
            label.textContent = "Personal website";

            const icon = document.createElement("span");
            icon.className = "member-website-icon";
            icon.textContent = "↗";
            icon.setAttribute("aria-hidden", "true");

            link.appendChild(label);
            link.appendChild(icon);
            card.appendChild(link);
        }

        return card;
    }

    function renderSection(section, people) {
        const config = sectionConfig[section];
        const container = document.getElementById(config.containerId);

        if (!container) {
            console.error(
                "Missing container #" + config.containerId + " in member.html"
            );
            return;
        }

        container.replaceChildren();

        const sortedPeople = people.slice().sort(
            config.sortMode === "year"
                ? compareMembers
                : compareByOrder
        );

        sortedPeople.forEach(function (person) {
            container.appendChild(createCard(person, section));
        });
    }

    function showError(message) {
        Object.keys(sectionConfig).forEach(function (section) {
            const container = document.getElementById(
                sectionConfig[section].containerId
            );

            if (container) {
                const paragraph = document.createElement("p");
                paragraph.textContent = message;
                container.replaceChildren(paragraph);
            }
        });
    }

    fetch(CSV_FILE, { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(
                    "Could not load " +
                    CSV_FILE +
                    " (HTTP " +
                    response.status +
                    ")"
                );
            }

            return response.text();
        })
        .then(function (csvText) {
            const people = parseCsv(csvText);

            renderSection(
                "board",
                people.filter(function (person) {
                    return person.section === "board";
                })
            );

            renderSection(
                "administration",
                people.filter(function (person) {
                    return person.section === "administration";
                })
            );

            renderSection(
                "member",
                people.filter(function (person) {
                    return person.section === "member";
                })
            );
        })
        .catch(function (error) {
            console.error("Error loading member data:", error);
            showError("The member information could not be loaded.");
        });
});
