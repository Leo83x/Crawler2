
export type CrawlSource = 'google' | 'bing' | 'instagram_via_search' | 'openai_atlas' | 'google_maps' | 'doctoralia_via_search';

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
}

export interface CrawlJobParams {
  niche: string;
  city?: string;
  ddd?: string;
  sources: CrawlSource[];
  max_pages_per_source: number;
  rate_limit: number;
  use_proxies: boolean;
  run_mode: 'once' | 'recurrent';
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