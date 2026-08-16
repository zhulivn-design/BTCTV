import fs from "fs";
const path = "server.ts";
let code = fs.readFileSync(path, "utf8");

// We'll replace the loop in loadScreensFromFirestore that syncs back to Firestore
code = code.replace(
/      for \(const localS of screenDevicesStore\) \{[\s\S]*?syncScreenToFirestore\(localS\)\.catch\(\(\) => \{\}\);[\s\S]*?\}[\s\S]*?\}/,
`      // Removed syncing local to firestore here to prevent deleted items from coming back
      // Clean up local store if they don't exist in Firestore
      screenDevicesStore = screenDevicesStore.filter(localS => 
         fsScreens.some(fs => (fs.id || '').trim().toLowerCase() === localS.id.trim().toLowerCase())
      );
      saveScreens();
`
);

// We'll replace the loop in loadGroupsFromFirestore
code = code.replace(
/    for \(const localG of screenGroupsStore\) \{[\s\S]*?syncGroupToFirestore\(localG\)\.catch[^\}]*\}[\s\S]*?\}/,
`    // Removed syncing local to firestore
    // Clean up local store
    screenGroupsStore = screenGroupsStore.filter(localG =>
        combinedGroups.some(g => g.id === localG.id)
    );
    saveGroups();`
);

fs.writeFileSync(path, code);
