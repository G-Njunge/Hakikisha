import apiClient from "./client";
import type { ScanHistoryItem } from "../types/scan";

export async function getMyScans(): Promise<ScanHistoryItem[]> {
  const { data } = await apiClient.get<{ scans: ScanHistoryItem[] }>("/api/scans/my");
  return data.scans;
}
