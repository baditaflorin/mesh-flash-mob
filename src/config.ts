import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-flash-mob",
  description: "Rotating conductor; all phones flash in sync. Concerts, raves, group photos.",
  accentHex: "#ffea00",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
