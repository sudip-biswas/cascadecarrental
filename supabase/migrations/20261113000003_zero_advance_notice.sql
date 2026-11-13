-- =============================================================
-- Fleet minimum: 1 hour advance notice, 3 hours between trips.
-- Turo's lowest buffer is also 3 hours; 1-hour notice allows
-- same-day bookings while giving the team time to prep.
-- =============================================================
UPDATE vehicles SET advance_notice_hours = 1;
UPDATE vehicles SET trip_buffer_hours = 3;
