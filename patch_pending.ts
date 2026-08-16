import fs from "fs";
const path = "src/components/DeviceApprovalPending.tsx";
let code = fs.readFileSync(path, "utf8");

// Remove handleDirectPinActivate and related state
code = code.replace(/const \[showPinModal, setShowPinModal\] = useState\(false\);[\s\S]*?const \[isPinSubmitting, setIsPinSubmitting\] = useState\(false\);/, "");
code = code.replace(/const handleDirectPinActivate = async \(\)[\s\S]*?};/g, "");
code = code.replace(/const handleDirectPinActivate = async \(e\?: React\.FormEvent\) => \{[\s\S]*?^\s*};\n/m, "");

// Write back to see where we are
fs.writeFileSync(path, code);
