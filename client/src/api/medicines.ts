import apiClient from "./client";
import type {
  Medicine,
  MedicineSearchResult,
  BarcodeVerificationResult,
  MedicineVerificationProfile,
  NearbyPharmacy,
} from "../types/medicine";

export async function searchMedicines(q: string, page = 1): Promise<MedicineSearchResult> {
  const { data } = await apiClient.get<MedicineSearchResult>("/api/medicines/search", {
    params: { q, page },
  });
  return data;
}

export async function verifyBarcode(
  barcode: string,
  coords?: { lat: number; lng: number }
): Promise<BarcodeVerificationResult> {
  const { data } = await apiClient.get<BarcodeVerificationResult>(`/api/medicines/barcode/${barcode}`, {
    params: coords ? { lat: coords.lat, lng: coords.lng } : undefined,
  });
  return data;
}

export async function getMedicineById(id: string): Promise<Medicine> {
  const { data } = await apiClient.get<{ medicine: Medicine }>(`/api/medicines/${id}`);
  return data.medicine;
}

export async function getMedicineVerificationProfile(id: string): Promise<MedicineVerificationProfile> {
  const { data } = await apiClient.get<MedicineVerificationProfile>(`/api/medicines/${id}/verification`);
  return data;
}

export async function getNearbyPharmacies(lat: number, lng: number): Promise<NearbyPharmacy[]> {
  const { data } = await apiClient.get<{ results: NearbyPharmacy[] }>("/api/pharmacies/nearby", {
    params: { lat, lng },
  });
  return data.results;
}
