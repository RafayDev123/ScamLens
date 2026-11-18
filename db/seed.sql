-- ScamLens sample seed data. DEMONSTRATION DATA ONLY – fictional subjects, not real scan results.
-- Demo account: demo@scamlens.test (password hash below is for the placeholder password "Demo-Pass-12345"; change or delete in real deployments)
-- Generate a fresh hash with: node -e "import('node:crypto').then(c=>{const s=c.randomBytes(16);c.scrypt('YOUR-PASSWORD',s,64,{N:16384,r:8,p:1},(e,k)=>console.log('scrypt$'+s.toString('hex')+'$'+k.toString('hex')))})"
INSERT INTO users (id, email, password_hash, display_name, role)
VALUES ('00000000-0000-4000-8000-000000000001', 'demo@scamlens.test', 'scrypt$00000000000000000000000000000000$00', 'Demo (sample data)', 'user')
ON CONFLICT DO NOTHING;
INSERT INTO user_preferences (user_id) VALUES ('00000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO scans (id, user_id, type, subject_display, subject_hash, verdict, risk_score, confidence, coverage_pct, finding_count, saved, expires_at)
VALUES ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'url', 'DEMO: https://login.paypal.com.account-check.example.net/verify', 'demo-hash-1', 'high_risk', 72, 'medium', 50, 1, true, now() + interval '30 days')
ON CONFLICT DO NOTHING;
INSERT INTO findings (scan_id, code, title, severity, confidence, source)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'url.lookalike.misleading_subdomain', 'Misleading subdomain mentions “PayPal” (demonstration)', 'high', 'medium', 'local-heuristics');
