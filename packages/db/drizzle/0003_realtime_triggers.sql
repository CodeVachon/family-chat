-- Realtime: emit small JSON envelopes on chat_events for the SSE broker.
-- Payloads stay well under Postgres' 8000-byte NOTIFY limit; clients refetch.

-- Messages: insert / update / delete
CREATE OR REPLACE FUNCTION notify_message() RETURNS trigger AS $$
DECLARE
    rec record;
    op_type text;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        rec := OLD;
        op_type := 'message.deleted';
    ELSIF (TG_OP = 'UPDATE') THEN
        rec := NEW;
        op_type := 'message.updated';
    ELSE
        rec := NEW;
        op_type := 'message.created';
    END IF;

    PERFORM pg_notify(
        'chat_events',
        json_build_object(
            'type', op_type,
            'channelId', rec.channel_id,
            'messageId', rec.id,
            'actorId', rec.author_user_id,
            'ts', (extract(epoch from now()) * 1000)::bigint
        )::text
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER messages_notify
AFTER INSERT OR UPDATE OR DELETE ON messages
FOR EACH ROW EXECUTE FUNCTION notify_message();
--> statement-breakpoint

-- Channel membership read-pointer changes: targeted at the affected user so
-- their other open tabs can refresh unread badges.
CREATE OR REPLACE FUNCTION notify_member_read() RETURNS trigger AS $$
BEGIN
    IF (NEW.last_read_at IS DISTINCT FROM OLD.last_read_at) THEN
        PERFORM pg_notify(
            'chat_events',
            json_build_object(
                'type', 'read.updated',
                'channelId', NEW.channel_id,
                'targetUserId', NEW.user_id,
                'ts', (extract(epoch from now()) * 1000)::bigint
            )::text
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER channel_members_read_notify
AFTER UPDATE ON channel_members
FOR EACH ROW EXECUTE FUNCTION notify_member_read();
