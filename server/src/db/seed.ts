import dotenv from "dotenv";
import { Pool } from "pg";
import { sslConfigFor } from "./sslConfig";

dotenv.config();

type RegulatoryBody = "NAFDAC" | "KEBS" | "SAHPRA" | "Rwanda FDA";
type ApprovalStatus = "approved" | "pending" | "rejected" | "expired";

interface MedicineSeed {
  name: string;
  genericName: string | null;
  manufacturer: string;
  dosageForm: string;
  strength: string | null;
  regulatoryBody: RegulatoryBody;
  approvalNumber: string;
  approvalStatus: ApprovalStatus;
  // Real-world barcode, used verbatim instead of a generated one — for
  // medicines where the actual GS1 barcode is known rather than fabricated.
  barcode?: string;
}

// GS1 country prefixes used for African pharma markets, one per regulator
// so generated barcodes look plausible for the medicine's country of approval.
const GS1_PREFIX: Record<RegulatoryBody, string> = {
  NAFDAC: "615", // Nigeria
  KEBS: "616", // Kenya
  SAHPRA: "600", // South Africa
  "Rwanda FDA": "632", // Rwanda
};

function ean13CheckDigit(digits12: string): number {
  const sum = digits12
    .split("")
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function makeBarcode(regulatoryBody: RegulatoryBody, seq: number): string {
  const prefix = GS1_PREFIX[regulatoryBody];
  const body = prefix + seq.toString().padStart(12 - prefix.length, "0");
  return body + ean13CheckDigit(body);
}

const medicines: MedicineSeed[] = [
  { name: "Coartem", genericName: "Artemether-Lumefantrine", manufacturer: "Novartis", dosageForm: "tablet", strength: "20/120mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1001", approvalStatus: "approved" },
  { name: "Amoxil", genericName: "Amoxicillin", manufacturer: "Emzor Pharmaceuticals", dosageForm: "capsule", strength: "500mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1002", approvalStatus: "approved" },
  { name: "Panadol", genericName: "Paracetamol", manufacturer: "Fidson Healthcare", dosageForm: "tablet", strength: "500mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1003", approvalStatus: "approved" },
  { name: "Septrin", genericName: "Cotrimoxazole", manufacturer: "May & Baker Nigeria", dosageForm: "tablet", strength: "480mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1004", approvalStatus: "approved" },
  { name: "Glucophage", genericName: "Metformin", manufacturer: "Cipla", dosageForm: "tablet", strength: "500mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2001", approvalStatus: "approved" },
  { name: "Ciprotab", genericName: "Ciprofloxacin", manufacturer: "Universal Corporation", dosageForm: "tablet", strength: "500mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2002", approvalStatus: "approved" },
  { name: "Vibramycin", genericName: "Doxycycline", manufacturer: "Cosmos Pharmaceuticals", dosageForm: "capsule", strength: "100mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2003", approvalStatus: "pending" },
  { name: "Hydrasol", genericName: "Oral Rehydration Salts", manufacturer: "Dawa Limited", dosageForm: "sachet", strength: null, regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2004", approvalStatus: "approved" },
  { name: "Lumartem", genericName: "Artemether-Lumefantrine", manufacturer: "Beta Healthcare", dosageForm: "tablet", strength: "20/120mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2005", approvalStatus: "approved" },
  { name: "Lipitor", genericName: "Atorvastatin", manufacturer: "Aspen Pharmacare", dosageForm: "tablet", strength: "20mg", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3001/01", approvalStatus: "approved" },
  { name: "Flagyl", genericName: "Metronidazole", manufacturer: "Adcock Ingram", dosageForm: "tablet", strength: "400mg", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3002/01", approvalStatus: "approved" },
  { name: "Voltaren", genericName: "Diclofenac", manufacturer: "Pharma Dynamics", dosageForm: "tablet", strength: "50mg", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3003/01", approvalStatus: "approved" },
  { name: "Brufen", genericName: "Ibuprofen", manufacturer: "Cipla South Africa", dosageForm: "tablet", strength: "400mg", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3004/01", approvalStatus: "approved" },
  { name: "Losec", genericName: "Omeprazole", manufacturer: "Fidson Healthcare", dosageForm: "capsule", strength: "20mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1005", approvalStatus: "approved" },
  { name: "Norvasc", genericName: "Amlodipine", manufacturer: "Emzor Pharmaceuticals", dosageForm: "tablet", strength: "5mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1006", approvalStatus: "approved" },
  { name: "Cozaar", genericName: "Losartan", manufacturer: "May & Baker Nigeria", dosageForm: "tablet", strength: "50mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1007", approvalStatus: "expired" },
  { name: "Microzide", genericName: "Hydrochlorothiazide", manufacturer: "Greenlife Pharmaceuticals", dosageForm: "tablet", strength: "25mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1008", approvalStatus: "approved" },
  { name: "Piriton", genericName: "Chlorpheniramine", manufacturer: "Elys Chemical Industries", dosageForm: "tablet", strength: "4mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2006", approvalStatus: "approved" },
  { name: "Ventolin", genericName: "Salbutamol", manufacturer: "Laboratory and Allied Ltd", dosageForm: "inhaler", strength: "100mcg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2007", approvalStatus: "approved" },
  { name: "Folicare", genericName: "Folic Acid", manufacturer: "Cosmos Pharmaceuticals", dosageForm: "tablet", strength: "5mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2008", approvalStatus: "approved" },
  { name: "Ferrofol", genericName: "Ferrous Sulphate", manufacturer: "Dawa Limited", dosageForm: "tablet", strength: "200mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2009", approvalStatus: "approved" },
  { name: "Vitasyrup", genericName: "Multivitamin", manufacturer: "Beta Healthcare", dosageForm: "syrup", strength: null, regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2010", approvalStatus: "pending" },
  { name: "Zincade", genericName: "Zinc Sulphate", manufacturer: "Universal Corporation", dosageForm: "tablet", strength: "20mg", regulatoryBody: "KEBS", approvalNumber: "KEBS/PPB/2011", approvalStatus: "approved" },
  { name: "Redoxon", genericName: "Vitamin C", manufacturer: "Aspen Pharmacare", dosageForm: "tablet", strength: "100mg", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3005/01", approvalStatus: "approved" },
  { name: "Quinex", genericName: "Quinine Sulphate", manufacturer: "Adcock Ingram", dosageForm: "tablet", strength: "300mg", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3006/01", approvalStatus: "approved" },
  { name: "Fansidar", genericName: "Sulfadoxine-Pyrimethamine", manufacturer: "Pharma Dynamics", dosageForm: "tablet", strength: "500/25mg", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3007/01", approvalStatus: "approved" },
  { name: "Terramycin", genericName: "Tetracycline", manufacturer: "Cipla South Africa", dosageForm: "ointment", strength: "1%", regulatoryBody: "SAHPRA", approvalNumber: "SAHPRA/3008/01", approvalStatus: "rejected" },
  { name: "Gaviscon", genericName: "Magnesium Trisilicate", manufacturer: "Fidson Healthcare", dosageForm: "tablet", strength: "500mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1009", approvalStatus: "approved" },
  { name: "Valium", genericName: "Diazepam", manufacturer: "Emzor Pharmaceuticals", dosageForm: "tablet", strength: "5mg", regulatoryBody: "NAFDAC", approvalNumber: "A4-1010", approvalStatus: "approved" },
  { name: "Actrapid", genericName: "Insulin Human Soluble", manufacturer: "Novo Nordisk", dosageForm: "injection", strength: "100IU/ml", regulatoryBody: "NAFDAC", approvalNumber: "A4-1011", approvalStatus: "approved" },
  // Real product: Rwanda FDA publishes an official SmPC for this exact
  // medicine (both tablet and oral-solution forms) — the first Rwanda-FDA
  // regulated entry in this dataset. Barcode is Gamalate B6's real GS1
  // barcode (verified valid EAN-13 check digit), not generated.
  { name: "Gamalate B6", genericName: "Magnesium Glutamate Hydrobromide + GABA + GABOB + Pyridoxine (Vitamin B6)", manufacturer: "Ferrer Internacional, S.A.", dosageForm: "tablet", strength: "75mg/75mg/37mg/37mg", regulatoryBody: "Rwanda FDA", approvalNumber: "RwandaFDA/2024/0113", approvalStatus: "approved", barcode: "8433042001438" },
];

// Generic, dosage-form-aware verification guidance. Real per-medicine visual
// specifics (exact packaging colour, logo placement, etc.) must come from
// each manufacturer's official artwork before this goes to production —
// these placeholders exist so the new scan flow has something to render.
const FORM_SPECIFIC_CHECK: Record<string, string> = {
  tablet: "Tablets/caplets uniform in colour, shape and imprint",
  caplet: "Tablets/caplets uniform in colour, shape and imprint",
  capsule: "Capsules uniform in colour and free of leakage",
  syrup: "Tamper-evident bottle cap seal unbroken",
  sachet: "Sachet seal unbroken, no tears or re-gluing",
  inhaler: "Canister nozzle cap intact, dose counter (if any) functional",
  injection: "Vial/ampoule seal unbroken, solution clear and particle-free",
  ointment: "Tube seal intact and unpunctured at the nozzle",
};

function packageVerificationItems(dosageForm: string): string[] {
  const formCheck = FORM_SPECIFIC_CHECK[dosageForm.toLowerCase()] ?? "Packaging matches the manufacturer's official design";
  return [
    "Packaging colours and print quality match the official design",
    formCheck,
    "Hologram or security seal present and not peeling",
    "Batch number and expiry date are laser-printed, not smudged or re-printed",
    "Patient information leaflet included",
    "Foil/blister seal intact with no puncture marks",
  ];
}

const SAFETY_COMPARISON_ITEMS = ["Logo position", "Colours", "Hologram", "Batch printing", "Expiry printing"];

interface PharmacySeed {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  // Placeholder opening hours, not scraped/verified real data — a consistent
  // "<Daily|Xxx-Yyy> HH:MM-HH:MM" format so lib/pharmacyHours.ts can parse it.
  hours: string;
  country: string;
}

const pharmacies: PharmacySeed[] = [
  { name: "MedPlus Pharmacy - Ikeja", address: "45 Allen Avenue, Ikeja, Lagos, Nigeria", latitude: 6.6018, longitude: 3.3515, phone: "+234-1-2716842", hours: "Daily 08:00-22:00", country: "Nigeria" },
  { name: "HealthPlus Pharmacy - Victoria Island", address: "270B Ozumba Mbadiwe Ave, Victoria Island, Lagos, Nigeria", latitude: 6.4281, longitude: 3.4219, phone: "+234-1-2703030", hours: "Daily 08:00-22:00", country: "Nigeria" },
  { name: "Alpha Pharmacy - Wuse", address: "Plot 123 Aminu Kano Crescent, Wuse 2, Abuja, Nigeria", latitude: 9.0817, longitude: 7.4875, phone: "+234-9-2345678", hours: "Mon-Sat 08:00-21:00", country: "Nigeria" },
  { name: "Goodlife Pharmacy - Westlands", address: "Sarit Centre, Westlands, Nairobi, Kenya", latitude: -1.2634, longitude: 36.8047, phone: "+254-20-4451234", hours: "Daily 08:00-21:00", country: "Kenya" },
  { name: "Mydawa Pharmacy - CBD", address: "Kimathi Street, Nairobi, Kenya", latitude: -1.2833, longitude: 36.8236, phone: "+254-20-2224455", hours: "Mon-Sat 08:00-20:00", country: "Kenya" },
  { name: "Clicks Pharmacy - Sandton", address: "Sandton City Mall, Sandton, Johannesburg, South Africa", latitude: -26.1076, longitude: 28.0567, phone: "+27-11-7834567", hours: "Daily 09:00-21:00", country: "South Africa" },
  { name: "Dis-Chem Pharmacy - Rosebank", address: "The Zone, Rosebank, Johannesburg, South Africa", latitude: -26.1467, longitude: 28.0436, phone: "+27-11-4471234", hours: "Daily 09:00-21:00", country: "South Africa" },

  // Kigali, Rwanda. Real, currently-operating pharmacies sourced from Rwanda
  // FDA's licensed-retail-pharmacy lists and public business directories
  // (names/sectors verified; coordinates are neighbourhood-level
  // approximations from known Kigali geography, not surveyed GPS pins —
  // same precision level as the pharmacies above. Spot-check before relying
  // on them for turn-by-turn navigation). Opening hours are placeholders too.
  { name: "Pharmasave Ltd", address: "Kamatamu, Kacyiru, Gasabo, Kigali, Rwanda", latitude: -1.9331, longitude: 30.0902, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Prayer Pharmacy Ltd", address: "Kibaza, Kacyiru, Gasabo, Kigali, Rwanda", latitude: -1.9344, longitude: 30.0916, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Zoe Pharmacy Ltd", address: "Kimihurura, Gasabo, Kigali, Rwanda", latitude: -1.9430, longitude: 30.0951, phone: null, hours: "Mon-Sat 07:30-19:30", country: "Rwanda" },
  { name: "Pharma Best Ltd", address: "Rukiri II, Remera, Gasabo, Kigali, Rwanda", latitude: -1.9524, longitude: 30.1058, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Pharmacie Continentale", address: "Rukiri I, Kisimenti, Remera, Gasabo, Kigali, Rwanda", latitude: -1.9508, longitude: 30.1044, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Pharmacie La Reference Ltd", address: "Rukiri I, Gisimenti, Remera, Gasabo, Kigali, Rwanda", latitude: -1.9512, longitude: 30.1036, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Pharmacie Teta Remera", address: "Rukiri I, Remera, Gasabo, Kigali, Rwanda", latitude: -1.9500, longitude: 30.1050, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Vine Pharmacy - Kisimenti Branch", address: "KG 4 Ave, Chez Lando Roundabout, Remera, Gasabo, Kigali, Rwanda", latitude: -1.9506, longitude: 30.1040, phone: "+250-780-303-573", hours: "Daily 07:00-22:00", country: "Rwanda" },
  { name: "Vine Pharmacy - Kigali Heights Branch", address: "KG 7 Ave, Kigali Heights, Kimihurura, Gasabo, Kigali, Rwanda", latitude: -1.9447, longitude: 30.0937, phone: "+250-780-303-574", hours: "Daily 07:00-22:00", country: "Rwanda" },
  { name: "Vine Pharmacy - Gacuriro Branch", address: "KG 9 Ave, Gacuriro, Gasabo, Kigali, Rwanda", latitude: -1.9230, longitude: 30.1010, phone: "+250-788-350-245", hours: "Daily 07:00-22:00", country: "Rwanda" },
  { name: "Dorah Pharmacy Ltd", address: "Kagugu, Kinyinya, Gasabo, Kigali, Rwanda", latitude: -1.9146, longitude: 30.0844, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Medplus Pharmacy Ltd - Gisozi Branch", address: "Ruhango, Gisozi, Gasabo, Kigali, Rwanda", latitude: -1.9352, longitude: 30.0552, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Fina Pharmacy Ltd", address: "Kibagabaga, Kimironko, Gasabo, Kigali, Rwanda", latitude: -1.9438, longitude: 30.1248, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Ellis Pharmacy Ltd", address: "Munezero, Gisozi, Gasabo, Kigali, Rwanda", latitude: -1.9337, longitude: 30.0567, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Dove Pharmacy Ltd", address: "Gakinjiro, Gisozi, Gasabo, Kigali, Rwanda", latitude: -1.9364, longitude: 30.0538, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Chappedeline Pharmacy Ltd", address: "Karama, Kinyinya, Gasabo, Kigali, Rwanda", latitude: -1.9128, longitude: 30.0868, phone: null, hours: "Mon-Fri 08:00-18:00", country: "Rwanda" },
  { name: "Curantur Ltd", address: "Murama, Kinyinya, Gasabo, Kigali, Rwanda", latitude: -1.9172, longitude: 30.0821, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Declauphar Ltd", address: "Kagugu, Kinyinya, Gasabo, Kigali, Rwanda", latitude: -1.9160, longitude: 30.0857, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Goodlife Pharmacy - Kimironko Branch", address: "Across Igihozo Supermarket, Kimironko, Gasabo, Kigali, Rwanda", latitude: -1.9452, longitude: 30.1262, phone: null, hours: "Daily 08:00-21:00", country: "Rwanda" },
  { name: "Goodlife Pharmacy - Gisozi Branch", address: "KG 14 Ave, Gisozi, Gasabo, Kigali, Rwanda", latitude: -1.9339, longitude: 30.0561, phone: null, hours: "Daily 08:00-21:00", country: "Rwanda" },
  { name: "Segilt Rx Clinic Pharmacy Limited", address: "Niboye, Kicukiro, Kigali, Rwanda", latitude: -1.9718, longitude: 30.1142, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Semu Pharmacy Ltd", address: "Niboye, Kicukiro, Kigali, Rwanda", latitude: -1.9732, longitude: 30.1158, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Vita Gratia Pharmacy Ltd", address: "Niboye, Kicukiro, Kigali, Rwanda", latitude: -1.9709, longitude: 30.1163, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Memia's Pharmacy Ltd", address: "Niboye, Kicukiro, Kigali, Rwanda", latitude: -1.9725, longitude: 30.1129, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Regopharma Limited", address: "Kanombe, Kicukiro, Kigali, Rwanda", latitude: -1.9686, longitude: 30.1395, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Aviel Pharmacy Ltd", address: "Kanombe, Kicukiro, Kigali, Rwanda", latitude: -1.9701, longitude: 30.1412, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Unipharma B3", address: "Kanombe, Kicukiro, Kigali, Rwanda", latitude: -1.9673, longitude: 30.1378, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Top Pharmacy Ltd", address: "Kanombe, Kicukiro, Kigali, Rwanda", latitude: -1.9668, longitude: 30.1421, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Welcome Pharmacy Ltd", address: "Kanombe, Kicukiro, Kigali, Rwanda", latitude: -1.9709, longitude: 30.1367, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Meniphar Ltd", address: "Kanombe, Kicukiro, Kigali, Rwanda", latitude: -1.9694, longitude: 30.1439, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "Shoppers Pharmaplus Ltd", address: "Gikondo, Kicukiro, Kigali, Rwanda", latitude: -1.9707, longitude: 30.0755, phone: null, hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Adrenaline Pharmacy Ltd", address: "Kabeza Modern Market, Kanombe, Kicukiro, Kigali, Rwanda", latitude: -1.9652, longitude: 30.1358, phone: null, hours: "Daily 08:00-21:00", country: "Rwanda" },
  { name: "Pharmacie Conseil - Chadel Building", address: "KN 78 Street, Nyarugenge, Kigali, Rwanda", latitude: -1.9463, longitude: 30.0601, phone: "+250-788-380-066", hours: "Daily 07:00-22:00", country: "Rwanda" },
  { name: "Pharmacie Conseil - Prester Building", address: "KG 541 Street, Nyarugenge, Kigali, Rwanda", latitude: -1.9418, longitude: 30.0642, phone: "+250-788-381-259", hours: "Daily 07:00-22:00", country: "Rwanda" },
  { name: "Pharmacie Conseil - KG 383 Branch", address: "KG 383 Street, Nyarugenge, Kigali, Rwanda", latitude: -1.9455, longitude: 30.0587, phone: "+250-781-928-457", hours: "Daily 07:00-22:00", country: "Rwanda" },
  { name: "Kipharma", address: "KN 74 Street, Nyarugenge, Kigali, Rwanda", latitude: -1.9441, longitude: 30.0619, phone: "+250-252-572-944", hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Pharmacie IRIS", address: "Avenue du Commerce, Nyarugenge, Kigali, Rwanda", latitude: -1.9469, longitude: 30.0596, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
  { name: "PharmaLab Ltd", address: "KN 59 Street, Nyarugenge, Kigali, Rwanda", latitude: -1.9481, longitude: 30.0625, phone: "+250-788-477-537", hours: "Mon-Sat 08:00-20:00", country: "Rwanda" },
  { name: "Pro Vita Pharmacy Ltd", address: "Kivugiza, Nyamirambo, Nyarugenge, Kigali, Rwanda", latitude: -1.9706, longitude: 30.0398, phone: null, hours: "Mon-Sat 08:00-19:00", country: "Rwanda" },
];

// Which regulator(s)' approved medicines a pharmacy in this country plausibly
// stocks — reuses the country<->regulatory_body pairing the medicines seed
// already has, rather than inventing a separate per-medicine stock list.
// Rwanda has no *dedicated* NAFDAC/KEBS/SAHPRA regulator in this dataset, so
// its pharmacies are additionally modeled as stocking the full pan-regional
// catalogue on top of Rwanda FDA's own — realistic for a market that imports
// rather than manufactures most of its registered medicines. Nigeria/Kenya/
// South Africa are deliberately left NOT stocking Rwanda-FDA medicines —
// those are Rwanda-market products, unlike the pan-regional catalogue.
const COUNTRY_TO_REGULATORS: Record<string, RegulatoryBody[]> = {
  Nigeria: ["NAFDAC"],
  Kenya: ["KEBS"],
  "South Africa": ["SAHPRA"],
  Rwanda: ["NAFDAC", "KEBS", "SAHPRA", "Rwanda FDA"],
};

// A pharmacy stocking every regulator-eligible medicine (the old behaviour)
// meant every Kigali pharmacy stocked literally all 31 medicines — real
// pharmacies carry a subset, and different pharmacies carry different ones.
// djb2 string hash, deterministic per (pharmacy, medicine) pair — reseeding
// reproduces the exact same stock list every time (no Math.random()), while
// still varying which specific medicines each pharmacy carries.
function djb2Hash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return hash >>> 0;
}

const STOCK_PROBABILITY = 0.6; // ~60% of eligible medicines per pharmacy

function pharmacyStocksMedicine(pharmacyName: string, medicineId: string): boolean {
  return djb2Hash(`${pharmacyName}::${medicineId}`) % 100 < STOCK_PROBABILITY * 100;
}

interface HealthAuthoritySeed {
  country: string;
  authorityName: string;
  email: string;
}

// Demo addresses only — hakikisha-demo.com isn't a real registered domain, so
// these are for exercising the report-alert flow, not actual delivery.
// Rwanda is the exception: routed to the developer's own Resend-verified
// address so report-alert emails can actually be received end-to-end while
// this account is on Resend's sandbox sending tier (which only delivers to
// the account owner's own address).
const healthAuthorities: HealthAuthoritySeed[] = [
  { country: "Nigeria", authorityName: "NAFDAC", email: "nafdac@hakikisha-demo.com" },
  { country: "Kenya", authorityName: "KEBS", email: "kebs@hakikisha-demo.com" },
  { country: "South Africa", authorityName: "SAHPRA", email: "sahpra@hakikisha-demo.com" },
  { country: "Rwanda", authorityName: "Rwanda FDA", email: "g.njunge@alustudent.com" },
  { country: "Ghana", authorityName: "FDA Ghana", email: "fdaghana@hakikisha-demo.com" },
];

// Real product photos, uploaded and mapped by hand — not every medicine has
// both (or either); a missing entry means that angle is intentionally left
// unset rather than filled with a placeholder (the UI treats "no tablet
// photo" as "show package only", not as an error state).
const MEDICINE_PHOTOS: Record<string, { tablet?: string; package?: string }> = {
  Amoxil: { tablet: "/assets/medicines/amoxil-tablet.jpeg" },
  Brufen: { package: "/assets/medicines/brufen-package.jpeg" },
  Ciprotab: { tablet: "/assets/medicines/ciprotab-tablet.jpeg", package: "/assets/medicines/ciprotab-package.jpeg" },
  Cozaar: { package: "/assets/medicines/cozaar-package.jpeg" },
  Fansidar: { package: "/assets/medicines/fansidar-package.jpeg" },
  Ferrofol: { tablet: "/assets/medicines/ferrofol-tablet.jpeg", package: "/assets/medicines/ferrofol-package.jpeg" },
  Flagyl: { package: "/assets/medicines/flagyl-package.jpeg" },
  Folicare: { tablet: "/assets/medicines/folicare-tablet.jpeg", package: "/assets/medicines/folicare-package.jpeg" },
  // Combined tablet+package shot (matches the p+t_ convention used above),
  // filed under package per that same rule.
  "Gamalate B6": { package: "/assets/medicines/gamalate-b6-package.jpeg" },
  Gaviscon: { package: "/assets/medicines/gaviscon-package.jpeg" },
  Glucophage: { tablet: "/assets/medicines/glucophage-tablet.jpeg", package: "/assets/medicines/glucophage-package.jpeg" },
  Lipitor: { package: "/assets/medicines/lipitor-package.jpeg" },
  Losec: { package: "/assets/medicines/losec-package.jpeg" },
  Lumartem: { tablet: "/assets/medicines/lumartem-tablet.jpeg", package: "/assets/medicines/lumartem-package.jpeg" },
  Microzide: { package: "/assets/medicines/microzide-package.jpeg" },
  Norvasc: { package: "/assets/medicines/norvasc-package.jpeg" },
  Panadol: { tablet: "/assets/medicines/panadol-tablet.jpeg", package: "/assets/medicines/panadol-package.jpeg" },
  Piriton: { tablet: "/assets/medicines/piriton-tablet.jpeg", package: "/assets/medicines/piriton-package.jpeg" },
  Quinex: { package: "/assets/medicines/quinex-package.jpeg" },
  Redoxon: { package: "/assets/medicines/redoxon-package.jpeg" },
  Septrin: { package: "/assets/medicines/septrin-package.jpeg" },
  Terramycin: { package: "/assets/medicines/terramycin-package.jpeg" },
  Valium: { package: "/assets/medicines/valium-package.jpeg" },
  // p_Ventolin.jpeg (package-only) also existed for this one but was left
  // unused — p+t_Ventolin.jpeg (both angles in one photo) takes the package
  // slot per the decision to prefer it when both exist.
  Ventolin: { tablet: "/assets/medicines/ventolin-tablet.jpeg", package: "/assets/medicines/ventolin-package.jpeg" },
  Vibramycin: { package: "/assets/medicines/vibramycin-package.jpeg" },
  Vitasyrup: { package: "/assets/medicines/vitasyrup-package.jpeg" },
  Voltaren: { package: "/assets/medicines/voltaren-package.jpeg" },
  Zincade: { tablet: "/assets/medicines/zincade-tablet.jpg", package: "/assets/medicines/zincade-package.jpeg" },
  // Actrapid, Coartem, Hydrasol: no uploaded photos — both angles absent.
};

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfigFor(process.env.DATABASE_URL),
  });

  try {
    const regulatorSeq: Record<RegulatoryBody, number> = { NAFDAC: 0, KEBS: 0, SAHPRA: 0, "Rwanda FDA": 0 };
    const medicineIdsByRegulator: Record<RegulatoryBody, string[]> = { NAFDAC: [], KEBS: [], SAHPRA: [], "Rwanda FDA": [] };

    for (const medicine of medicines) {
      regulatorSeq[medicine.regulatoryBody] += 1;
      // Use the real barcode when one is on file; only fabricate a
      // plausible one for medicines whose actual GS1 code isn't known.
      const barcode = medicine.barcode ?? makeBarcode(medicine.regulatoryBody, regulatorSeq[medicine.regulatoryBody]);

      const { rows: medicineRows } = await pool.query<{ id: string }>(
        `INSERT INTO medicines
          (name, generic_name, manufacturer, dosage_form, strength, barcode, regulatory_body, approval_number, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (barcode) DO UPDATE SET
           name = EXCLUDED.name,
           generic_name = EXCLUDED.generic_name,
           manufacturer = EXCLUDED.manufacturer,
           dosage_form = EXCLUDED.dosage_form,
           strength = EXCLUDED.strength,
           regulatory_body = EXCLUDED.regulatory_body,
           approval_number = EXCLUDED.approval_number,
           approval_status = EXCLUDED.approval_status,
           updated_at = now()
         RETURNING id`,
        [
          medicine.name,
          medicine.genericName,
          medicine.manufacturer,
          medicine.dosageForm,
          medicine.strength,
          barcode,
          medicine.regulatoryBody,
          medicine.approvalNumber,
          medicine.approvalStatus,
        ]
      );
      const medicineId = medicineRows[0].id;
      medicineIdsByRegulator[medicine.regulatoryBody].push(medicineId);

      const photoPaths = MEDICINE_PHOTOS[medicine.name] ?? {};
      for (const angle of ["tablet", "package"] as const) {
        const imageUrl = photoPaths[angle];
        if (imageUrl) {
          await pool.query(
            `INSERT INTO medicine_photos (medicine_id, angle, image_url)
             VALUES ($1, $2, $3)
             ON CONFLICT (medicine_id, angle) DO UPDATE SET image_url = EXCLUDED.image_url`,
            [medicineId, angle, imageUrl]
          );
        } else {
          // No real photo for this angle — delete rather than leave a stale
          // placeholder row from before this switched away from generated
          // placeholders (re-running seed against an already-seeded DB).
          await pool.query(`DELETE FROM medicine_photos WHERE medicine_id = $1 AND angle = $2`, [medicineId, angle]);
        }
      }

      const packageItems = packageVerificationItems(medicine.dosageForm);
      for (const [index, label] of packageItems.entries()) {
        await pool.query(
          `INSERT INTO verification_checklist_items (medicine_id, section, label, display_order)
           VALUES ($1, 'package_verification', $2, $3)
           ON CONFLICT (medicine_id, section, label) DO UPDATE SET display_order = EXCLUDED.display_order`,
          [medicineId, label, index]
        );
      }

      for (const [index, label] of SAFETY_COMPARISON_ITEMS.entries()) {
        await pool.query(
          `INSERT INTO verification_checklist_items (medicine_id, section, label, display_order)
           VALUES ($1, 'safety_comparison', $2, $3)
           ON CONFLICT (medicine_id, section, label) DO UPDATE SET display_order = EXCLUDED.display_order`,
          [medicineId, label, index]
        );
      }
    }

    let stockLinksCreated = 0;

    for (const pharmacy of pharmacies) {
      const { rows: pharmacyRows } = await pool.query<{ id: string }>(
        `INSERT INTO pharmacies (name, address, latitude, longitude, phone, hours)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name, address) DO UPDATE SET
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           phone = EXCLUDED.phone,
           hours = EXCLUDED.hours
         RETURNING id`,
        [pharmacy.name, pharmacy.address, pharmacy.latitude, pharmacy.longitude, pharmacy.phone, pharmacy.hours]
      );
      const pharmacyId = pharmacyRows[0].id;

      // Wholesale delete-then-reinsert rather than diffing — this table is
      // fully derived from the logic below, so a reseed should always leave
      // it exactly matching whatever that logic currently computes, not a
      // union of every version that's ever run.
      await pool.query(`DELETE FROM pharmacy_medicine_stock WHERE pharmacy_id = $1`, [pharmacyId]);

      const regulators = COUNTRY_TO_REGULATORS[pharmacy.country] ?? [];
      const eligibleMedicineIds = regulators.flatMap((regulator) => medicineIdsByRegulator[regulator]);
      const stockedMedicineIds = eligibleMedicineIds.filter((medicineId) =>
        pharmacyStocksMedicine(pharmacy.name, medicineId)
      );

      for (const medicineId of stockedMedicineIds) {
        await pool.query(
          `INSERT INTO pharmacy_medicine_stock (pharmacy_id, medicine_id)
           VALUES ($1, $2)
           ON CONFLICT (pharmacy_id, medicine_id) DO NOTHING`,
          [pharmacyId, medicineId]
        );
        stockLinksCreated += 1;
      }
    }

    for (const ha of healthAuthorities) {
      await pool.query(
        `INSERT INTO health_authorities (country, authority_name, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (country) DO UPDATE SET
           authority_name = EXCLUDED.authority_name,
           email = EXCLUDED.email`,
        [ha.country, ha.authorityName, ha.email]
      );
    }

    const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM medicines");
    console.log(
      `Seeded ${medicines.length} medicines (with photos + checklists), ${pharmacies.length} pharmacies (${stockLinksCreated} stock links), and ${healthAuthorities.length} health authorities. Table now has ${rows[0].count} rows.`
    );
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
