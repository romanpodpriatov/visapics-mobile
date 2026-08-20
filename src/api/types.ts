/**
 * The shapes the server actually returns.
 *
 * Every type here was read off a live response from https://visapics.org/api/v1
 * or off the handler that builds it, not inferred from what the screens would
 * find convenient. Fields the backend can leave out are optional; fields it
 * sets to null are nullable — the two are different and the result screen has
 * to tell them apart.
 */

// ── GET /config ────────────────────────────────────────────────────────────

export type BundleType = 'single' | 'family' | 'travel';

export type IapProduct = {
  product_id: string;
  bundle_type: BundleType;
  credits: number;
  /** For reconciliation and as a fallback. The price shown comes from StoreKit. */
  price_cents: number;
};

export type Coverage = {
  countries: number;
  specifications: number;
  with_official_source: number;
};

export type Legal = {
  disclaimer: string;
  privacy_url: string;
  terms_url: string;
  support_url: string;
};

export type Config = {
  products: IapProduct[];
  coverage: Coverage;
  /** How long a photo is kept. The consent screen renders this, never a constant. */
  retention_hours: number;
  legal: Legal;
};

// ── POST /auth/device, POST /auth/apple ────────────────────────────────────

export type UserSummary = {
  id: number;
  is_anonymous: boolean;
  email?: string | null;
};

export type SessionTokens = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  refresh_expires_in?: number;
};

export type DeviceRegistration = SessionTokens & {
  user: UserSummary;
  /** false when this device was already known — a reinstall over the same keychain. */
  created: boolean;
};

// ── GET /countries, /specifications ────────────────────────────────────────

export type Country = {
  code: string;
  name: string;
  document_count: number;
};

/**
 * A row of the catalogue. `country_code`/`country_name` come back from
 * /specifications; `official_source`/`notes` come back from
 * /specifications/<country>. Neither endpoint returns all of them.
 */
export type SpecificationSummary = {
  id: number;
  document_type: string;
  background_color: string | null;
  dpi: number;
  photo_width_mm: number;
  photo_height_mm: number;
  head_height_min_mm: number | null;
  head_height_max_mm: number | null;
  head_height_min_percent: number | null;
  head_height_max_percent: number | null;
  eyes_position_from_bottom_mm: number | null;
  eyes_position_max_from_bottom_mm: number | null;
  file_size_min_kb: number | null;
  file_size_max_kb: number | null;
  country_code?: string;
  country_name?: string;
  official_source?: string[] | null;
  notes?: string | null;
};

// ── GET /specifications/<country>/<document> ───────────────────────────────

export type SpecificationRequirements = {
  background_color: string | null;
  head_height_min_percent: number | null;
  head_height_max_percent: number | null;
  head_height_min_mm: number | null;
  head_height_max_mm: number | null;
  eyes_position_from_bottom_mm: number | null;
  eyes_position_max_from_bottom_mm: number | null;
  file_size_min_kb: number | null;
  file_size_max_kb: number | null;
  neutral_expression_required: boolean | null;
  glasses_allowed: string | null;
};

export type Specification = {
  id: number;
  country_code: string;
  country_name: string;
  document_type: string;
  dimensions: { width_mm: number; height_mm: number; dpi: number };
  requirements: SpecificationRequirements;
  official_source: string[] | null;
  /** When the row last changed — the honest version of "verified on <date>". */
  spec_updated_at: string | null;
  is_reviewed: boolean | null;
  notes: string | null;
};

// ── POST /photo/process/async, GET /photo/status/<task> ────────────────────

export type ProcessingMode = 'preview' | 'full';

export type TaskAccepted = {
  task_id: string;
  mode: ProcessingMode;
  status_url: string;
  stream_url: string;
  message: string;
};

export type CheckVerdict = 'pass' | 'fail' | 'not_applicable';

export type ComplianceCheck = {
  key: 'head_height' | 'eye_line' | 'background' | 'resolution' | 'file_size';
  label: string;
  /** A millimetre value, a colour name, or a [width, height] pixel pair. */
  measured: number | string | [number, number] | null;
  measured_display: string;
  requirement_display: string;
  verdict: CheckVerdict;
};

export type Compliance = {
  overall_success: boolean;
  photo_size: string;
  warnings: string[];
  checks: ComplianceCheck[];
  passed: number;
  /** Checks that applied. A rule the document does not state is not counted. */
  total: number;
};

export type TaskStatus =
  | { task_id: string; state: 'PENDING' | 'PROCESSING'; progress: number; status: string }
  | {
      task_id: string;
      state: 'SUCCESS';
      progress: number;
      status: string;
      mode: ProcessingMode;
      specification: { country_code: string; document_type: string };
      compliance: Compliance;
      unlock_required: boolean;
      /** Watermarked, preview mode only. */
      preview_url?: string;
      printable_preview_url?: string;
      /** Clean files, full mode only. */
      digital_photo_url?: string;
      printable_photo_url?: string;
      uk_photo_code?: unknown;
      billing?: unknown;
    };

/** The finished shape, once the task has succeeded. */
export type CompletedTask = Extract<TaskStatus, { state: 'SUCCESS' }>;

// ── POST /photo/<task>/unlock ──────────────────────────────────────────────

export type UnlockResult = {
  task_id: string;
  unlocked: boolean;
  credits_remaining: number;
  /** Signed and short-lived; `expires_in` is seconds. */
  digital_photo_url: string;
  printable_photo_url?: string;
  expires_in: number;
};

/** The body of the 402 that unlock returns when the balance is empty. */
export type NoCreditsError = {
  code: 'E402_NO_CREDITS';
  message: string;
  products: IapProduct[];
};

// ── GET /credits ───────────────────────────────────────────────────────────

export type CreditGrant = {
  id: number;
  bundle_type: string;
  bundle_name: string;
  total_credits: number;
  remaining_credits: number;
  source: string;
  environment: string | null;
  purchased_at: string | null;
  expires_at: string | null;
  revoked: boolean;
};

export type CreditsSummary = {
  credits_remaining: number;
  grants: CreditGrant[];
};
