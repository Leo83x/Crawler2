
export type CrawlSource = 'google' | 'bing' | 'instagram_via_search' | 'linkedin_via_search' | 'facebook_via_search' | 'apify' | 'firecrawl' | 'openai_atlas' | 'google_maps' | 'doctoralia_via_search' | 'doctoralia_direct' | 'scrape_do' | 'manual' | 'import';

export interface CrawlJob {
  id: string;
  name?: string;
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
  direct_url?: string;
}

export interface CrawlJobParams {
  name?: string;
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
  direct_url?: string;
}

export interface Contact {
  id: string;
  name?: string;
  category?: string;
  e164_number?: string;
  raw_number?: string;
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
  photo_url?: string;
  linkedin_url?: string;
  instagram_handle?: string;
  facebook_url?: string;
  website?: string;
  description?: string;
  account_type?: 'personal' | 'business' | 'unknown';
  lead_quality?: number; // 1-10
  enriched_at?: Date;
  outreach_history?: OutreachInteraction[];
  last_interaction_at?: Date;
}

export interface OutreachInteraction {
  id: string;
  type: 'email' | 'linkedin' | 'instagram' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'replied' | 'failed';
}

export interface CampaignStep {
  id: string;
  type: 'invitation' | 'message' | 'delay';
  content?: string; // Note for invitation
  template_id?: string; 
  delay_hours?: number;
  order: number;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  channel: 'email' | 'linkedin' | 'instagram' | 'whatsapp' | 'omnichannel';
  template_id?: string; // Deprecated in favor of steps for new campaigns
  steps?: CampaignStep[];
  job_ids: string[]; // Lists targeted by this campaign
  status: 'active' | 'paused' | 'completed';
  daily_limit: number;
  sent_today: number;
  total_sent?: number;
  created_at: Date;
  uid: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  base_content: string;
  variants: string[];
  channel: 'email' | 'linkedin' | 'instagram' | 'whatsapp';
  uid: string;
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