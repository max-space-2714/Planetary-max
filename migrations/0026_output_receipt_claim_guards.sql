-- Extend receipt reuse protection across the existing catalogs and output records.
CREATE TRIGGER output_receipt_catalog_guard BEFORE INSERT ON output_orders
WHEN NEW.tx_hash != '' AND EXISTS (SELECT 1 FROM settlement_claims WHERE tx_reference = lower(NEW.tx_hash))
BEGIN SELECT RAISE(ABORT,'Receipt already claimed'); END;
CREATE TRIGGER output_receipt_catalog_update_guard BEFORE UPDATE OF tx_hash ON output_orders
WHEN NEW.tx_hash != '' AND EXISTS (SELECT 1 FROM settlement_claims WHERE tx_reference = lower(NEW.tx_hash))
BEGIN SELECT RAISE(ABORT,'Receipt already claimed'); END;
CREATE TRIGGER catalog_receipt_output_guard BEFORE INSERT ON settlement_claims
WHEN EXISTS (SELECT 1 FROM output_orders WHERE tx_hash = lower(NEW.tx_reference) AND tx_hash != '')
BEGIN SELECT RAISE(ABORT,'Receipt already claimed'); END;
