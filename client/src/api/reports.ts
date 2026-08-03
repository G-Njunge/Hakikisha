import apiClient from "./client";
import type {
  ReportAction,
  ReportAdminListResult,
  ReportAdminRow,
  ReportDetail,
  ReportStatus,
  ReportSummary,
} from "../types/report";

export interface CreateReportInput {
  scanId?: string;
  productName?: string;
  description: string;
  country: string;
  purchaseLocation?: string;
  photoUrl?: string;
}

export interface GetAllReportsOptions {
  page?: number;
  status?: ReportStatus;
  sort?: "newest" | "oldest";
}

export async function createReport(input: CreateReportInput): Promise<ReportDetail> {
  const { data } = await apiClient.post<{ report: ReportDetail }>("/api/reports", input);
  return data.report;
}

export async function getMyReports(): Promise<ReportSummary[]> {
  const { data } = await apiClient.get<{ reports: ReportSummary[] }>("/api/reports/my");
  return data.reports;
}

export async function getAllReports(options: GetAllReportsOptions = {}): Promise<ReportAdminListResult> {
  const { page = 1, status, sort } = options;
  const { data } = await apiClient.get<ReportAdminListResult>("/api/reports", { params: { page, status, sort } });
  return data;
}

export async function getUnreadReportCount(): Promise<number> {
  const { data } = await apiClient.get<{ count: number }>("/api/reports/unread-count");
  return data.count;
}

export async function updateReportStatus(
  id: string,
  update: { action?: ReportAction; notes?: string }
): Promise<ReportAdminRow> {
  const { data } = await apiClient.patch<{ report: ReportAdminRow }>(`/api/reports/${id}`, update);
  return data.report;
}
