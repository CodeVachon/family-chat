import { mock } from "bun:test";

/**
 * Fake broker standing in for `@/lib/realtime/broker`'s singleton, which
 * otherwise opens a real Postgres LISTEN connection on first use. Routes only
 * ever call `getBroker().publishEphemeral(...)`, `.start()`, and
 * `.hasCapacityFor(...)` directly (subscribe/unsubscribe go through the
 * mocked realtime stream instead).
 */
export const brokerInstance = {
    start: mock(async () => undefined as unknown),
    hasCapacityFor: mock(() => true),
    subscribe: mock(() => (() => undefined) as (() => void) | null),
    publishEphemeral: mock(() => undefined as unknown)
};

export const getBroker = mock(() => brokerInstance);

export function resetBroker() {
    brokerInstance.start.mockReset().mockImplementation(async () => undefined);
    brokerInstance.hasCapacityFor.mockReset().mockImplementation(() => true);
    brokerInstance.subscribe.mockReset().mockImplementation(() => () => undefined);
    brokerInstance.publishEphemeral.mockReset().mockImplementation(() => undefined);
    getBroker.mockClear();
}
