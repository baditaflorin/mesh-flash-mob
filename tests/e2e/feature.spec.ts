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

/**
 * The advertised core promise: "all phones flash in sync." The conductor writes
 * a pattern to the shared `pattern` Y.Map; every peer's flash loop reads that
 * shared kind/ts and drives its own flash. The torch hardware is best-effort
 * (`useFlashlight`), but the visual flash *surface* (`.flash-surface[data-on]`)
 * is driven by the same shared-state loop and IS testable headless.
 *
 * This proves the flash genuinely propagates: A (conductor) starts a pattern,
 * and the test asserts peer B's OWN flash surface turns on — the follower
 * actually flashes, not merely that B's pattern label synced.
 */
test("conductor's flash drives the follower's flash surface on", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(600);

    await a.getByRole("button", { name: "take the baton", exact: true }).click();
    await a.waitForTimeout(300);

    // "slow" = 1000 ms period, so the surface stays lit long enough to observe
    // without racing a 120 ms strobe toggle.
    await a.getByRole("button", { name: "slow", exact: true }).click();

    // The load-bearing cross-peer assertion: the FOLLOWER (B) flashes too.
    // The conductor's pattern crossed the mesh and drove B's own surface on.
    await expect(b.locator(".flash-surface")).toHaveAttribute("data-on", "true", {
      timeout: 4000,
    });
    // And the conductor (A) is flashing in sync off the same shared pattern.
    await expect(a.locator(".flash-surface")).toHaveAttribute("data-on", "true", {
      timeout: 4000,
    });
  } finally {
    await cleanup();
  }
});

/**
 * The conductor role is shared, not local: when one peer takes the baton, BOTH
 * peers must agree that the same peer is conducting. `useExpiringClaim` (manual
 * baton) and `useRotatingTurn` (fair auto-rotation by mesh-time slot over the
 * shared roster) both derive the conductor from shared state, so the two peers
 * can never disagree on who holds it.
 */
test("conductor identity agrees across both peers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(600);

    await a.getByRole("button", { name: "take the baton", exact: true }).click();

    // Both peers name alice as the conductor — read on each peer independently.
    await expect(a.locator(".flash-conductor")).toContainText("alice is conducting", {
      timeout: 4000,
    });
    await expect(b.locator(".flash-conductor")).toContainText("alice is conducting", {
      timeout: 4000,
    });
    // The conductor sees the "you're the conductor" badge; the follower does not.
    await expect(a.locator(".flash-badge")).toBeVisible();
    await expect(b.locator(".flash-badge")).toHaveCount(0);
  } finally {
    await cleanup();
  }
});
