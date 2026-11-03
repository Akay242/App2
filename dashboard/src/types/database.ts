/**
 * Datenbank-Typen, identisch mit app/src/types/database.ts.
 * Bei Schema-Änderungen beide Dateien aktualisieren (oder per
 *   npx supabase gen types typescript --project-id <ID>
 * neu erzeugen).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'customer' | 'admin';
export type RewardType = 'small_extra' | 'free_cut' | 'winback_discount';
export type RewardStatus = 'available' | 'redeemed' | 'expired';

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type SalonSettings = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  opening_hours: Json;
  google_review_url: string | null;
  timezone: string;
  stamps_per_cycle: number;
  small_reward_at: number;
  small_reward_label: string;
  free_cut_label: string;
  winback_after_days: number;
  winback_discount_percent: number;
  winback_valid_days: number;
  updated_at: string;
};

export type Profile = {
  id: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  qr_token: string;
  push_token: string | null;
  last_visit_at: string | null;
  created_at: string;
};

export type Visit = {
  id: string;
  customer_id: string;
  scanned_by: string | null;
  visit_date: string;
  created_at: string;
};

export type Reward = {
  id: string;
  customer_id: string;
  type: RewardType;
  status: RewardStatus;
  label: string;
  discount_percent: number | null;
  earned_visit_id: string | null;
  earned_at: string;
  valid_until: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
};

export type Service = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price_cents: number;
  price_is_from: boolean;
  duration_min: number | null;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type Review = {
  id: string;
  customer_id: string;
  visit_id: string;
  rating: number;
  comment: string | null;
  forwarded_to_google: boolean;
  created_at: string;
};

/** Antwort von record_visit() nach einem Scan. */
export type RecordVisitResult = {
  visit_id: string;
  customer_id: string;
  customer_name: string;
  total_visits: number;
  stamp_position: number;
  stamps_in_cycle: number;
  stamps_per_cycle: number;
  new_rewards: Pick<Reward, 'id' | 'type' | 'label'>[];
  available_rewards: Pick<Reward, 'id' | 'type' | 'label' | 'discount_percent' | 'valid_until'>[];
};

/** Zeile aus admin_customer_overview() */
export type CustomerOverview = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: string;
  last_visit_at: string | null;
  total_visits: number;
  stamps_in_cycle: number;
  available_rewards: number;
};

/** Antwort von admin_stats() */
export type AdminStats = {
  customers_total: number;
  customers_new_30d: number;
  customers_active_42d: number;
  visits_today: number;
  visits_30d: number;
  rewards_redeemed_30d: number;
};

export type Database = {
  public: {
    Tables: {
      salon_settings: Table<SalonSettings>;
      profiles: Table<Profile, 'id'>;
      visits: Table<Visit, 'customer_id' | 'visit_date'>;
      rewards: Table<Reward, 'customer_id' | 'type' | 'label'>;
      services: Table<Service, 'name' | 'price_cents'>;
      reviews: Table<Review, 'customer_id' | 'visit_id' | 'rating'>;
    };
    Views: { [_ in never]: never };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      stamp_progress: {
        Args: { p_customer_id: string };
        Returns: { total_visits: number; stamps_in_cycle: number; stamps_per_cycle: number }[];
      };
      record_visit: { Args: { p_qr_token: string }; Returns: Json };
      redeem_reward: { Args: { p_reward_id: string }; Returns: Reward };
      admin_customer_overview: { Args: Record<string, never>; Returns: CustomerOverview[] };
      admin_stats: { Args: Record<string, never>; Returns: Json };
    };
    Enums: {
      user_role: UserRole;
      reward_type: RewardType;
      reward_status: RewardStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
