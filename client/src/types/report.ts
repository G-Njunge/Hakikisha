export type ReportStatus = "pending" | "investigating" | "resolved" | "dismissed";

export interface ReportDetail {
  id: string;
  scanId: string | null;
  productName: string | null;
  description: string;
  purchaseLocation: string | null;
  photoUrl: string | null;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ReportSummary {
  id: string;
  scanId: string | null;
  productName: string | null;
  description: string;
  purchaseLocation: string | null;
  hasPhoto: boolean;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export type ReportAction = "approve" | "dismiss";

export interface ReportAdminRow {
  id: string;
  scanId: string | null;
  productName: string | null;
  medicineName: string | null;
  description: string;
  purchaseLocation: string | null;
  photoUrl: string | null;
  status: ReportStatus;
  reporter: { id: string; email: string | null; fullName: string | null } | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ReportAdminListResult {
  reports: ReportAdminRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}
