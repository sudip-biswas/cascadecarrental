-- Supabase grants execute on new functions to anon and authenticated by default,
-- which "revoke ... from public" doesn't undo. Signed-out visitors don't need
-- either function, and the trigger function is only ever run by its trigger.

revoke execute on function public.has_booked_vehicle(uuid) from anon;
revoke execute on function public.trip_drivers_before_write() from anon, authenticated;
