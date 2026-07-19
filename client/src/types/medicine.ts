export type ApprovalStatus = "approved" | "pending" | "rejected" | "expired";

export interface Medicine {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string;
  dosageForm: string | null;
  strength: string | null;
  barcode: string;
  regulatoryBody: string;
  approvalNumber: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineSearchResult {
  results: Medicine[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface BarcodeVerificationResult {
  found: boolean;
  message?: string;
  medicine?: Medicine;
  batchNumber?: string;
  expiryDate?: string | null;
  registrationStatus?: string;
  verificationStatus?: string;
}

export interface MedicineVerificationProfile {
  medicine: Medicine;
  photos: {
    front: string | null;
    back: string | null;
  };
  packageVerification: string[];
  safetyComparison: string[];
}

export interface NearbyPharmacy {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  distanceKm: number;
}

export type ScanStatus = "VERIFIED" | "UNVERIFIED";

export interface ScanResult {
  status: ScanStatus;
  medicine: {
    id: string;
    name: string;
    manufacturer: string;
    approvalStatus: ApprovalStatus;
  } | null;
  batchNumber: string | null;
  message?: string;
}
