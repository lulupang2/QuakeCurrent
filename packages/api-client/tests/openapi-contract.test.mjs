import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  changedArtifacts,
  renderTypeScript,
} from "../scripts/openapi-contract.mjs";

test("line-ending differences are not contract drift", () => {
  const changed = changedArtifacts(
    { schema: "schema\n", types: "types\n" },
    { schema: "schema\r\n", types: "types\r\n" },
  );

  assert.deepEqual(changed, []);
});

test("changed generated content is reported by artifact name", () => {
  const changed = changedArtifacts(
    { schema: "next schema\n", types: "next types\n" },
    { schema: "old schema\n", types: "next types\n" },
  );

  assert.deepEqual(changed, ["schema"]);
});

test("an OpenAPI field change is reflected in generated TypeScript", async () => {
  const schemaUrl = new URL("../openapi.json", import.meta.url);
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
  schema.components.schemas.HealthResponse.properties.revision = {
    type: "string",
  };
  schema.components.schemas.HealthResponse.required.push("revision");

  const generated = await renderTypeScript(`${JSON.stringify(schema)}\n`);

  assert.match(generated, /revision: string;/);
});
