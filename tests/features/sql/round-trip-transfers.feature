@sql
Feature: SQL scenario 1 - round-trip transfers
  Find transfers where account A pays account B and B pays back a similar
  amount (within 10%) within 24 hours. The query and the sample data are in
  sql/round_trip_transfers/. Each block of seed.sql is one case.

  Background:
    Given a fresh PostgreSQL database with the "round_trip_transfers" tables and sample data

  Scenario: The query finds exactly the round trips in the sample data
    When I run the "round_trip_transfers" query
    Then the result has the columns "original_txn_id, return_txn_id, account_a, account_b, amount_sent, amount_returned, pct_difference, hours_apart"
    And the result is:
      | original_txn_id | return_txn_id | account_a | account_b | amount_sent | amount_returned | pct_difference | hours_apart |
      | 1               | 2             | ACC-1001  | ACC-2001  | 10000.00    | 9500.00         | -5.00          | 8.50        |
      | 7               | 8             | ACC-1004  | ACC-2004  | 1000.00     | 1100.00         | 10.00          | 24.00       |
      | 13              | 14            | ACC-2007  | ACC-1007  | 2000.00     | 2000.00         | 0.00           | 3.00        |
      | 15              | 16            | ACC-1008  | ACC-2008  | 50000.00    | 45500.00        | -9.00          | 10.00       |
      | 15              | 17            | ACC-1008  | ACC-2008  | 50000.00    | 54000.00        | 8.00           | 23.00       |
      | 22              | 23            | ACC-1011  | ACC-2011  | 1500.00     | 1500.00         | 0.00           | 0.00        |

  Scenario Outline: The sample data catches a query that <mistake>
    When I run the "round_trip_transfers" query with "<correct>" changed to "<mistaken>"
    Then the changed query <effect> the row starting "<row>"

    Examples:
      | mistake                                  | correct                                         | mistaken                                       | effect | row    |
      | treats exactly 24 hours as too late      | r.txn_time <= o.txn_time + INTERVAL '24 hours'  | r.txn_time < o.txn_time + INTERVAL '24 hours'  | misses | 7, 8   |
      | treats exactly 10% as too much           | ABS(r.amount - o.amount) <= 0.10 * o.amount     | ABS(r.amount - o.amount) < 0.10 * o.amount     | misses | 7, 8   |
      | measures 10% against the returned amount | 0.10 * o.amount                                 | 0.10 * r.amount                                | adds   | 26, 27 |
      | lets the return come before the payment  | (r.txn_time, r.txn_id) > (o.txn_time, o.txn_id) | r.txn_id <> o.txn_id                           | adds   | 2, 1   |
      | drops transfers that share a timestamp   | (r.txn_time, r.txn_id) > (o.txn_time, o.txn_id) | r.txn_time > o.txn_time                        | misses | 22, 23 |
