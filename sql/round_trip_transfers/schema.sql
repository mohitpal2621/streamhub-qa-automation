-- Scenario 1: money transfers between accounts.
-- Amounts are NUMERIC so the 10% rule is exact at the boundary. In floating
-- point, 7.70 back for 7.00 would come out as slightly more than 10%.

CREATE TABLE transactions (
    txn_id           INTEGER       PRIMARY KEY,
    sender_account   VARCHAR(20)   NOT NULL,
    receiver_account VARCHAR(20)   NOT NULL,
    amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    txn_time         TIMESTAMP     NOT NULL,
    CHECK (sender_account <> receiver_account)
);

-- The query joins on (sender, receiver) and then filters on time.
CREATE INDEX idx_transactions_pair_time ON transactions (sender_account, receiver_account, txn_time);
