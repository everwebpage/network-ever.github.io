document.addEventListener("DOMContentLoaded", function () {
    const csvPath = "data/members.csv";
    const placeholderImage = "img/member/placeholder.png";

    const boardContainer = document.getElementById("board-members");
    const administrationContainer = document.getElementById("administration-members");
    const memberContainer = document.getElementById("network-members");

    if (!boardContainer || !administrationContainer || !memberContainer) {
        console.error("One or more member containers are missing in member.html.");
        return;
    }

    fetch(csvPath)
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Could not load " + csvPath);
            }
            return response.text();
        })
        .then(function (csvText) {
            const people = parseCsv(csvText);

            const boardMembers = people
                .filter(function (person) {
                    return normalize(person.section) === "board";
                })
                .sort(sortByOrderThenMember);

            const administrationMembers = people
                .filter(function (person) {
                    const section = normalize(person.section);
                    return section === "administration" || section === "admin";
                })
                .sort(sortByOrderThenMember);

            const members = people
                .filter(function (person) {
                    return normalize(person.section) === "member";
                })
                .sort(sortMembers);

            renderPeople(boardMembers, boardContainer, "board");
            renderPeople(administrationMembers, administrationContainer, "admin");
            renderPeople(members, memberContainer, "members");
        })
        .catch(function (error) {
            boardContainer.innerHTML = "<p>Members could not be loaded.</p>";
            administrationContainer.innerHTML = "";
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
                link.setAttribute(
                    "aria-label",
                    "Open the personal website of " + (fullName || "this person") + " in a new window"
                );

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

    function sortByOrderThenMember(a, b) {
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

        const lastNameCompare = String(a.last_name || "").localeCompare(
            String(b.last_name || ""),
            "en",
            { sensitivity: "base" }
        );

        if (lastNameCompare !== 0) {
            return lastNameCompare;
        }

        return String(a.first_name || "").localeCompare(
            String(b.first_name || ""),
            "en",
            { sensitivity: "base" }
        );
    }

    function parseNumber(value) {
        const cleanValue = String(value || "").trim();
        if (!cleanValue) {
            return 999999;
        }

        const number = Number(cleanValue);
        return Number.isFinite(number) ? number : 999999;
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase();
    }

    function detectDelimiter(csvText) {
        const firstLine = csvText
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .find(function (line) {
                return line.trim() !== "";
            }) || "";

        const semicolonCount = (firstLine.match(/;/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;

        return semicolonCount > commaCount ? ";" : ",";
    }

    function parseCsv(csvText) {
        const delimiter = detectDelimiter(csvText);
        const cleanText = csvText.replace(/^\uFEFF/, "");
        const rows = [];
        let row = [];
        let cell = "";
        let insideQuotes = false;

        for (let i = 0; i < cleanText.length; i++) {
            const char = cleanText[i];
            const nextChar = cleanText[i + 1];

            if (char === '"' && insideQuotes && nextChar === '"') {
                cell += '"';
                i++;
            } else if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === delimiter && !insideQuotes) {
                row.push(cell.trim());
                cell = "";
            } else if ((char === "\n" || char === "\r") && !insideQuotes) {
                if (char === "\r" && nextChar === "\n") {
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

        const headers = rows[0].map(function (header) {
            return normalize(header);
        });

        return rows.slice(1).map(function (dataRow) {
            const person = {};

            headers.forEach(function (header, index) {
                person[header] = dataRow[index] || "";
            });

            return person;
        });
    }
});
