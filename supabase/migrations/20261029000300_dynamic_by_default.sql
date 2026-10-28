-- Like Turo, every car prices dynamically unless the host sets a day's price
-- themselves. New listings start with it on.
alter table public.vehicles alter column auto_pricing set default true;
