const WORKSPACE_SCHEMA_MARKER_KEY = "xidea-workspace-schema-marker";
const WORKSPACE_SCHEMA_MARKER = "linked-session-message-schema-v2";
const LEGACY_WORKSPACE_STORAGE_KEYS = [
  "xidea-workspace-entities",
  "xidea-workspace-entities-v3",
  "xidea-workspace-ui",
];

let hasResetLegacyWorkspaceStorage = false;

export function resetLegacyWorkspaceStorage(): void {
  if (hasResetLegacyWorkspaceStorage || typeof window === "undefined") {
    return;
  }

  hasResetLegacyWorkspaceStorage = true;
  const currentMarker = window.localStorage.getItem(WORKSPACE_SCHEMA_MARKER_KEY);
  if (currentMarker === WORKSPACE_SCHEMA_MARKER) {
    return;
  }

  for (const key of LEGACY_WORKSPACE_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
  window.localStorage.setItem(WORKSPACE_SCHEMA_MARKER_KEY, WORKSPACE_SCHEMA_MARKER);
}
