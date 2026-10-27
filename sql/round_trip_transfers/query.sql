-- Round trips: account A pays account B, then B pays A back an amount within
-- 10% of the original, no more than 24 hours later.
--
-- Rules, each covered by a case in seed.sql:
--   * "within 10%" is measured against the original amount, limit inclusive
--   * the return must come after the original, at most 24 hours later (inclusive)
--   * each pair is reported once, with A being the account that paid first;
--     txn_id breaks a tie when both transfers share a timestamp
--   * if several returns match one payment, each pair is its own row

SELECT
    o.txn_id                                                       AS original_txn_id,
    r.txn_id                                                       AS return_txn_id,
    o.sender_account                                               AS account_a,
    o.receiver_account                                             AS account_b,
    o.amount                                                       AS amount_sent,
    r.amount                                                       AS amount_returned,
    ROUND((r.amount - o.amount) / o.amount * 100, 2)               AS pct_difference,
    ROUND(EXTRACT(EPOCH FROM (r.txn_time - o.txn_time)) / 3600, 2) AS hours_apart
FROM transactions AS o
JOIN transactions AS r
  ON  r.sender_account   = o.receiver_account
  AND r.receiver_account = o.sender_account
  AND (r.txn_time, r.txn_id) > (o.txn_time, o.txn_id)
  AND r.txn_time <= o.txn_time + INTERVAL '24 hours'
  AND ABS(r.amount - o.amount) <= 0.10 * o.amount
ORDER BY o.txn_time, r.txn_time, r.txn_id;
