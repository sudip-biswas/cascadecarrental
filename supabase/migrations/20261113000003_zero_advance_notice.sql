-- =============================================================
-- Fleet cars are always at the DoubleTree — no advance notice
-- required. Setting to 0 makes same-day / next-few-hours
-- searches return results instead of an empty page.
-- =============================================================
UPDATE vehicles SET advance_notice_hours = 0;
