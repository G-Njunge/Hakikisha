import apiClient from "./client";
import type { AdminStats } from "../types/admin";

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await apiClient.get<AdminStats>("/api/admin/stats");
  return data;
}
