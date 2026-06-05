-- Realtime: broadcast a contentless "channels.changed" signal so every client
-- refetches its channel list (each client only sees what it's allowed to). Fires
-- on channel create/edit/archive/delete and on membership add/remove.

CREATE OR REPLACE FUNCTION notify_channels_changed() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'chat_events',
        json_build_object(
            'type', 'channels.changed',
            'ts', (extract(epoch from now()) * 1000)::bigint
        )::text
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER channels_changed_notify
AFTER INSERT OR UPDATE OR DELETE ON channels
FOR EACH ROW EXECUTE FUNCTION notify_channels_changed();
--> statement-breakpoint

CREATE TRIGGER channel_members_changed_notify
AFTER INSERT OR DELETE ON channel_members
FOR EACH ROW EXECUTE FUNCTION notify_channels_changed();
