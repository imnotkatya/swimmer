import { test, expect } from "@playwright/test";

test("test", async ({ page }) => {
  await page.goto("http://localhost:5173/");
  await page
    .getByText("Нажмите в любом месте или перетащите Excel файл")
    .click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles("dist/info_template.xlsx");
  await expect(page.getByRole("heading")).toMatchAriaSnapshot(
    `- heading "Swimmer Plot" [level=1]`
  );

  await expect(page.getByRole("img")).toContainText("name");
  await page.getByText("первый период").click();
});
