ALTER TABLE subscriptions ALTER COLUMN currency SET DEFAULT 'USD';

UPDATE platform_settings SET default_currency = 'USD' WHERE default_currency = 'KES';
