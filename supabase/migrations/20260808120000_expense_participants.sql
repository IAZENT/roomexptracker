-- Lets an expense be split among a chosen subset of household members
-- (e.g. a meat purchase split among 3 of 4 roommates, excluding one who
-- doesn't eat meat) instead of always splitting across everyone.
--
-- null/empty means "everyone" (the existing default behavior) - only
-- set when the user explicitly narrows the participant list, so old
-- rows keep working unchanged.
alter table expenses add column if not exists participant_ids uuid[];
