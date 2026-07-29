import {
  expect,
  test,
  type Locator,
  type Page,
} from "@playwright/test";

type FilterControls = {
  container: Locator;
  isMobile: boolean;
};

async function openFilterControls(
  page: Page,
): Promise<FilterControls> {
  const mobileTrigger = page.getByRole("button", {
    name: /^지진 필터/,
  });
  const isMobile = await mobileTrigger.isVisible();

  if (isMobile) {
    await mobileTrigger.click();
    return {
      container: page.getByRole("dialog", { name: "지진 필터" }),
      isMobile,
    };
  }

  return {
    container: page.getByRole("region", { name: "지진 필터" }),
    isMobile,
  };
}

async function mockUnavailableApi(page: Page) {
  await page.route(
    /^https?:\/\/(?:localhost|127\.0\.0\.1):8000\/v1\//,
    (route) => route.abort(),
  );
}

function resultCount({
  container,
  isMobile,
}: FilterControls) {
  return isMobile
    ? container
        .locator(".mobile-filter-metrics > div")
        .filter({ hasText: "RESULT" })
        .locator("strong")
    : container.locator(".filter-result strong");
}

function resultRows(
  page: Page,
  { container, isMobile }: FilterControls,
) {
  return isMobile
    ? container.locator(".mobile-filter-results button")
    : page.locator(".event-row");
}

test.beforeEach(async ({ page }) => {
  await mockUnavailableApi(page);
});

test("stores filters in the URL and restores them after reload", async ({
  page,
}) => {
  await page.goto("/?view=globe#focus");
  const historyLengthBefore = await page.evaluate(
    () => window.history.length,
  );
  let controls = await openFilterControls(page);
  await expect(resultCount(controls)).toHaveText("10");

  await controls.container
    .getByRole("button", { name: "6시간" })
    .click();
  await controls.container
    .getByRole("button", { name: "M4+" })
    .click();
  await controls.container
    .getByRole("button", { name: "깊음, 300킬로미터 이상" })
    .click();

  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        hours: url.searchParams.get("hours"),
        minMag: url.searchParams.get("minMag"),
        depth: url.searchParams.get("depth"),
        view: url.searchParams.get("view"),
        hash: url.hash,
      };
    })
    .toEqual({
      hours: "6",
      minMag: "4",
      depth: "deep",
      view: "globe",
      hash: "#focus",
    });
  await expect
    .poll(() => page.evaluate(() => window.history.length))
    .toBe(historyLengthBefore);

  await expect(resultCount(controls)).toHaveText("1");
  await expect(resultRows(page, controls)).toHaveCount(1);

  await page.reload();
  const dashboard = page.locator("main.quakecurrent-app");
  await expect(dashboard).toHaveAttribute("data-filter-hours", "6");
  await expect(dashboard).toHaveAttribute(
    "data-filter-min-magnitude",
    "4",
  );
  await expect(dashboard).toHaveAttribute(
    "data-filter-depth",
    "deep",
  );
  await expect(
    page.getByText("USGS · PAST 6 HOURS", { exact: true }),
  ).toBeVisible();

  controls = await openFilterControls(page);
  await expect(resultCount(controls)).toHaveText("1");
  await expect(resultRows(page, controls)).toHaveCount(1);
  await expect(
    controls.container.getByRole("button", { name: "6시간" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    controls.container.getByRole("button", { name: "M4+" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    controls.container.getByRole("button", {
      name: "깊음, 300킬로미터 이상",
    }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("reset removes filter parameters and restores defaults", async ({
  page,
}) => {
  await page.goto(
    "/?hours=1&minMag=5&depth=shallow&view=globe#focus",
  );
  const controls = await openFilterControls(page);

  await controls.container
    .getByRole("button", {
      name: controls.isMobile ? "초기화" : "RESET",
      exact: true,
    })
    .click();

  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        search: url.search,
        hash: url.hash,
      };
    })
    .toEqual({
      search: "?view=globe",
      hash: "#focus",
    });
  const dashboard = page.locator("main.quakecurrent-app");
  await expect(dashboard).toHaveAttribute("data-filter-hours", "24");
  await expect(dashboard).toHaveAttribute(
    "data-filter-min-magnitude",
    "0",
  );
  await expect(dashboard).toHaveAttribute(
    "data-filter-depth",
    "all",
  );
});

test("normalizes invalid values without dropping unrelated URL state", async ({
  page,
}) => {
  await page.goto(
    "/?hours=01&minMag=5&depth=unknown&view=globe#focus",
  );

  const dashboard = page.locator("main.quakecurrent-app");
  await expect(dashboard).toHaveAttribute("data-filter-hours", "24");
  await expect(dashboard).toHaveAttribute(
    "data-filter-min-magnitude",
    "5",
  );
  await expect(dashboard).toHaveAttribute(
    "data-filter-depth",
    "all",
  );

  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        hours: url.searchParams.get("hours"),
        minMag: url.searchParams.get("minMag"),
        depth: url.searchParams.get("depth"),
        view: url.searchParams.get("view"),
        hash: url.hash,
      };
    })
    .toEqual({
      hours: null,
      minMag: "5",
      depth: null,
      view: "globe",
      hash: "#focus",
    });
});

test("restores filters from popstate navigation", async ({
  page,
}) => {
  await page.goto("/");
  const controls = await openFilterControls(page);
  await controls.container
    .getByRole("button", { name: "6시간" })
    .click();
  await controls.container
    .getByRole("button", { name: "M4+" })
    .click();
  await controls.container
    .getByRole("button", { name: "깊음, 300킬로미터 이상" })
    .click();
  await expect
    .poll(() => new URL(page.url()).search)
    .toBe("?hours=6&minMag=4&depth=deep");

  await page.evaluate(() => {
    window.history.pushState(
      window.history.state,
      "",
      "/?hours=1&minMag=5&depth=shallow",
    );
    window.dispatchEvent(
      new PopStateEvent("popstate", {
        state: window.history.state,
      }),
    );
  });

  const dashboard = page.locator("main.quakecurrent-app");
  await expect(dashboard).toHaveAttribute("data-filter-hours", "1");
  await expect(dashboard).toHaveAttribute(
    "data-filter-min-magnitude",
    "5",
  );
  await expect(dashboard).toHaveAttribute(
    "data-filter-depth",
    "shallow",
  );

  await page.goBack();
  await expect(dashboard).toHaveAttribute("data-filter-hours", "6");
  await expect(dashboard).toHaveAttribute(
    "data-filter-min-magnitude",
    "4",
  );
  await expect(dashboard).toHaveAttribute(
    "data-filter-depth",
    "deep",
  );

  await page.goForward();
  await expect(dashboard).toHaveAttribute("data-filter-hours", "1");
  await expect(dashboard).toHaveAttribute(
    "data-filter-min-magnitude",
    "5",
  );
  await expect(dashboard).toHaveAttribute(
    "data-filter-depth",
    "shallow",
  );
});

test("clears query filters when the brand navigates to the root route", async ({
  page,
}) => {
  await page.goto("/?hours=6&minMag=4&depth=deep");
  const dashboard = page.locator("main.quakecurrent-app");
  await expect(dashboard).toHaveAttribute("data-filter-hours", "6");

  await page
    .getByRole("link", { name: "QUAKECURRENT", exact: true })
    .click();

  await expect(page).toHaveURL("/");
  await expect(dashboard).toHaveAttribute("data-filter-hours", "24");
  await expect(dashboard).toHaveAttribute(
    "data-filter-min-magnitude",
    "0",
  );
  await expect(dashboard).toHaveAttribute(
    "data-filter-depth",
    "all",
  );
});
