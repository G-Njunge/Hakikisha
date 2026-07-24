import apiClient from "./client";
import type { ReportAction, ReportAdminListResult, ReportDetail, ReportSummary } from "../types/report";

export interface CreateReportInput {
  scanId?: string;
  productName?: string;
  description: string;
  country: string;
  purchaseLocation?: string;
  photoUrl?: string;
}

export async function createReport(input: CreateReportInput): Promise<ReportDetail> {
  const { data } = await apiClient.post<{ report: ReportDetail }>("/api/reports", input);
  return data.report;
}

export async function getMyReports(): Promise<ReportSummary[]> {
  const { data } = await apiClient.get<{ reports: ReportSummary[] }>("/api/reports/my");
  return data.reports;
}

export async function getAllReports(page = 1): Promise<ReportAdminListResult> {
  const { data } = await apiClient.get<ReportAdminListResult>("/api/reports", { params: { page } });
  return data;
}

export async function updateReportStatus(id: string, action: ReportAction): Promise<ReportDetail> {
  const { data } = await apiClient.patch<{ report: ReportDetail }>(`/api/reports/${id}`, { action });
  return data.report;
}
