// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { WinnerAnnouncement } from "@/components/enigma/WinnerAnnouncement";

afterEach(cleanup);

it("shows the exact saved winner, number, courtesy and merchant separately", () => {
  const { container } = render(
    <WinnerAnnouncement
      winner="Priscila Salles Galvão"
      winnerNumber={47}
      prize="Combo especial"
      merchantName="Curto Burguer"
      roundIndex={3}
      roundTotal={7}
    />,
  );

  expect(screen.getByRole("status")).toBeTruthy();
  expect(screen.getByTestId("winner").textContent).toContain("Priscila Salles Galvão");
  expect(screen.getByTestId("winner-number").textContent).toBe("Nº 47");
  expect(screen.getByText("Prêmio 4 de 7")).toBeTruthy();
  expect(screen.getByText("Combo especial")).toBeTruthy();
  expect(screen.getByText("Curto Burguer")).toBeTruthy();
  expect(container.querySelector(".enigma-winner-card")).toBeTruthy();
  expect(container.querySelector(".enigma-winner-name")).toBeTruthy();
});

it("handles a single courtesy and an absent number without inventing a badge", () => {
  render(
    <WinnerAnnouncement
      winner="Maria de Souza"
      winnerNumber={null}
      prize="Uma cortesia"
      merchantName="Comércio parceiro"
      roundIndex={0}
      roundTotal={1}
    />,
  );

  expect(screen.getByTestId("winner").textContent).toBe("Maria de Souza");
  expect(screen.queryByTestId("winner-number")).toBeNull();
  expect(screen.queryByText(/Prêmio 1 de 1/)).toBeNull();
  expect(screen.getByText("Uma cortesia")).toBeTruthy();
});

it("keeps a long winner name in the DOM and enables scroll inside the announcement", () => {
  const fullName = "Mariana Marcial Barbosa de Almeida dos Santos";
  const { container } = render(
    <WinnerAnnouncement
      winner={fullName}
      winnerNumber={250}
      prize="Cesta de produtos artesanais"
      merchantName="Massas Artesanais do Batatinha"
      roundIndex={0}
      roundTotal={2}
    />,
  );

  expect(screen.getByTestId("winner").textContent).toContain(fullName);
  expect(screen.getByTestId("winner-number").textContent).toBe("Nº 250");
  expect(container.querySelector(".enigma-winner-card")?.classList.contains("overflow-y-auto")).toBe(true);
  expect(container.querySelector(".enigma-winner-name")?.classList.contains("text-foreground")).toBe(true);
  expect(screen.getByText("Prêmio 1 de 2")).toBeTruthy();
});
