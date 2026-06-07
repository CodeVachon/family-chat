-- Realtime: notify the mentioned user when a mention row is created. Targeted
-- by user (the broker routes by targetUserId). Includes the channel name for a
-- friendly notification.
CREATE OR REPLACE FUNCTION notify_mention() RETURNS trigger AS $$
DECLARE
    ch_id uuid;
    ch_name text;
BEGIN
    SELECT m.channel_id, c.name INTO ch_id, ch_name
    FROM messages m
    JOIN channels c ON c.id = m.channel_id
    WHERE m.id = NEW.message_id;

    IF ch_id IS NOT NULL THEN
        PERFORM pg_notify(
            'chat_events',
            json_build_object(
                'type', 'mention',
                'targetUserId', NEW.mentioned_user_id,
                'channelId', ch_id,
                'channelName', ch_name,
                'messageId', NEW.message_id,
                'ts', (extract(epoch from now()) * 1000)::bigint
            )::text
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER mentions_notify
AFTER INSERT ON mentions
FOR EACH ROW EXECUTE FUNCTION notify_mention();
