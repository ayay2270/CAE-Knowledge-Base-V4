/* Browser configuration.

   Leave `url` and `publishableKey` empty to run on the local sample data (data/knowledge-base.json).
   Otherwise V4 reads from this Supabase project (read-only).

   The publishable key is public by design — access is limited by Row Level Security.
   NEVER put a secret key, a service_role key or the database password here.
*/
window.KB_CONFIG = {
  supabase: {
    url: 'https://mbpfaciehluwtxvfkohs.supabase.co',
    publishableKey: 'sb_publishable_Sqqh8xb_WpJXWJoTdVTUxQ_Gi3ces6C'
  }
};
