import { ChannelGallery } from "@/components/channels/channel-gallery";
import { authorizeChannel } from "@/lib/dal";
import { countChannelImages, GALLERY_PAGE_SIZE, listChannelImages } from "@/lib/queries/channels";

export default async function ChannelGalleryPage({
    params
}: {
    params: Promise<{ channelId: string }>;
}) {
    const { channelId } = await params;
    // Authorized here as well as in the layout: a page is the boundary, and this
    // one is reachable by deep link.
    const { channel } = await authorizeChannel(channelId, "channel:view");

    const [images, total] = await Promise.all([
        // One extra row tells us whether a second page exists.
        listChannelImages(channelId, { limit: GALLERY_PAGE_SIZE + 1 }),
        countChannelImages(channelId)
    ]);

    const hasMore = images.length > GALLERY_PAGE_SIZE;

    return (
        <ChannelGallery
            channelId={channel.id}
            initialImages={images.slice(0, GALLERY_PAGE_SIZE)}
            initialHasMore={hasMore}
            total={total}
        />
    );
}
