ALTER TABLE settings ADD COLUMN IF NOT EXISTS presets jsonb DEFAULT '[{"qty":17,"total":100},{"qty":15,"total":90},{"qty":10,"total":60}]';
