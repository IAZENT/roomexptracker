-- Prevent duplicate shopping items from repeated syncs
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_items_local_id_unique
  ON shopping_items (local_id)
  WHERE local_id IS NOT NULL;
