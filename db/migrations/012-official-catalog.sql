BEGIN;

-- Keep existing class identifiers and historical orders intact while replacing
-- the earlier provisional catalogue with the official product structure.
UPDATE ticket_classes SET name='VVIP', price=2000000, capacity=77 WHERE mode='VENUE' AND name='Platinum';
UPDATE ticket_classes SET name='VIP', price=1000000, capacity=77 WHERE mode='VENUE' AND name='Gold';
UPDATE ticket_classes SET name='GOLD', price=500000, capacity=177 WHERE mode='VENUE' AND name='Silver';
UPDATE ticket_classes SET name='SILVER', price=250000, capacity=577 WHERE mode='VENUE' AND name='Bronze';
UPDATE ticket_classes SET name='REGULER', price=100000, capacity=777 WHERE mode='VENUE' AND name='Reguler';

UPDATE ticket_classes SET name='Simfoni Iman', price=2000000 WHERE mode='LIVESTREAM' AND name='Platinum';
UPDATE ticket_classes SET name='Simfoni Agung', price=1000000 WHERE mode='LIVESTREAM' AND name='Gold';
UPDATE ticket_classes SET name='Simfoni Pujian', price=500000 WHERE mode='LIVESTREAM' AND name='Silver';
UPDATE ticket_classes SET name='Simfoni Syukur', price=250000 WHERE mode='LIVESTREAM' AND name='Bronze';
UPDATE ticket_classes SET name='Simfoni Kasih', price=100000 WHERE mode='LIVESTREAM' AND name='Reguler';

-- Livestream capacity is a configurable demo limit. It never creates venue inventory.
ALTER TABLE ticket_classes DROP CONSTRAINT IF EXISTS ticket_classes_check;
ALTER TABLE ticket_classes ADD CONSTRAINT ticket_classes_mode_capacity_check
  CHECK ((mode='VENUE' AND capacity IS NOT NULL) OR (mode='LIVESTREAM'));
UPDATE ticket_classes SET capacity=250 WHERE mode='LIVESTREAM' AND capacity IS NULL;

INSERT INTO ticket_classes(event_id,name,mode,price,capacity,max_per_order)
SELECT id,'Simfoni Harapan','LIVESTREAM',750000,250,10 FROM events
WHERE NOT EXISTS(SELECT 1 FROM ticket_classes WHERE mode='LIVESTREAM' AND name='Simfoni Harapan');
INSERT INTO ticket_classes(event_id,name,mode,price,capacity,max_per_order)
SELECT id,'Simfoni Setia','LIVESTREAM',50000,500,10 FROM events
WHERE NOT EXISTS(SELECT 1 FROM ticket_classes WHERE mode='LIVESTREAM' AND name='Simfoni Setia');

COMMIT;
