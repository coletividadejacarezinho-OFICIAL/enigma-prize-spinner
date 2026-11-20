// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { AppHeader } from "@/components/enigma/AppHeader";
import { SponsorCard } from "@/components/enigma/SponsorCard";
import { GROUP_NAME } from "@/lib/enigma/types";

afterEach(cleanup);

it("highlights the registered group logo and participant count only on the wheel", () => {
  const logo = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'/%3E";
  const { container } = render(<AppHeader logo={logo} subtitle="73 participantes" premium />);

  expect(screen.getByText(GROUP_NAME)).toBeTruthy();
  expect(screen.getByText("73 participantes")).toBeTruthy();
  expect(container.querySelector(".enigma-brand-header")).toBeTruthy();
  expect(container.querySelector(".enigma-brand-count")).toBeTruthy();
  expect(screen.getByAltText("Logo do grupo").getAttribute("src")).toBe(logo);
});

it("keeps the original compact header on other screens", () => {
  const { container } = render(<AppHeader subtitle="Ajustes" />);

  expect(screen.getByText(GROUP_NAME)).toBeTruthy();
  expect(screen.getByText("Ajustes")).toBeTruthy();
  expect(container.querySelector(".enigma-brand-header")).toBeNull();
  expect(container.querySelector(".enigma-brand-count")).toBeNull();
});

it("preserves the exact merchant logo and prize while distinguishing courtesy 4 of 7", () => {
  const logo = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'/%3E";
  render(
    <SponsorCard
      logo={logo}
      merchantName="Curto Burguer"
      prize="Combo especial com acompanhamentos"
      roundIndex={3}
      roundTotal={7}
    />,
  );

  expect(screen.getByAltText("Logo do comércio").getAttribute("src")).toBe(logo);
  expect(screen.getByText("Curto Burguer")).toBeTruthy();
  expect(screen.getByText("Prêmio 4 de 7")).toBeTruthy();
  expect(screen.getByTestId("prize-label").textContent).toBe("Combo especial com acompanhamentos");
});

it("does not show a multi-prize label for a single courtesy", () => {
  const { container } = render(
    <SponsorCard merchantName="Parceiro Local" prize="Cortesia especial" roundIndex={0} roundTotal={1} />,
  );

  expect(screen.queryByText(/Prêmio 1 de 1/)).toBeNull();
  expect(screen.getByTestId("prize-label").textContent).toBe("Cortesia especial");
  expect(container.querySelector(".enigma-sponsor-card")).toBeTruthy();
});
