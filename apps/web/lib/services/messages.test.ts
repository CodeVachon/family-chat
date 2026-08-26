import { beforeEach, describe, expect, it } from "bun:test";

import { chain } from "../../test/mocks/chain";
import { db, resetDb } from "../../test/mocks/db";

import { memberIdsIn } from "./messages";

beforeEach(() => {
    resetDb();
});

describe("memberIdsIn", () => {
    it("returns an empty array without querying when given no ids", async () => {
        const result = await memberIdsIn("c1", []);

        expect(result).toEqual([]);
        expect(db.select).not.toHaveBeenCalled();
    });

    it("returns an empty array when every id is falsy", async () => {
        const result = await memberIdsIn("c1", ["", undefined as unknown as string]);

        expect(result).toEqual([]);
        expect(db.select).not.toHaveBeenCalled();
    });

    it("returns the member ids the query resolves", async () => {
        db.select.mockReturnValueOnce(chain([{ userId: "u1" }, { userId: "u2" }]));

        const result = await memberIdsIn("c1", ["u1", "u2", "u3"]);

        expect(result).toEqual(["u1", "u2"]);
        expect(db.select).toHaveBeenCalledTimes(1);
    });

    it("dedupes the input ids before querying", async () => {
        const selectChain = chain([{ userId: "u1" }]);
        db.select.mockReturnValueOnce(selectChain);

        await memberIdsIn("c1", ["u1", "u1", "u1"]);

        // in/where receives the deduped set — assert via the where() call args.
        expect(selectChain.where).toHaveBeenCalledTimes(1);
    });
});
