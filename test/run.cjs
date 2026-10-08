// Runs the Action on sample ACR.md files, as GitHub would, and checks the outcome of each.
// Same samples as the site's scripts/test-validator.cjs. Run: node test/run.cjs
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const today = "2026-10-06"; // fixed, so the "over a year ago" check doesn't change with the calendar
const cases = [
    // name, file, inputs, expected { exit, rating, errors, warnings }, other files { path: text }
    ["good", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\n\nText\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 0 }],
    ["badRating", "---\nrating: b9z\nspec: 0.1\nupdated: 2026-10-01\n---\nx\n", {}, { exit: 1, rating: "", errors: 3, warnings: 1 }],
    ["zeroShare", '---\nrating: A0c\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 1, rating: "", errors: 1, warnings: 0 }],
    ["missing", "---\nratng: A2b\n---\n", {}, { exit: 1, rating: "", errors: 3, warnings: 1 }],
    ["noFrontMatter", "rating: A2b\n", {}, { exit: 1, rating: "", errors: 1, warnings: 0 }],
    ["badYaml", "---\nrating: [A2b\n---\n", {}, { exit: 1, rating: "", errors: 1, warnings: 0 }],
    ["noAiLabel", '---\nrating: E0a\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 0, rating: "E0a", errors: 0, warnings: 0 }],
    ["unlikelyE", '---\nrating: E3b\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 0, rating: "E3b", errors: 0, warnings: 1 }],
    ["oldAndUnknown", '---\nrating: C3c\nspec: "0.2"\nupdated: 2024-01-01\nscopes:\n  docs/: B4b\n---\n', {}, { exit: 1, rating: "C3c", errors: 1, warnings: 2 }],
    ["stale", '---\nrating: B4c\nspec: "0.1"\nupdated: 2025-01-01\n---\nx\n', {}, { exit: 0, rating: "B4c", errors: 0, warnings: 1 }],
    ["staleStrict", '---\nrating: B4c\nspec: "0.1"\nupdated: 2025-01-01\n---\nx\n', { "fail-on-warnings": "true" }, { exit: 1, rating: "B4c", errors: 0, warnings: 1 }],
    ["otherPath", '---\nrating: A1a\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', { path: "docs/ACR.md" }, { exit: 0, rating: "A1a", errors: 0, warnings: 0 }],
    ["badgeMatches", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 0 },
        { "README.md": "# P\n\n[![ACR A2b](https://img.shields.io/badge/ACR-A2b-2140B5)](ACR.md)\n" }],
    ["badgeStale", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 1 },
        { "README.md": "# P\n\n[![ACR A3b](https://img.shields.io/badge/ACR-A3b-2140B5)](ACR.md)\n" }],
    ["badgeStaleStrict", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', { "fail-on-warnings": "true" }, { exit: 1, rating: "A2b", errors: 0, warnings: 1 },
        { "README.md": "[![ACR A3b](https://img.shields.io/badge/ACR-A3b-2140B5)](ACR.md)\n" }],
    ["badgeStaleRstInGithubDir", '---\nrating: B4c\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 0, rating: "B4c", errors: 0, warnings: 1 },
        { ".github/README.rst": "P\n=\n\n.. image:: https://img.shields.io/badge/ACR-B3c-2140B5\n   :target: ACR.md\n", "README.md": "[![ACR B4c](https://img.shields.io/badge/ACR-B4c-2140B5)](ACR.md)\n" }],
    ["badgeHtmlTwoStale", '---\nrating: C1a\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 0, rating: "C1a", errors: 0, warnings: 2 },
        { "readme.html": '<img src="https://img.shields.io/badge/ACR-C2a-2140B5"> <img src="https://img.shields.io/badge/ACR-C3a-2140B5">\n' }],
    ["noBadge", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 0 },
        { "README.md": "# No badge here\n" }],
    ["badDate", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-02-31\n---\nx\n', {}, { exit: 1, rating: "A2b", errors: 1, warnings: 0 }],
    ["timestamp", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01T10:00:00Z\n---\nx\n', {}, { exit: 1, rating: "A2b", errors: 1, warnings: 0 }],
    ["tomorrowAllowed", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-07\n---\nx\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 0 }],
    ["future", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-08\n---\nx\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 1 }],
    ["newlineKey", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n"x\\n# Injected": 1\n---\nx\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 0 }],
    ["spaces", '---\nrating: " A2b"\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n', {}, { exit: 1, rating: "", errors: 1, warnings: 0 }],
    ["headingsOnly", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\n\n# AI Code Rating\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 1 }],
    ["placeholder", '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\n\n# AI Code Rating\n\n**ACR A2b**\n\n## How AI Was Used\n\n<!-- A short paragraph. -->\n', {}, { exit: 0, rating: "A2b", errors: 0, warnings: 1 }],
    ["lowercaseName", null, {}, { exit: 0, rating: "A2b", errors: 0, warnings: 0 },
        { "acr.md": '---\nrating: A2b\nspec: "0.1"\nupdated: 2026-10-01\n---\nx\n' }],
    ["empty", "\n", {}, { exit: 1, rating: "", errors: 1, warnings: 0 }],
    ["notFound", null, {}, { exit: 1, rating: "", errors: 1, warnings: 0 }],
];

let failures = 0;
for (const [name, text, inputs, want, files = {}] of cases) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "acr-action-"));
    const file = inputs.path || "ACR.md";
    if (text !== null) {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), text);
    }
    for (const [f, t] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
        fs.writeFileSync(path.join(dir, f), t);
    }
    const outFile = path.join(dir, "output"), summaryFile = path.join(dir, "summary");
    const env = { ...process.env, GITHUB_WORKSPACE: dir, GITHUB_OUTPUT: outFile, GITHUB_STEP_SUMMARY: summaryFile, ACR_TODAY: today };
    for (const [k, v] of Object.entries(inputs)) env["INPUT_" + k.toUpperCase()] = v;
    const run = spawnSync(process.execPath, [path.join(__dirname, "..", "index.cjs")], { env, encoding: "utf8" });
    const outputs = Object.fromEntries(fs.readFileSync(outFile, "utf8").trim().split("\n").map((l) => l.split("=")));
    const got = { exit: run.status, rating: outputs.rating, errors: +outputs.errors, warnings: +outputs.warnings };
    // Every message stays on one summary line, even one quoting a key with a newline in it.
    const ok = JSON.stringify(got) === JSON.stringify(want) && fs.existsSync(summaryFile) &&
        !/^# Injected/m.test(fs.readFileSync(summaryFile, "utf8"));
    if (!ok) failures++;
    console.log(`${ok ? "pass" : "FAIL"}  ${name}` + (ok ? "" : `\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(got)}\n${run.stdout}${run.stderr}`));
    if (process.argv.includes("-v")) console.log(run.stdout.replace(/^/gm, "    "));
    fs.rmSync(dir, { recursive: true });
}
console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exitCode = failures ? 1 : 0;
