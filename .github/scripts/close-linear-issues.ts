/**
 * Move Linear issues referenced by a release to a Done state.
 *
 * Run by .github/workflows/release-linear.yml when a release is published.
 * Reads a space-separated list of issue identifiers (e.g. "FAM-12 FAM-15")
 * from ISSUE_IDS and, for each, transitions it to the first "completed"-type
 * workflow state on its team. Identifiers that aren't real Linear issues are
 * skipped, so a loose commit-message scan is safe.
 *
 * Env:
 *   LINEAR_API_KEY  (required) — Linear personal API key
 *   ISSUE_IDS       (required) — space-separated issue identifiers
 *   RELEASE_TAG     (optional) — release tag, used in the traceability comment
 *   RELEASE_URL     (optional) — release URL, used in the traceability comment
 */

const apiKey = process.env.LINEAR_API_KEY;
const ids = (process.env.ISSUE_IDS ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
const releaseTag = process.env.RELEASE_TAG ?? "";
const releaseUrl = process.env.RELEASE_URL ?? "";

if (!apiKey) {
    console.error("LINEAR_API_KEY is not set.");
    process.exit(1);
}
if (ids.length === 0) {
    console.log("No Linear issue identifiers provided; nothing to do.");
    process.exit(0);
}

const ENDPOINT = "https://api.linear.app/graphql";

type GraphQLError = { message: string };

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: apiKey as string },
        body: JSON.stringify({ query, variables })
    });
    const json = (await res.json()) as { data?: T; errors?: GraphQLError[] };
    if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join("; "));
    }
    return json.data as T;
}

type WorkflowState = { id: string; name: string; type: string; position: number };
type Issue = {
    id: string;
    identifier: string;
    state: { type: string };
    team: { states: { nodes: WorkflowState[] } };
};

const ISSUE_QUERY = `
  query ($id: String!) {
    issue(id: $id) {
      id
      identifier
      state {
        type
      }
      team {
        states {
          nodes {
            id
            name
            type
            position
          }
        }
      }
    }
  }
`;

const UPDATE_STATE = `
  mutation ($id: String!, $stateId: String!) {
    issueUpdate(id: $id, input: { stateId: $stateId }) {
      success
    }
  }
`;

const ADD_COMMENT = `
  mutation ($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
    }
  }
`;

let failures = 0;

for (const identifier of [...new Set(ids)]) {
    try {
        const { issue } = await gql<{ issue: Issue | null }>(ISSUE_QUERY, { id: identifier });
        if (!issue) {
            console.log(`- ${identifier}: not a Linear issue, skipping`);
            continue;
        }
        if (issue.state.type === "completed" || issue.state.type === "canceled") {
            console.log(`- ${identifier}: already ${issue.state.type}, skipping`);
            continue;
        }

        const done = issue.team.states.nodes
            .filter((s) => s.type === "completed")
            .sort((a, b) => a.position - b.position)[0];
        if (!done) {
            console.log(`- ${identifier}: team has no completed-type state, skipping`);
            continue;
        }

        const { issueUpdate } = await gql<{ issueUpdate: { success: boolean } }>(UPDATE_STATE, {
            id: issue.id,
            stateId: done.id
        });
        if (!issueUpdate.success) {
            console.log(`x ${identifier}: state update returned success=false`);
            failures++;
            continue;
        }
        console.log(`> ${identifier} -> ${done.name}`);

        // Best-effort traceability comment; never fails the run.
        if (releaseTag) {
            const body = releaseUrl
                ? `Shipped in release [${releaseTag}](${releaseUrl}).`
                : `Shipped in release ${releaseTag}.`;
            try {
                await gql(ADD_COMMENT, { issueId: issue.id, body });
            } catch (err) {
                console.log(
                    `  (comment skipped: ${err instanceof Error ? err.message : String(err)})`
                );
            }
        }
    } catch (err) {
        console.log(`x ${identifier}: ${err instanceof Error ? err.message : String(err)}`);
        failures++;
    }
}

if (failures > 0) {
    console.error(`${failures} issue(s) failed to update.`);
    process.exit(1);
}
