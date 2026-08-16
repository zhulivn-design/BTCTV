import fs from "fs";
const path = "src/lib/firebaseDiagnostic.ts";
let code = fs.readFileSync(path, "utf8");

code = code.replace(
/  \/\/ Auto run once on startup\s+setTimeout\(\(\) => \{\s+runFirebaseDiagnostics\(\)\.catch\(\(\) => \{\}\);\s+\}, 1000\);/g,
""
);

fs.writeFileSync(path, code);
