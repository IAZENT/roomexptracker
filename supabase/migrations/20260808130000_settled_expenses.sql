-- Some purchases (e.g. gas) get paid for on the spot by everyone chipping
-- in cash right there - there's no actual debt to track, but the purchase
-- should still show up in spending history/insights. settled = true means
-- "still count this in what was spent, but exclude it from anyone's owed
-- balance / remaining-to-pay / settlement calculations."
alter table expenses add column if not exists settled boolean not null default false;
