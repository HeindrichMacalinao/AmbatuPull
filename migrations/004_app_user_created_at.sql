-- Preserve unknown registration dates for existing accounts. New application
-- registrations write createdAt explicitly.
ALTER TABLE app_user ADD COLUMN createdAt TIMESTAMP;
