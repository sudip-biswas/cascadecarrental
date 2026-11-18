-- Allow hosts to update (reorder) their own vehicle images.
-- Without this policy Supabase silently ignores UPDATE statements on the table.
CREATE POLICY "vehicle_images_update_own" ON vehicle_images FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.host_id = auth.uid()
  ));
