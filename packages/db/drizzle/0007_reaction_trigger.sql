-- Realtime: notify on reaction changes. Looks up the message's channel so the
-- broker can scope the event to that channel's subscribers.
CREATE OR REPLACE FUNCTION notify_reaction() RETURNS trigger AS $$
DECLARE
    msg_id uuid;
    ch_id uuid;
BEGIN
    msg_id := COALESCE(NEW.message_id, OLD.message_id);
    SELECT channel_id INTO ch_id FROM messages WHERE id = msg_id;
    IF ch_id IS NOT NULL THEN
        PERFORM pg_notify(
            'chat_events',
            json_build_object(
                'type', 'reaction.changed',
                'channelId', ch_id,
                'messageId', msg_id,
                'ts', (extract(epoch from now()) * 1000)::bigint
            )::text
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER message_reactions_notify
AFTER INSERT OR DELETE ON message_reactions
FOR EACH ROW EXECUTE FUNCTION notify_reaction();
