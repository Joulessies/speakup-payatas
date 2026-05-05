-- ============================================================
-- Module 1c: Moderation, Feedback, and Spam Blocks
-- Adds support for staff features and user transparency
-- ============================================================

-- 1. Modify existing reports table
ALTER TABLE reports ADD COLUMN verification_status VARCHAR(20) DEFAULT 'unreviewed';
ALTER TABLE reports ADD COLUMN verified_by UUID REFERENCES auth.users(id);
ALTER TABLE reports ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE reports ADD COLUMN ai_category VARCHAR(50);
ALTER TABLE reports ADD COLUMN admin_category VARCHAR(50);
ALTER TABLE reports ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE reports ADD COLUMN flag_reason TEXT;
ALTER TABLE reports ADD COLUMN submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Internal Notes Table
CREATE TABLE internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    author_id UUID REFERENCES auth.users(id),
    author_role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Spam Blocks Table
CREATE TABLE spam_blocks (
    reporter_hash VARCHAR(64) PRIMARY KEY,
    blocked_by UUID REFERENCES auth.users(id),
    reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_hash VARCHAR(64), -- null for broadcast
    recipient_role VARCHAR(20), -- 'admin', 'staff', 'user'
    type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Feedback Table
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_hash VARCHAR(64) NOT NULL,
    report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
    rating SMALLINT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (Example)
ALTER TABLE internal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff and admin can read notes" ON internal_notes FOR SELECT USING (auth.jwt() ->> 'role' IN ('admin', 'staff'));
CREATE POLICY "Staff and admin can insert notes" ON internal_notes FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'staff'));

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can read feedback" ON feedback FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');
