document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const CSV_FILE = "data/members.csv";
    const PLACEHOLDER_IMAGE = "img/member/placeholder.png";

    // 1. Get the URL ID parameter
    const params = new URLSearchParams(window.location.search);
    const profileId = params.get("id");
    const container = document.getElementById("profile-content");

    if (!profileId) {
        container.innerHTML = "<h2 class='tm-content-title'>Profile Not Found</h2><p>No member specified.</p>";
        return;
    }

    // 2. Minimal CSV Parsing logic (reused for this page)
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
                if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
                else { quoted = !quoted; }
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
        if (!cleaned) return [];
        const lines = cleaned.split(/\r?\n/).filter(line => line.trim() !== "");
        const delimiter = detectDelimiter(lines[0]);
        const headers = parseCsvLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
        return lines.slice(1).map(line => {
            const values = parseCsvLine(line, delimiter);
            const row = {};
            headers.forEach((header, index) => { row[header] = String(values[index] || "").trim(); });
            return row;
        });
    }

    // 3. Fetch data and find the specific member
    fetch(CSV_FILE, { cache: "no-store" })
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.text();
        })
        .then(csvText => {
            const people = parseCsv(csvText);
            
            // Find the person by recreating their slug and matching it to the URL
            const person = people.find(p => {
                const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
                const slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                return slug === profileId;
            });

            if (!person) {
                container.innerHTML = "<h2 class='tm-content-title'>Profile Not Found</h2><p>The requested member does not exist in the database.</p>";
                return;
            }

            renderProfile(person);
        })
        .catch(error => {
            console.error(error);
            container.innerHTML = "<p>Error loading member data. Please try again later.</p>";
        });

    function getImagePath(person) {
        const image = String(person.image || "").trim();
        if (!image) return PLACEHOLDER_IMAGE;
        if (image.startsWith("http") || image.startsWith("/")) return image;
        
        const section = String(person.section || "").trim().toLowerCase();
        let folder = "members";
        if (section === "board") folder = "board";
        if (section === "admin" || section === "administration") folder = "admin";
        
        return "img/member/" + folder + "/" + image;
    }

    // 4. Generate the HTML for the profile page
    function renderProfile(person) {
        const fullName = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
        const imagePath = getImagePath(person);
        const position = person.position || "Member";
        const affiliation = person.affiliation || "";
        const website = person.website || "";
        
        // This looks for a new 'working_papers' column in your CSV
        const workingPapers = person.working_papers || ""; 
        
        document.title = fullName + " - EVER";

        let html = `
            <div style="display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start;">
                <!-- Profile Image -->
                <div style="flex: 0 0 260px;">
                    <img src="${imagePath}" alt="${fullName}" 
                         style="width: 100%; aspect-ratio: 1 / 1; object-fit: cover; object-position: 50% 0%; border: 1px solid var(--border-color); background: white;">
                </div>
                
                <!-- Profile Data -->
                <div style="flex: 1; min-width: 300px;">
                    <h1 class="tm-content-title" style="margin-top: 0; margin-bottom: 5px;">${fullName}</h1>
                    <h4 style="color: var(--sand-gold); font-size: 1.1rem; font-weight: 600; margin-bottom: 15px;">${position}</h4>
                    <p style="font-size: 1.1rem; color: var(--muted-blue); margin-bottom: 25px;">${affiliation}</p>
        `;

        if (website) {
            html += `
                <a href="${website}" target="_blank" rel="noopener noreferrer" class="member-website" style="font-size: 1rem; padding: 10px 18px; background: rgba(212, 165, 116, 0.1); border-radius: 6px;">
                    <span>Personal website</span>
                    <span class="member-website-icon" aria-hidden="true">↗</span>
                </a>
            `;
        }

        // EVER Working Papers Section
        html += `
                    <hr style="margin: 40px 0;">
                    <h3 style="font-family: 'Sora', sans-serif; font-size: 1.3rem; margin-bottom: 15px; color: var(--oxford-blue);">EVER Working Papers</h3>
        `;

        if (workingPapers) {
            html += `
                    <p style="color: var(--muted-blue); line-height: 1.8;">
                        ${workingPapers}
                    </p>
            `;
        } else {
            html += `
                    <p style="color: var(--muted-blue);">
                        <em>No EVER working papers currently listed for this member.</em>
                    </p>
            `;
        }

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    }
});
