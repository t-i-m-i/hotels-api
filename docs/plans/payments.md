# Payments Notes

- Concurrent requests for overlapping dates are the one place where a check-then-insert can race. Today assertNoOverlap and the INSERT are separate statements, so two simultaneous requests could both pass. When you get to payments, an exclusion constraint on (hotel_id, daterange(check_in, check_out)) closes that gap at the database level.
