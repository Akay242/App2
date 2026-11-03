import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

/** Browser-Client. Die Sitzung liegt im localStorage des Browsers. */
export const supabase = isSupabaseConfigured ? createClient<Database>(url!, key!) : null;
