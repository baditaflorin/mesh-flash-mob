import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("conductor's pattern change syncs to followers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(600);

    await a.getByRole("button", { name: "take the baton", exact: true }).click();
    await a.waitForTimeout(300);

    await a.getByRole("button", { name: "strobe", exact: true }).click();
    await expect(b.locator(".flash-current")).toHaveAttribute("data-kind", "strobe");
  } finally {
    await cleanup();
  }
});
