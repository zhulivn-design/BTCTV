import fs from "fs";
const path = "server.ts";
let code = fs.readFileSync(path, "utf8");

const startStr = 'app.post("/api/screens/heartbeat"';
const endStr = '\n// API: Add/Update Screen Group';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `app.post("/api/screens/heartbeat", async (req, res) => {
  const { screenId, name, groupId, ipAddress } = req.body;
  const now = Date.now();
  const cleanId = normalizeScreenId(screenId);
  
  if (!cleanId) return res.json({ ok: false });

  // Update heartbeat in cache
  onlineDevicesCache.set(cleanId, now);

  let screen = findScreenById(cleanId);
  
  // If the screen is not registered at all, we DO NOT auto-create it anymore.
  if (!screen) {
    return res.json({
      ok: false,
      error: "Màn hình chưa được đăng ký",
      approved: false
    });
  }

  // Only update persistent data if necessary (don't save on every heartbeat)
  let needsSave = false;
  if (ipAddress && screen.ipAddress !== ipAddress) {
    screen.ipAddress = ipAddress;
    needsSave = true;
  }
  if (req.body.buildingId && screen.buildingId !== req.body.buildingId) {
    screen.buildingId = req.body.buildingId;
    needsSave = true;
  }
  if (req.body.zone && screen.zone !== req.body.zone) {
    screen.zone = req.body.zone;
    needsSave = true;
  }
  
  if (needsSave) {
      saveScreens();
      syncScreenToFirestore(screen).catch(() => {});
  }

  return res.json({
    ok: true,
    screenId: screen.id,
    buildingId: screen.buildingId,
    zone: screen.zone,
    groupId: screen.groupId,
    assignedConfig: screen.assignedConfig || null,
    serverTime: now,
    approved: screen.approved === true,
  });
});`;

  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync(path, code);
  console.log("Fixed!");
} else {
  console.log("Could not find bounds");
}
