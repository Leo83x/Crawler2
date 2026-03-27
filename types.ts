
export type CrawlSource = 'google' | 'bing' | 'instagram_via_search' | 'linkedin_via_search' | 'facebook_via_search' | 'apify' | 'firecrawl' | 'openai_atlas' | 'google_maps' | 'doctoralia_via_search' | 'scrape_do';

export interface CrawlJob {
  id: string;
  niche: string;
  city?: string;
  ddd?: string;
  sources: CrawlSource[];
  max_pages_per_source: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  contacts_found: number;
  created_at: Date;
  schedule?: 'once' | 'daily' | 'weekly' | 'monthly';
  last_run_at?: Date;
  next_run_at?: Date;
}

export interface CrawlJobParams {
  niche: string;
  city?: string;
  ddd?: string;
  sources: CrawlSource[];
  max_pages_per_source: number;
  rate_limit: number;
  use_proxies: boolean;
  proxy_url?: string;
  proxy_rotation?: 'none' | 'per_request' | 'per_job';
  run_mode: 'once' | 'recurrent';
  schedule?: 'once' | 'daily' | 'weekly' | 'monthly';
}

export interface Contact {
  id: string;
  name?: string;
  category?: string;
  e164_number: string;
  raw_number: string;
  source_url: string;
  source_type: CrawlSource;
  niche: string;
  address?: string;
  city?: string;
  job_id: string;
  found_at: Date;
  status: 'new' | 'contacted' | 'interested' | 'converted' | 'rejected';
  notes?: string;
  uid: string;
  email?: string;
  description?: string;
  account_type?: 'personal' | 'business' | 'unknown';
  lead_quality?: number; // 1-10
  enriched_at?: Date;
}

export interface BlacklistedContact {
  id: string;
  e164_number: string;
  reason?: string;
  created_at: Date;
}

export interface ErrorLog {
  id: string;
  uid: string;
  timestamp: Date;
  source: string;
  message: string;
  stack?: string;
  context?: any;
}

export interface NormalizedPhone {
    e164: string | null;
    country_code: string | null;
    is_valid: boolean;
    type: string | null;
    raw: string;
    default_country: string;
    location: string | null;
}