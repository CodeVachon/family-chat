import { beforeEach, describe, expect, it } from "bun:test";

import { isCloudinaryConfigured } from "../../test/mocks/cloudinary";
import { request, resetAllMocks, signedInAs } from "../../test/helpers/api-v1";

beforeEach(resetAllMocks);

describe("POST /push-subscriptions", () => {
    it("saves a subscription", async () => {
        signedInAs();

        const res = await request("POST", "/push-subscriptions", {
            endpoint: "https://push.example.com/abc",
            p256dh: "key",
            auth: "secret"
        });

        expect(res.status).toBe(204);
    });

    it("rejects a non-url endpoint with 422", async () => {
        signedInAs();

        const res = await request("POST", "/push-subscriptions", {
            endpoint: "not-a-url",
            p256dh: "key",
            auth: "secret"
        });

        expect(res.status).toBe(422);
    });
});

describe("DELETE /push-subscriptions", () => {
    it("returns 400 without an endpoint", async () => {
        signedInAs();

        const res = await request("DELETE", "/push-subscriptions");

        expect(res.status).toBe(400);
    });

    it("removes the subscription", async () => {
        signedInAs();

        const res = await request(
            "DELETE",
            "/push-subscriptions?endpoint=https%3A%2F%2Fpush.example.com%2Fabc"
        );

        expect(res.status).toBe(204);
    });
});

describe("POST /uploads/sign", () => {
    it("returns a signature when Cloudinary is configured", async () => {
        signedInAs();

        const res = await request("POST", "/uploads/sign");

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.signature).toBe("sig");
    });

    it("returns 503 when Cloudinary is not configured", async () => {
        signedInAs();
        isCloudinaryConfigured.mockReturnValueOnce(false);

        const res = await request("POST", "/uploads/sign");

        expect(res.status).toBe(503);
    });
});
