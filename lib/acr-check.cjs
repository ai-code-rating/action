// Copied from the aicoderating.com repo by scripts/sync-action.mjs. Edit it there, not here.
// ACR.md checks, shared by the validator page and the GitHub Action. No browser or Node code here.
// In a browser it sets window.ACRCheck; in Node it's a CommonJS module.
//
// check(text, opts) returns a list of { level, msg, line?, meaning? }:
//   level   "error", "warn", "ok", or "info"
//   msg     the message, built with opts.fmt so the caller picks HTML or plain text
//   line    1-based line in the file the message is about, when known
//   meaning for the main rating: [maintainer, AI share, oversight] in words
// opts: { acr: window.ACR data, yaml: js-yaml, fmt: { code(s), text(s) }, today: "YYYY-MM-DD" (optional, defaults to UTC) }
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.ACRCheck = factory();
})(this, function () {
    var KNOWN_FIELDS = ["rating", "spec", "updated"];
    var STALE_DAYS = 365;

    function find(items, k) {
        for (var i = 0; i < items.length; i++) if (String(items[i].k) === k) return items[i];
        return null;
    }
    function keyList(items) { return items.map(function (x) { return x.k; }).join(", "); }
    function addDays(day, n) { return new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10); }
    function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    function check(text, opts) {
        var ACR = opts.acr, S = ACR.levels, fmt = opts.fmt;
        var code = fmt.code, txt = fmt.text;
        var DEV = S.maintainer, SHARE = S.share, OVER = S.oversight;
        var NO_AI_OVERSIGHT = OVER[0].k; // forced when AI Share is 0
        var today = opts.today || new Date().toISOString().slice(0, 10);
        var out = [];
        var add = function (level, msg, line, extra) {
            var item = { level: level, msg: msg };
            if (line) item.line = line;
            if (extra) for (var k in extra) item[k] = extra[k];
            out.push(item);
        };

        // Check one rating. Returns { problems: [msg], warnings: [msg], meaning: [text]|null }.
        function checkRating(r) {
            var problems = [];
            if (r !== r.trim()) {
                problems.push("There are spaces around " + code(r.trim()) + ". Remove them: the rating is just the three characters.");
                return { problems: problems, warnings: [], meaning: null };
            }
            if (r.length !== 3) {
                problems.push(code(r) + " has " + r.length + " characters. A rating has exactly 3, like " + code("A2b") + ".");
                return { problems: problems, warnings: [], meaning: null };
            }
            var d = find(DEV, r[0]), s = find(SHARE, r[1]), o = find(OVER, r[2]);
            if (!d) {
                problems.push("Position 1 is " + code(r[0]) + ". Maintainer Expertise must be one of " + keyList(DEV) + " (uppercase)." +
                    (find(DEV, r[0].toUpperCase()) ? " Use " + code(r[0].toUpperCase()) + "." : ""));
            }
            if (!s) problems.push("Position 2 is " + code(r[1]) + ". AI Share must be one of " + keyList(SHARE) + ".");
            if (!o) {
                problems.push("Position 3 is " + code(r[2]) + ". Oversight must be one of " + keyList(OVER) + " (lowercase)." +
                    (find(OVER, r[2].toLowerCase()) ? " Use " + code(r[2].toLowerCase()) + "." : ""));
            }
            if (s && o && s.k === 0 && o.k !== NO_AI_OVERSIGHT) {
                problems.push("AI Share is " + code("0") + ", so Oversight must be " + code(NO_AI_OVERSIGHT) + ". With no AI code, nothing was left unchecked.");
            }
            var warnings = [];
            if (!problems.length && s.k !== 0) {
                S.inconsistent.forEach(function (c) {
                    if (c.maintainer === d.k && c.oversight.indexOf(o.k) !== -1) {
                        warnings.push(code(r) + " is unlikely. " + txt(c.reason));
                    }
                });
            }
            // With no AI code, "a" means nothing was left unchecked, not that anything was verified.
            var meaning = problems.length ? null :
                ["Maintainer: " + d.name, "AI Share: " + s.label, "Oversight: " + (s.k === 0 ? S.no_ai_oversight_name : o.name)];
            return { problems: problems, warnings: warnings, meaning: meaning };
        }

        text = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
        if (!text.trim()) {
            add("info", "Paste the contents of your " + code(ACR.fileName) + " to check it.");
            return out;
        }

        var m = /^---[ \t]*\n([\s\S]*?)\n?---[ \t]*(?:\n|$)([\s\S]*)$/.exec(text);
        if (!m) {
            add("error", "The file must start with a front matter block: a line with " + code("---") +
                ", the fields, then another line with " + code("---") + ".", 1);
            return out;
        }

        // Line numbers: front matter line i (0-based) is file line i + 2.
        var fmLines = m[1].split("\n");
        var fieldLine = function (k) {
            var re = new RegExp("^[\"']?" + reEsc(k) + "[\"']?\\s*:");
            for (var i = 0; i < fmLines.length; i++) if (re.test(fmLines[i])) return i + 2;
            return null;
        };

        var data;
        try {
            // CORE_SCHEMA has no timestamp type, so dates stay as written and can be checked exactly.
            data = opts.yaml.load(m[1], { schema: opts.yaml.CORE_SCHEMA });
        } catch (e) {
            add("error", "The front matter isn't valid YAML: " + txt(e.reason || e.message) +
                (e.mark ? " (line " + (e.mark.line + 2) + ")" : "") + ".", e.mark ? e.mark.line + 2 : 1);
            return out;
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            add("error", "The front matter must be a set of fields, such as " + code("rating: A2b") + ".", 2);
            return out;
        }

        // rating
        if (!("rating" in data)) {
            add("error", "The " + code("rating") + " field is missing.", 1);
        } else if (typeof data.rating !== "string") {
            add("error", code("rating") + " must be a three-character rating, such as " + code("A2b") + ".", fieldLine("rating"));
        } else {
            var rl = fieldLine("rating"), r = checkRating(data.rating);
            r.problems.forEach(function (p) { add("error", p, rl); });
            r.warnings.forEach(function (w) { add("warn", w, rl); });
            if (r.meaning) add("ok", "Rating: " + code(data.rating), rl, { meaning: r.meaning, rating: data.rating });
        }

        // spec
        if (!("spec" in data)) {
            add("error", "The " + code("spec") + " field is missing. Add " + code('spec: "' + ACR.spec + '"') + ".", 1);
        } else {
            var v = String(data.spec), sl = fieldLine("spec");
            if (typeof data.spec === "number") {
                add("warn", "Put the spec version in quotes: " + code('spec: "' + v + '"') +
                    ". Without them, YAML reads it as a number, so a version like 1.10 would turn into 1.1.", sl);
            }
            if (ACR.specVersions.indexOf(v) === -1) {
                add("error", "Spec version " + code(v) + " doesn't exist. Published versions: " + ACR.specVersions.join(", ") + ".", sl);
            } else if (v !== ACR.spec) {
                add("info", "This file follows spec " + code(v) + ". The latest is " + code(ACR.spec) + ".", sl);
            } else {
                add("ok", "Follows spec " + code(v) + ", the latest version.", sl);
            }
        }

        // updated
        if (!("updated" in data)) {
            add("error", "The " + code("updated") + " field is missing. Add the date you last checked the rating, such as " + code("updated: " + today) + ".", 1);
        } else {
            var ul = fieldLine("updated"), day = null;
            // A real calendar day: Date would turn 2026-02-31 into March 3, so it must round-trip unchanged.
            if (typeof data.updated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.updated)) {
                var parsed = new Date(data.updated + "T00:00:00Z");
                if (!isNaN(parsed) && parsed.toISOString().slice(0, 10) === data.updated) day = data.updated;
            }
            if (!day && typeof data.updated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.updated)) {
                add("error", code("updated") + " is " + code(data.updated) + ", which isn't a real date.", ul);
            } else if (!day) {
                add("error", code("updated") + " must be a date written as YYYY-MM-DD, such as " + code(today) + ".", ul);
            } else if (day > addDays(today, 1)) { // a day's slack: the writer's local date can be ahead of ours
                add("warn", code("updated") + " is " + code(day) + ", which is in the future.", ul);
            } else {
                var ageDays = (new Date(today) - new Date(day)) / 86400000;
                if (ageDays > STALE_DAYS) add("warn", "The rating was last checked on " + code(day) + ", over a year ago. Check it again and update the date.", ul);
                else add("ok", "Last checked on " + code(day) + ".", ul);
            }
        }

        // unknown fields
        Object.keys(data).forEach(function (k) {
            if (KNOWN_FIELDS.indexOf(k) === -1) {
                add("info", code(k) + " isn't a field in spec " + txt(ACR.spec) + ". Tools will ignore it. If it's a typo, the fields are " +
                    KNOWN_FIELDS.map(code).join(", ") + ".", fieldLine(k));
            }
        });

        // body: comments don't count, as the rating form leaves one as a placeholder
        var PARAGRAPH = "Add a short paragraph in plain English about how AI is used in the project.";
        var bodyLines = m[2].replace(/<!--[\s\S]*?-->/g, function (c) { return c.replace(/[^\n]/g, ""); }).split("\n");
        var bodyStart = fmLines.length + 3; // file line of the body's first line
        var isHeading = function (l) { return /^#{1,6}(\s|$)/.test(l); };
        if (!bodyLines.join("").trim()) {
            add("warn", "There's no text after the front matter. " + PARAGRAPH, fmLines.length + 2);
        } else if (bodyLines.every(function (l) { return !l.trim() || isHeading(l); })) {
            var first = 0;
            while (!bodyLines[first].trim()) first++;
            add("warn", "There are only headings after the front matter. " + PARAGRAPH, bodyStart + first);
        } else {
            for (var i = 0; i < bodyLines.length; i++) {
                if (!/^#{1,6}\s+How AI (Was|Is) Used\b/i.test(bodyLines[i])) continue;
                var j = i + 1;
                while (j < bodyLines.length && !isHeading(bodyLines[j]) && !bodyLines[j].trim()) j++;
                if (j === bodyLines.length || isHeading(bodyLines[j])) {
                    add("warn", "The " + code(bodyLines[i].replace(/^#+\s*/, "").trim()) + " section is empty. " + PARAGRAPH, bodyStart + i);
                }
            }
        }

        return out;
    }

    return { check: check };
});
