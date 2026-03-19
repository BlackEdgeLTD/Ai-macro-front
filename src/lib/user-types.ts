export type UserProfile = {
  oid: string;
  displayName: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  preferences: {
    defaultView: "home" | "cbs" | "boi";
    boiDateRange: { start: string; end: string } | null;
    cbsDateRange: { start: string; end: string } | null;
    selectedRegion: string | null;
  };
  customDashboards: Array<{
    id: string;
    prompt: string;
    title: string;
    createdAt: string;
  }>;
  searchHistory: Array<{
    query: string;
    timestamp: string;
  }>;
};
