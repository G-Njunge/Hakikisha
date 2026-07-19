-- Hakikisha database schema
-- Medicine authenticity verification: manufacturers register medicines and
-- production batches, users scan batches to verify authenticity, and
-- suspicious scans can be escalated into reports.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'manufacturer', 'pharmacist', 'consumer');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    country VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'consumer',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    manufacturer VARCHAR(255) NOT NULL,
    dosage_form VARCHAR(100),
    strength VARCHAR(100),
    barcode VARCHAR(13) NOT NULL UNIQUE CHECK (barcode ~ '^[0-9]{8,13}$'),
    regulatory_body VARCHAR(20) NOT NULL,
    approval_number VARCHAR(50) NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'pending', 'rejected', 'expired')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE batch_status AS ENUM ('active', 'recalled', 'expired');

CREATE TABLE batch_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    batch_number VARCHAR(100) NOT NULL,
    manufacture_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    quantity_produced INTEGER NOT NULL CHECK (quantity_produced >= 0),
    qr_code_hash VARCHAR(255) NOT NULL UNIQUE,
    status batch_status NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (medicine_id, batch_number),
    CHECK (expiry_date > manufacture_date)
);

CREATE TYPE scan_result AS ENUM ('authentic', 'counterfeit', 'expired', 'unknown');

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_record_id UUID REFERENCES batch_records(id) ON DELETE SET NULL,
    scanned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    result scan_result NOT NULL,
    location VARCHAR(255),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE report_status AS ENUM ('pending', 'investigating', 'resolved', 'dismissed');

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    product_name VARCHAR(255),
    description TEXT NOT NULL,
    purchase_location VARCHAR(255),
    -- Interim storage as a base64 data URL; swap for a real object-storage URL
    -- (Railway volume / S3 / etc.) before this handles real traffic.
    photo_url TEXT,
    status report_status NOT NULL DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (scan_id IS NOT NULL OR product_name IS NOT NULL)
);

CREATE TYPE photo_angle AS ENUM ('front', 'back');

CREATE TABLE medicine_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    angle photo_angle NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (medicine_id, angle)
);

CREATE TYPE checklist_section AS ENUM ('package_verification', 'safety_comparison');

-- Powers two screens in the post-scan flow from the same table:
-- 'package_verification' -> "How to Identify a Genuine Package" (✓ list)
-- 'safety_comparison'    -> "Things to Compare" (☐ list)
CREATE TABLE verification_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_id UUID NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
    section checklist_section NOT NULL,
    label VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (medicine_id, section, label)
);

CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, address)
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Blacklist of access tokens invalidated before their natural expiry (e.g. on logout).
-- Rows past expires_at are harmless and can be purged periodically.
CREATE TABLE revoked_access_tokens (
    jti UUID PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_revoked_access_tokens_expires_at ON revoked_access_tokens(expires_at);
CREATE INDEX idx_medicines_created_by ON medicines(created_by);
CREATE INDEX idx_batch_records_medicine_id ON batch_records(medicine_id);
CREATE INDEX idx_scans_batch_record_id ON scans(batch_record_id);
CREATE INDEX idx_scans_scanned_by ON scans(scanned_by);
CREATE INDEX idx_reports_scan_id ON reports(scan_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_reported_by ON reports(reported_by);
CREATE INDEX idx_medicine_photos_medicine_id ON medicine_photos(medicine_id);
CREATE INDEX idx_verification_checklist_items_medicine_id ON verification_checklist_items(medicine_id, section, display_order);
