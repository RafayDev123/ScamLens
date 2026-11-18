-- OPTIONAL: Row Level Security for deployments that expose these tables through Supabase/PostgREST.
-- The reference application connects with a server-side role and enforces ownership in the service layer
-- (every query is scoped by user_id / guest_id; see src/lib/services/store.ts). Apply this file if you point
-- Supabase clients directly at the database. Requires auth.uid() (Supabase Auth) and users.id = auth.users.id.
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY scans_owner ON scans FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY findings_owner ON findings FOR ALL USING (EXISTS (SELECT 1 FROM scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));
CREATE POLICY threat_matches_owner ON threat_matches FOR ALL USING (EXISTS (SELECT 1 FROM scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));
CREATE POLICY analysis_sources_owner ON analysis_sources FOR ALL USING (EXISTS (SELECT 1 FROM scans s WHERE s.id = scan_id AND s.user_id = auth.uid()));
CREATE POLICY reports_owner ON reports FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY share_tokens_owner ON report_share_tokens FOR ALL USING (EXISTS (SELECT 1 FROM reports r WHERE r.id = report_id AND r.user_id = auth.uid()));
CREATE POLICY api_keys_owner ON api_keys FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY prefs_owner ON user_preferences FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- sessions, reset tokens, usage_events, audit_logs, provider_status and rate_limit_records have NO policies:
-- they are reachable only by the server-side (service) role.
