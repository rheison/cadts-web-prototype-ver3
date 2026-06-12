// CADTS SecureDestroy Supabase configuration.
// Replace these placeholders with your Supabase project values:
// Supabase Dashboard -> Project Settings -> API

const SUPABASE_URL = "https://iphtstjhudsmuaugfpth.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_DFa4Dkzu4Px2nYSOHmHPxQ_GnD3P_FN";

window.CADTS_SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("PASTE_YOUR") &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes("PASTE_YOUR");

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
// force GitHub Pages redeploy
