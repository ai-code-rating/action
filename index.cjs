// GitHub Action entry point. Checks ACR.md with the same checks as https://aicoderating.com/validate/
// (lib/acr-check.cjs) and reports them as annotations on the file, a job summary, and step outputs.
// No dependencies beyond lib/, so there's no build step.
const fs = require("node:fs");
const path = require("node:path");
const { check } = require("./lib/acr-check.cjs");
const yaml = require("./lib/js-yaml.cjs");
const acr = require("./lib/acr-data.json");

const input = (name, def) => (process.env["INPUT_" + name.toUpperCase()] || "").trim() || def;
const fmt = { code: (s) => "`" + s + "`", text: (s) => String(s) };

// Workflow command escaping: https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts
const escData = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escProp = (s) => escData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const annotate = (cmd, props, msg) =>
    console.log("::" + cmd + " " + Object.entries(props).filter(([, v]) => v != null).map(([k, v]) => k + "=" + escProp(v)).join(",") + "::" + escData(msg));
const appendFile = (envName, text) => { if (process.env[envName]) fs.appendFileSync(process.env[envName], text); };
const setOutput = (name, value) => appendFile("GITHUB_OUTPUT", name + "=" + value + "\n");

// The README GitHub shows: .github/, then the root, then docs/ (the same order GitHub uses).
function findReadme(root) {
    for (const dir of [".github", "", "docs"]) {
        let names;
        try { names = fs.readdirSync(path.join(root, dir)); } catch (e) { continue; }
        const name = names.sort().find((n) => /^readme(\.[a-z]+)?$/i.test(n));
        if (name) return path.posix.join(dir, name);
    }
    return null;
}

// A README badge that shows a different rating from ACR.md. Only this Action can check it: the
// validator page only sees ACR.md. Matches the shields.io badge the rating form gives, in any format.
function checkBadges(root, rating) {
    const readme = findReadme(root);
    if (!readme) return [];
    const out = [];
    fs.readFileSync(path.join(root, readme), "utf8").split(/\r?\n/).forEach((line, i) => {
        for (const m of line.matchAll(/img\.shields\.io\/badge\/ACR-([A-Za-z0-9]{3})-/g)) {
            if (m[1] !== rating) {
                out.push({ level: "warn", file: readme, line: i + 1,
                    msg: `The ACR badge in ${readme} shows \`${m[1]}\`, but ${acr.fileName} rates the project \`${rating}\`. Change \`ACR-${m[1]}\` to \`ACR-${rating}\` in the badge URL.` });
            }
        }
    });
    return out;
}

// The spec: look for the exact name first, then match it without regard to case (same folder).
function findFile(root, file) {
    if (fs.existsSync(path.resolve(root, file))) return file;
    const dir = path.posix.dirname(file), base = path.posix.basename(file).toLowerCase();
    let names;
    try { names = fs.readdirSync(path.resolve(root, dir)); } catch (e) { return file; }
    const name = names.sort().find((n) => n.toLowerCase() === base);
    return name ? path.posix.join(dir, name) : file;
}

function main() {
    const root = process.env.GITHUB_WORKSPACE || process.cwd();
    const file = findFile(root, input("path", acr.fileName));
    const failOnWarnings = input("fail-on-warnings", "false").toLowerCase() === "true";
    const full = path.resolve(root, file);
    const title = "AI Code Rating";

    if (!fs.existsSync(full)) {
        annotate("error", { title }, `${file} not found. Did the workflow run actions/checkout first? Get a rating at ${acr.siteUrl}/#rate`);
        setOutput("rating", ""); setOutput("errors", 1); setOutput("warnings", 0);
        appendFile("GITHUB_STEP_SUMMARY", `## ${title}\n\n\`${file}\` not found.\n`);
        process.exitCode = 1;
        return;
    }

    const text = fs.readFileSync(full, "utf8");
    // On the validator page an empty box is just a prompt to paste, but an empty file is an error here.
    const results = text.trim() ? check(text, { acr, yaml, fmt, today: process.env.ACR_TODAY }) // ACR_TODAY: fixed date for tests
        : [{ level: "error", msg: `${file} is empty. Get a rating and the file's contents at ${acr.siteUrl}/#rate`, line: 1 }];
    const rated = results.find((r) => r.meaning);
    if (rated) results.push(...checkBadges(root, rated.rating));
    const count = (level) => results.filter((r) => r.level === level).length;
    const errors = count("error"), warnings = count("warn");
    const commands = { error: "error", warn: "warning", info: "notice" };

    for (const r of results) {
        if (commands[r.level]) annotate(commands[r.level], { file: r.file || file, line: r.line, title }, r.msg);
        else console.log("OK: " + r.msg + (r.meaning ? " (" + r.meaning.join(", ") + ")" : ""));
    }

    const failed = errors > 0 || (failOnWarnings && warnings > 0);
    const verdict = errors ? `${errors} ${errors === 1 ? "problem" : "problems"} to fix` :
        warnings ? `Valid, with ${warnings} ${warnings === 1 ? "warning" : "warnings"}` : "Valid";
    console.log(`${file}: ${verdict}`);

    const labels = { error: "Error", warn: "Warning", ok: "OK", info: "Note" };
    const rank = { error: 0, warn: 1, ok: 2, info: 2 };
    // Messages can quote keys from the file, so keep each one on its own table row.
    const cell = (s) => String(s).replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|");
    const rows = results.slice().sort((a, b) => rank[a.level] - rank[b.level])
        .map((r) => `| ${labels[r.level]} | ${cell(r.file || file)} | ${r.line || ""} | ${cell(r.msg + (r.meaning ? " (" + r.meaning.join(", ") + ")" : ""))} |`);
    appendFile("GITHUB_STEP_SUMMARY", [
        `## ${title}: ${rated ? "`" + rated.rating + "`" : "No valid rating"}`, "",
        `\`${file}\`: **${verdict}**${failed && !errors ? " (warnings fail this check)" : ""}`, "",
        "| Result | File | Line | Message |", "|---|---|---|---|", ...rows, "",
        `Checked against spec ${acr.spec}. Details: ${acr.siteUrl}/spec/`, "",
    ].join("\n"));

    setOutput("rating", rated ? rated.rating : "");
    setOutput("errors", errors);
    setOutput("warnings", warnings);
    if (failed) process.exitCode = 1;
}

main();
