import { beforeEach, describe, expect, it } from "bun:test";

import { db, resetDb } from "../../test/mocks/db";

import { validateDefaultChannelIds } from "./app-settings";

beforeEach(() => {
    resetDb();
});

describe("validateDefaultChannelIds", () => {
    it("returns an empty array without querying when given no ids", async () => {
        const result = await validateDefaultChannelIds([]);

        expect(result).toEqual([]);
        expect(db.query.channels.findMany).not.toHaveBeenCalled();
    });

    it("dedupes the input before validating", async () => {
        db.query.channels.findMany.mockResolvedValueOnce([{ id: "c1" }]);

        const result = await validateDefaultChannelIds(["c1", "c1"]);

        expect(result).toEqual(["c1"]);
    });

    it("throws when a channel id does not resolve to an existing public channel", async () => {
        db.query.channels.findMany.mockResolvedValueOnce([{ id: "c1" }]);

        await expect(validateDefaultChannelIds(["c1", "c2"])).rejects.toMatchObject({
            message: "Default channels must be existing public channels",
            status: 400
        });
    });

    it("returns the ids when all are valid public, non-archived channels", async () => {
        db.query.channels.findMany.mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }]);

        const result = await validateDefaultChannelIds(["c1", "c2"]);

        expect(result).toEqual(["c1", "c2"]);
    });
});
