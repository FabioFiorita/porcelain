-- Comment messages written before authorship was introduced have no `author`.
-- Drizzle runs this migration in one transaction. Only the missing field is
-- added: existing author values, timestamps, anchors and message order remain
-- untouched, and no timestamp is fabricated for legacy data.
UPDATE comment_threads
SET data = json_set(
  data,
  '$.messages',
  (
    SELECT json_group_array(
      CASE
        WHEN json_type(value, '$.author') IS NULL
          THEN json_set(value, '$.author', 'reviewer')
        ELSE value
      END
      ORDER BY CAST(key AS INTEGER)
    )
    FROM json_each(data, '$.messages')
  )
)
WHERE EXISTS (
  SELECT 1
  FROM json_each(data, '$.messages')
  WHERE json_type(value, '$.author') IS NULL
);
