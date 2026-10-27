-- Each block is one case. The comment says whether the query should report it.

INSERT INTO transactions (txn_id, sender_account, receiver_account, amount, txn_time) VALUES
-- Reported: 9,500 comes back 8.5 hours after 10,000 went out (5% less).
(1,  'ACC-1001', 'ACC-2001', 10000.00, '2024-03-01 09:00:00'),
(2,  'ACC-2001', 'ACC-1001',  9500.00, '2024-03-01 17:30:00'),

-- Not reported: 12% more comes back.
(3,  'ACC-1002', 'ACC-2002',  5000.00, '2024-03-02 10:00:00'),
(4,  'ACC-2002', 'ACC-1002',  5600.00, '2024-03-02 12:00:00'),

-- Not reported: the return is 25 hours later.
(5,  'ACC-1003', 'ACC-2003', 20000.00, '2024-03-03 08:00:00'),
(6,  'ACC-2003', 'ACC-1003', 19800.00, '2024-03-04 09:00:00'),

-- Reported: exactly 10% more, exactly 24 hours later. Both limits are inclusive.
(7,  'ACC-1004', 'ACC-2004',  1000.00, '2024-03-05 10:00:00'),
(8,  'ACC-2004', 'ACC-1004',  1100.00, '2024-03-06 10:00:00'),

-- Not reported: a second payment in the same direction is not a return.
(9,  'ACC-1005', 'ACC-2005',  3000.00, '2024-03-07 10:00:00'),
(10, 'ACC-1005', 'ACC-2005',  2950.00, '2024-03-07 11:00:00'),

-- Not reported: the money moves on to a third account instead of coming back.
(11, 'ACC-1006', 'ACC-2006',  7500.00, '2024-03-08 10:00:00'),
(12, 'ACC-2006', 'ACC-3006',  7400.00, '2024-03-08 11:00:00'),

-- Reported once, with ACC-2007 as account A because it paid first.
(13, 'ACC-2007', 'ACC-1007',  2000.00, '2024-03-09 09:00:00'),
(14, 'ACC-1007', 'ACC-2007',  2000.00, '2024-03-09 12:00:00'),

-- Reported twice: two separate returns both match the same original payment.
(15, 'ACC-1008', 'ACC-2008', 50000.00, '2024-03-10 10:00:00'),
(16, 'ACC-2008', 'ACC-1008', 45500.00, '2024-03-10 20:00:00'),
(17, 'ACC-2008', 'ACC-1008', 54000.00, '2024-03-11 09:00:00'),

-- Not reported: 899.99 is 10.001% below 1,000, just outside the limit.
(18, 'ACC-1009', 'ACC-2009',  1000.00, '2024-03-12 10:00:00'),
(19, 'ACC-2009', 'ACC-1009',   899.99, '2024-03-12 11:00:00'),

-- Not reported: one second past the 24-hour window.
(20, 'ACC-1010', 'ACC-2010',  8000.00, '2024-03-13 10:00:00'),
(21, 'ACC-2010', 'ACC-1010',  8000.00, '2024-03-14 10:00:01'),

-- Reported once: both transfers carry the same timestamp, so txn_id decides
-- which one counts as the original.
(22, 'ACC-1011', 'ACC-2011',  1500.00, '2024-03-15 10:00:00'),
(23, 'ACC-2011', 'ACC-1011',  1500.00, '2024-03-15 10:00:00'),

-- Not reported: same two accounts as transfers 1 and 2, but 9,900 is far more
-- than the 4,000 sent that morning, and 19 days after transfer 1.
(24, 'ACC-1001', 'ACC-2001',  4000.00, '2024-03-20 10:00:00'),
(25, 'ACC-2001', 'ACC-1001',  9900.00, '2024-03-20 15:00:00'),

-- Not reported: 1,105 is 10.5% more than the 1,000 sent. It is within 10% of
-- 1,105 itself, so this case fails a query that measures against the return.
(26, 'ACC-1012', 'ACC-2012',  1000.00, '2024-03-21 10:00:00'),
(27, 'ACC-2012', 'ACC-1012',  1105.00, '2024-03-21 12:00:00');
