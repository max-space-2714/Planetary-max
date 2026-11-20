-- Legacy artwork receipts have no historical amount column. Only verified
-- reconciliation or the checkout verifier may populate this funding adapter.
CREATE TABLE artwork_funding (
  tx_hash TEXT PRIMARY KEY,
  amount_usdc TEXT NOT NULL
);
CREATE TABLE treasury_revision (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT INTO treasury_revision VALUES (1,0);
CREATE VIEW treasury_funding AS
SELECT lower(e.tx_hash) tx_hash,
 CASE WHEN e.accounting_bucket='verified_settlement' THEN 'treasury' ELSE e.accounting_bucket END accounting_bucket,
 e.verified_amount_usdc amount_usdc
FROM settlement_events e JOIN output_orders o ON o.order_id=e.order_id
WHERE e.rail='BASE_USDC' AND o.settlement_status='verified_settlement'
 AND lower(o.tx_hash)=lower(e.tx_hash) AND e.accounting_bucket IN ('treasury','escrow','reallocation','verified_settlement')
UNION ALL
SELECT lower(d.tx_reference),'treasury',printf('%d.%06d',d.amount_cents/100,(d.amount_cents%100)*10000)
FROM digital_orders d WHERE d.payment_status='confirmed'
 AND NOT EXISTS (SELECT 1 FROM settlement_events e WHERE lower(e.tx_hash)=lower(d.tx_reference))
UNION ALL
SELECT lower(a.tx_hash),'treasury',a.amount_usdc FROM artwork_funding a
WHERE NOT EXISTS (SELECT 1 FROM settlement_events e WHERE lower(e.tx_hash)=lower(a.tx_hash))
 AND NOT EXISTS (SELECT 1 FROM digital_orders d WHERE lower(d.tx_reference)=lower(a.tx_hash));
CREATE TRIGGER treasury_revision_settlement_events_insert AFTER INSERT ON settlement_events
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_settlement_events_update AFTER UPDATE ON settlement_events
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_settlement_events_delete AFTER DELETE ON settlement_events
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_output_orders_insert AFTER INSERT ON output_orders
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_output_orders_update AFTER UPDATE ON output_orders
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_output_orders_delete AFTER DELETE ON output_orders
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_digital_orders_insert AFTER INSERT ON digital_orders
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_digital_orders_update AFTER UPDATE ON digital_orders
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_digital_orders_delete AFTER DELETE ON digital_orders
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_artwork_funding_insert AFTER INSERT ON artwork_funding
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_artwork_funding_update AFTER UPDATE ON artwork_funding
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_artwork_funding_delete AFTER DELETE ON artwork_funding
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_treasury_releases_insert AFTER INSERT ON treasury_releases
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_treasury_releases_update AFTER UPDATE ON treasury_releases
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_treasury_releases_delete AFTER DELETE ON treasury_releases
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_treasury_destination_insert AFTER INSERT ON treasury_destination
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_treasury_destination_update AFTER UPDATE ON treasury_destination
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
CREATE TRIGGER treasury_revision_treasury_destination_delete AFTER DELETE ON treasury_destination
BEGIN UPDATE treasury_revision SET version=version+1 WHERE id=1; END;
