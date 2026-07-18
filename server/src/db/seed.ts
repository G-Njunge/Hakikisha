import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

type RegulatoryBody = "NAFDAC" | "KEBS" | "SAHPRA";
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
}

// GS1 country prefixes used for African pharma markets, one per regulator
// so generated barcodes look plausible for the medicine's country of approval.
const GS1_PREFIX: Record<RegulatoryBody, string> = {
  NAFDAC: "615", // Nigeria
  KEBS: "616", // Kenya
  SAHPRA: "600", // South Africa
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
  phone: string;
}

const pharmacies: PharmacySeed[] = [
  { name: "MedPlus Pharmacy - Ikeja", address: "45 Allen Avenue, Ikeja, Lagos, Nigeria", latitude: 6.6018, longitude: 3.3515, phone: "+234-1-2716842" },
  { name: "HealthPlus Pharmacy - Victoria Island", address: "270B Ozumba Mbadiwe Ave, Victoria Island, Lagos, Nigeria", latitude: 6.4281, longitude: 3.4219, phone: "+234-1-2703030" },
  { name: "Alpha Pharmacy - Wuse", address: "Plot 123 Aminu Kano Crescent, Wuse 2, Abuja, Nigeria", latitude: 9.0817, longitude: 7.4875, phone: "+234-9-2345678" },
  { name: "Goodlife Pharmacy - Westlands", address: "Sarit Centre, Westlands, Nairobi, Kenya", latitude: -1.2634, longitude: 36.8047, phone: "+254-20-4451234" },
  { name: "Mydawa Pharmacy - CBD", address: "Kimathi Street, Nairobi, Kenya", latitude: -1.2833, longitude: 36.8236, phone: "+254-20-2224455" },
  { name: "Clicks Pharmacy - Sandton", address: "Sandton City Mall, Sandton, Johannesburg, South Africa", latitude: -26.1076, longitude: 28.0567, phone: "+27-11-7834567" },
  { name: "Dis-Chem Pharmacy - Rosebank", address: "The Zone, Rosebank, Johannesburg, South Africa", latitude: -26.1467, longitude: 28.0436, phone: "+27-11-4471234" },
];

function placeholderPhotoUrl(medicineName: string, angle: "front" | "back"): string {
  const label = encodeURIComponent(`${medicineName} - ${angle}`);
  return `https://placehold.co/400x600?text=${label}`;
}

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const regulatorSeq: Record<RegulatoryBody, number> = { NAFDAC: 0, KEBS: 0, SAHPRA: 0 };

    for (const medicine of medicines) {
      regulatorSeq[medicine.regulatoryBody] += 1;
      const barcode = makeBarcode(medicine.regulatoryBody, regulatorSeq[medicine.regulatoryBody]);

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

      for (const angle of ["front", "back"] as const) {
        await pool.query(
          `INSERT INTO medicine_photos (medicine_id, angle, image_url)
           VALUES ($1, $2, $3)
           ON CONFLICT (medicine_id, angle) DO UPDATE SET image_url = EXCLUDED.image_url`,
          [medicineId, angle, placeholderPhotoUrl(medicine.name, angle)]
        );
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

    for (const pharmacy of pharmacies) {
      await pool.query(
        `INSERT INTO pharmacies (name, address, latitude, longitude, phone)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name, address) DO UPDATE SET
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           phone = EXCLUDED.phone`,
        [pharmacy.name, pharmacy.address, pharmacy.latitude, pharmacy.longitude, pharmacy.phone]
      );
    }

    const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM medicines");
    console.log(`Seeded ${medicines.length} medicines (with photos + checklists) and ${pharmacies.length} pharmacies. Table now has ${rows[0].count} rows.`);
  } finally {
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
