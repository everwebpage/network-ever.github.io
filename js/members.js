document.addEventListener("DOMContentLoaded", function () {
    const csvPath = "data/members.csv";
    const placeholderImage = "img/member/placeholder.png";

    const boardContainer = document.getElementById("board-members");
    const memberContainer = document.getElementById("network-members");

    if (!boardContainer || !memberContainer) {
        console.error("Member containers not found. Expected #board-members and #network-members.");
        return;
    }

    fetch(csvPath, { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Could not load " + csvPath + " (HTTP " + response.status + ")");
            }
            return response.text();
        })
        .then(function (csvText) {
            const people = parseCsv(csvText);

            if (!people.length) {
                boardContainer.innerHTML = '<p class="member-load-message">No entries found in data/members.csv.</p>';
                memberContainer.innerHTML = "";
                console.warn("CSV loaded, but no usable entries were found.");
                return;
            }

            const boardMembers = people
                .filter(function (person) {
                    return normalize(person.section) === "board";
                })
                .sort(sortBoardMembers);

            const members = people
                .filter(function (person) {
                    return normalize(person.section) === "member";
                })
                .sort(sortMembers);

            renderPeople(boardMembers, boardContainer, "board");
            renderPeople(members, memberContainer, "members");

            if (!boardMembers.length) {
                boardContainer.innerHTML = '<p class="member-load-message">No board members found. Check the section column in data/members.csv.</p>';
            }

            if (!members.length) {
                memberContainer.innerHTML = '<p class="member-load-message">No members found. Check the section column in data/members.csv.</p>';
            }
        })
        .catch(function (error) {
            boardContainer.innerHTML = '<p class="member-load-message">Members could not be loaded. Check whether data/members.csv exists.</p>';
            memberContainer.innerHTML = "";
            console.error(error);
        });

    function renderPeople(people, container, imageFolder) {
        container.innerHTML = "";

        people.forEach(function (person) {
            const fullName = [person.first_name, person.last_name]
                .filter(Boolean)
                .join(" ");

            const roleText = makeRoleText(person.position, person.year);
            const imagePath = makeImagePath(person.image, imageFolder);

            const card = document.createElement("div");
            card.className = "member-card";

            const img = document.createElement("img");
            img.src = imagePath;
            img.alt = fullName || "EVER member";
            img.className = "member-photo";
            img.onerror = function () {
                this.onerror = null;
                this.src = placeholderImage;
            };

            const name = document.createElement("div");
            name.className = "member-name";
            name.textContent = fullName;

            const role = document.createElement("div");
            role.className = "member-role";
            role.textContent = roleText;

            const affiliation = document.createElement("div");
            affiliation.className = "member-affiliation";
            affiliation.textContent = person.affiliation || "";

            card.appendChild(img);
            card.appendChild(name);
            card.appendChild(role);
            card.appendChild(affiliation);

const website = String(person.website || "").trim();

if (website) {
    const link = document.createElement("a");
    link.href = website;
    link.className = "member-website";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "Open personal website in a new window");

    const linkText = document.createElement("span");
    linkText.textContent = "Personal website";

    const externalIcon = document.createElement("span");
    externalIcon.className = "member-website-icon";
    externalIcon.textContent = "↗";
    externalIcon.setAttribute("aria-hidden", "true");

    link.appendChild(linkText);
    link.appendChild(externalIcon);

    card.appendChild(link);
}
            container.appendChild(card);
        });
    }

    function makeRoleText(position, year) {
        const cleanPosition = String(position || "Member").trim();
        const cleanYear = String(year || "").trim();
        return cleanYear ? cleanPosition + " from " + cleanYear : cleanPosition;
    }

    function makeImagePath(image, imageFolder) {
        const cleanImage = String(image || "").trim();

        if (!cleanImage) {
            return placeholderImage;
        }

        if (
            cleanImage.startsWith("http://") ||
            cleanImage.startsWith("https://") ||
            cleanImage.includes("/")
        ) {
            return cleanImage;
        }

        return "img/member/" + imageFolder + "/" + cleanImage;
    }

    function sortBoardMembers(a, b) {
        const orderA = parseNumber(a.sort_order);
        const orderB = parseNumber(b.sort_order);

        if (orderA !== orderB) {
            return orderA - orderB;
        }

        return sortMembers(a, b);
    }

    function sortMembers(a, b) {
        const yearA = parseNumber(a.year);
        const yearB = parseNumber(b.year);

        if (yearA !== yearB) {
            return yearA - yearB;
        }

        const lastNameCompare = String(a.last_name || "").localeCompare(String(b.last_name || ""), "en", {
            sensitivity: "base"
        });

        if (lastNameCompare !== 0) {
            return lastNameCompare;
        }

        return String(a.first_name || "").localeCompare(String(b.first_name || ""), "en", {
            sensitivity: "base"
        });
    }

    function parseNumber(value) {
        const number = Number(String(value || "").replace(",", "."));
        return Number.isFinite(number) ? number : 999999;
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function normalizeHeader(value) {
        return String(value || "")
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-/g, "_");
    }

    function detectDelimiter(firstLine) {
        const candidates = [",", ";", "\t"];
        let bestDelimiter = ",";
        let bestCount = -1;

        candidates.forEach(function (delimiter) {
            const count = countOutsideQuotes(firstLine, delimiter);
            if (count > bestCount) {
                bestCount = count;
                bestDelimiter = delimiter;
            }
        });

        return bestDelimiter;
    }

    function countOutsideQuotes(text, delimiter) {
        let count = 0;
        let insideQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];

            if (char === '"' && insideQuotes && nextChar === '"') {
                i++;
            } else if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === delimiter && !insideQuotes) {
                count++;
            }
        }

        return count;
    }

    function parseCsv(csvText) {
        const cleanText = String(csvText || "").replace(/^\uFEFF/, "");
        const firstLine = cleanText.split(/\r?\n/)[0] || "";
        const delimiter = detectDelimiter(firstLine);
        const rows = [];
        let row = [];
        let cell = "";
        let insideQuotes = false;

        for (let i = 0; i < cleanText.length; i++) {
            const char = cleanText[i];
            const nextChar = cleanText[i + 1];
            const code = char.charCodeAt(0);

            if (char === '"' && insideQuotes && nextChar === '"') {
                cell += '"';
                i++;
            } else if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === delimiter && !insideQuotes) {
                row.push(cell.trim());
                cell = "";
            } else if ((code === 10 || code === 13) && !insideQuotes) {
                if (code === 13 && nextChar && nextChar.charCodeAt(0) === 10) {
                    i++;
                }
                row.push(cell.trim());
                if (row.some(function (entry) { return entry !== ""; })) {
                    rows.push(row);
                }
                row = [];
                cell = "";
            } else {
                cell += char;
            }
        }

        row.push(cell.trim());
        if (row.some(function (entry) { return entry !== ""; })) {
            rows.push(row);
        }

        if (rows.length < 2) {
            return [];
        }

        const headers = rows[0].map(normalizeHeader);

        return rows.slice(1).map(function (dataRow) {
            const person = {};
            headers.forEach(function (header, index) {
                person[header] = dataRow[index] || "";
            });
            return person;
        }).filter(function (person) {
            return person.first_name || person.last_name || person.affiliation;
        });
    }
});
