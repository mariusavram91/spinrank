import { expect, test, type Page } from "@playwright/test";
import { gotoDashboard } from "../helpers/dashboard";
import { openMatchComposer } from "../helpers/matches";
import { bootstrapPersona, createTestToken, signInAsPersona } from "../helpers/personas";
import { mockParticipantSearch } from "../helpers/participants";

async function forceSelectValue(page: Page, testId: string, value: string, label: string): Promise<void> {
  await page.getByTestId(testId).evaluate(
    (select, args) => {
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error("Expected select element.");
      }

      let option = Array.from(select.options).find((entry) => entry.value === args.value);
      if (!option) {
        option = document.createElement("option");
        option.value = args.value;
        option.textContent = args.label;
        select.append(option);
      }

      select.value = args.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { value, label },
  );
}

test.describe("match validation", () => {
  test("blocks submission when no score is entered", async ({ page, request }) => {
    const token = createTestToken("match-validation-no-score");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Validation Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "Validation Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);

    await forceSelectValue(page, "match-team-a-1", owner.session.user.id, owner.session.user.displayName);
    await forceSelectValue(page, "match-team-b-1", rival.session.user.id, rival.session.user.displayName);
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("match-status")).toContainText("Enter at least one game score.");
    await expect(page.getByTestId("dashboard-screen")).toBeHidden();
  });

  test("blocks tied game scores", async ({ page, request }) => {
    const token = createTestToken("match-validation-tie");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Tie Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "Tie Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);

    await forceSelectValue(page, "match-team-a-1", owner.session.user.id, owner.session.user.displayName);
    await forceSelectValue(page, "match-team-b-1", rival.session.user.id, rival.session.user.displayName);
    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("11");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("match-status")).toContainText("A ranked match must have a winner.");
  });

  test("blocks submission when duplicate players are selected", async ({ page, request }) => {
    const token = createTestToken("match-validation-duplicate");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "Duplicate Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "Duplicate Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);

    await forceSelectValue(page, "match-team-a-1", rival.session.user.id, rival.session.user.displayName);
    await forceSelectValue(page, "match-team-b-1", rival.session.user.id, rival.session.user.displayName);
    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("7");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("match-status")).toContainText(
      "You can only create a match if you are one of the participants.",
    );
  });

  test("blocks submission when the signed-in user is not a participant", async ({ page, request }) => {
    const token = createTestToken("match-validation-participant");
    await signInAsPersona(page, request, "owner", token, {
      displayName: "Participant Owner",
    });
    const rivalOne = await bootstrapPersona(request, "rival", `${token}-one`, {
      displayName: "Participant Rival One",
    });
    const rivalTwo = await bootstrapPersona(request, "guest", `${token}-two`, {
      displayName: "Participant Rival Two",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [
        { userId: rivalOne.session.user.id, displayName: rivalOne.session.user.displayName },
        { userId: rivalTwo.session.user.id, displayName: rivalTwo.session.user.displayName },
      ],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);

    await forceSelectValue(page, "match-team-a-1", rivalOne.session.user.id, rivalOne.session.user.displayName);
    await forceSelectValue(page, "match-team-b-1", rivalTwo.session.user.id, rivalTwo.session.user.displayName);
    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("7");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("match-status")).toContainText(
      "You can only create a match if you are one of the participants.",
    );
  });

  test("blocks best-of-3 submission without enough decisive games", async ({ page, request }) => {
    const token = createTestToken("match-validation-bestof3");
    const owner = await signInAsPersona(page, request, "owner", token, {
      displayName: "Best Of Three Owner",
    });
    const rival = await bootstrapPersona(request, "rival", token, {
      displayName: "Best Of Three Rival",
    });

    await mockParticipantSearch(page, {
      segmentType: "season",
      participants: [{ userId: rival.session.user.id, displayName: rival.session.user.displayName }],
    });

    await gotoDashboard(page);
    await openMatchComposer(page);

    await page.getByTestId("match-format-best_of_3").click();
    await forceSelectValue(page, "match-team-a-1", owner.session.user.id, owner.session.user.displayName);
    await forceSelectValue(page, "match-team-b-1", rival.session.user.id, rival.session.user.displayName);
    await page.getByTestId("match-score-0-team-a").fill("11");
    await page.getByTestId("match-score-0-team-b").fill("7");
    await page.getByTestId("match-submit").click();

    await expect(page.getByTestId("match-status")).toContainText("The match must include enough decisive games.");
  });
});
