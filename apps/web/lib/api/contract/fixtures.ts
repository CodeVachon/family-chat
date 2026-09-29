/**
 * Example payloads for every shape in `schemas.ts` — validated against those
 * schemas in `v1.contract.test.ts`, and the source `docs/rest-api.md`'s code
 * blocks are copied from. Keep both in sync by hand; the test only catches a
 * fixture that stops matching its own schema, not a doc that drifts from a
 * fixture.
 */

export const meResponseFixture = {
    user: {
        id: "018f2e2a-0000-7000-8000-000000000001",
        name: "Jamie Vachon",
        email: "jamie@example.com",
        emailVerified: true,
        image: null,
        appRole: "user",
        approvalStatus: "approved",
        createdAt: "2026-01-15T18:04:12.000Z",
        updatedAt: "2026-01-15T18:04:12.000Z"
    },
    preferences: {
        displayName: "Jamie",
        dateTimeFormat: "relative",
        themePreference: "system",
        notificationLevel: "mentions",
        colorHue: 220,
        fontSizeScale: "default",
        fontFamily: "figtree",
        avatarUrl: null,
        avatarSourceUrl: null,
        avatarCrop: null,
        bio: null,
        phone: null,
        bannerUrl: null,
        bannerSourceUrl: null,
        bannerCrop: null
    },
    unread: 3
};

export const channelFixture = {
    id: "018f2e2a-0000-7000-8000-000000000010",
    name: "General",
    description: "Whole-family announcements",
    color: "#3b82f6",
    icon: "hash",
    isPrivate: false,
    isArchived: false,
    archivedAt: null,
    createdByUserId: "018f2e2a-0000-7000-8000-000000000001",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
};

export const visibleChannelFixture = {
    ...channelFixture,
    myRole: "user",
    isFavorite: true,
    unreadCount: 2,
    mentionCount: 1
};

export const channelMembershipFixture = {
    id: "018f2e2a-0000-7000-8000-000000000020",
    channelId: channelFixture.id,
    userId: "018f2e2a-0000-7000-8000-000000000001",
    role: "user",
    isFavorite: true,
    lastReadMessageId: "018f2e2a-0000-7000-8000-000000000030",
    lastReadAt: "2026-01-15T18:00:00.000Z",
    joinedAt: "2026-01-01T00:05:00.000Z",
    createdAt: "2026-01-01T00:05:00.000Z",
    updatedAt: "2026-01-15T18:00:00.000Z"
};

export const channelDetailResponseFixture = {
    channel: channelFixture,
    membership: channelMembershipFixture,
    capabilities: { canPost: true, canManage: false, canManageMembers: false }
};

export const channelMemberFixture = {
    userId: "018f2e2a-0000-7000-8000-000000000001",
    role: "user",
    name: "Jamie",
    colorHue: 220,
    avatarUrl: null
};

export const attachmentFixture = {
    id: "018f2e2a-0000-7000-8000-000000000040",
    messageId: "018f2e2a-0000-7000-8000-000000000030",
    uploaderId: "018f2e2a-0000-7000-8000-000000000001",
    kind: "image",
    provider: "cloudinary",
    publicId: "family-chat/018f2e2a.../abc123",
    resourceType: "image",
    secureUrl: "https://res.cloudinary.com/family-chat/image/upload/v1700000000/abc123.jpg",
    format: "jpg",
    bytes: 245_760,
    width: 1600,
    height: 1200,
    originalFilename: "beach-day.jpg",
    thumbnailUrl: null,
    createdAt: "2026-01-15T17:59:00.000Z"
};

export const sentMessageFixture = {
    id: "018f2e2a-0000-7000-8000-000000000030",
    channelId: channelFixture.id,
    authorUserId: "018f2e2a-0000-7000-8000-000000000001",
    type: "user",
    systemEvent: null,
    threadRootId: null,
    body: "<p>Dinner's at 6</p>",
    editedAt: null,
    deletedAt: null,
    createdAt: "2026-01-15T17:59:00.000Z",
    updatedAt: "2026-01-15T17:59:00.000Z"
};

export const sendMessageResponseFixture = { message: sentMessageFixture };

export const decoratedMessageFixture = {
    ...sentMessageFixture,
    author: {
        id: "018f2e2a-0000-7000-8000-000000000001",
        name: "Jamie Vachon",
        preferences: { displayName: "Jamie", colorHue: 220, avatarUrl: null }
    },
    attachments: [attachmentFixture],
    reactions: [{ emoji: "👍", count: 2, reactedByMe: true }],
    mentions: [{ userId: "018f2e2a-0000-7000-8000-000000000002", name: "Sam", colorHue: 140 }],
    mentionsMe: false,
    linkPreviews: []
};

export const channelMessageFixture = {
    ...decoratedMessageFixture,
    replyCount: 2,
    lastReplyAt: "2026-01-15T18:02:00.000Z"
};

export const channelMessagesPageFixture = {
    messages: [channelMessageFixture],
    hasMore: false
};

export const threadResponseFixture = {
    messages: [decoratedMessageFixture]
};

export const errorEnvelopeFixture = {
    error: { message: "Channel not found" }
};

export const validationErrorEnvelopeFixture = {
    error: {
        message: "Validation failed",
        issues: [{ code: "custom", message: "Message cannot be empty", path: ["body"] }]
    }
};

export const realtimeEventFixtures = {
    ready: { type: "ready", ts: 1_700_000_000_000 },
    messageCreated: {
        type: "message.created",
        channelId: channelFixture.id,
        messageId: sentMessageFixture.id,
        ts: 1_700_000_000_001
    },
    typing: {
        type: "typing",
        channelId: channelFixture.id,
        userId: "018f2e2a-0000-7000-8000-000000000001",
        name: "Jamie",
        ts: 1_700_000_000_002
    },
    presenceSnapshot: {
        type: "presence.snapshot",
        onlineUserIds: ["018f2e2a-0000-7000-8000-000000000001"],
        ts: 1_700_000_000_003
    }
} as const;
