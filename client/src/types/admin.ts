import type { ReportAdminRow } from "./report";

export interface AdminStats {
  totalUsers: number;
  usersByRole: { admin: number; manufacturer: number; pharmacist: number; consumer: number };
  totalMedicines: number;
  totalPharmacies: number;
  totalScans: number;
  scansByResult: { authentic: number; expired: number; unknown: number };
  scansLast7Days: Array<{ date: string; count: number }>;
  totalReports: number;
  reportsByStatus: {
    pending: number;
    investigating: number;
    escalated: number;
    resolved: number;
    dismissed: number;
  };
  topScannedMedicines: Array<{ name: string; count: number }>;
  recentReports: ReportAdminRow[];
}
