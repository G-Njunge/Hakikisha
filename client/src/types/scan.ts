export type ScanResultCode = "authentic" | "counterfeit" | "expired" | "unknown";

export interface ScanHistoryItem {
  id: string;
  barcode: string | null;
  medicineId: string | null;
  medicineName: string | null;
  result: ScanResultCode;
  scannedAt: string;
}
