import fs from "fs";
const path = "src/App.tsx";
let code = fs.readFileSync(path, "utf8");

code = code.replace(
/  \/\/ Device heartbeat effect: lightweight HTTP ping to Express server without writing to Firestore[\s\S]*?  \}, \[screenId, screenGroupId, config\.selectedBuildingId, config\.selectedZone\]\);/,
`  // Device heartbeat disabled as requested
  /*
  useEffect(() => {
    // heartbeat removed
  }, [screenId, screenGroupId]);
  */`
);

fs.writeFileSync(path, code);
