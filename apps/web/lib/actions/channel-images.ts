"use server";

import { authorizeChannel } from "@/lib/dal";
import { GALLERY_PAGE_SIZE, listChannelImages, type ChannelImage } from "@/lib/queries/channels";

export type ChannelImagesPage = {
    images: ChannelImage[];
    hasMore: boolean;
};

/**
 * Fetch the gallery page starting at `offset`. Authorizes channel access per call
 * so it's safe to invoke directly from the client — a deep link or a crafted call
 * can't enumerate a private channel's photos.
 */
export async function loadMoreChannelImages(
    channelId: string,
    offset: number
): Promise<ChannelImagesPage> {
    await authorizeChannel(channelId, "channel:view");

    // Ask for one more than a page: a full extra row means there's another page,
    // without paying for a second COUNT.
    const images = await listChannelImages(channelId, {
        offset: Math.max(0, Math.trunc(offset)),
        limit: GALLERY_PAGE_SIZE + 1
    });

    return {
        images: images.slice(0, GALLERY_PAGE_SIZE),
        hasMore: images.length > GALLERY_PAGE_SIZE
    };
}
