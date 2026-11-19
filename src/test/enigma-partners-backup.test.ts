import { expect, it } from "vitest";
import { mergePartners } from "@/lib/enigma/partners-backup";
import { emptySim } from "@/lib/enigma/partners";

it("mescla registros iguais sem duplicar e recusa conteúdo conflitante", () => {
  const original = { ...emptySim(), accounts: [{ id: "a", email: "a@exemplo.com" }] };
  expect(mergePartners(JSON.stringify(original), original).accounts).toHaveLength(1);
  expect(() => mergePartners(JSON.stringify(original), {
    ...original, accounts: [{ id: "a", email: "outro@exemplo.com" }],
  })).toThrow();
});
it("recusa registros duplicados, ofertas sem conta e dados malformados", () => {
  const account = { id: "a", email: "a@exemplo.com" };
  expect(() => mergePartners(null, { ...emptySim(), accounts: [account, account] })).toThrow();
  expect(() => mergePartners(null, { ...emptySim(), offers: [{ id: "o", accountId: "ausente", name: "Loja", prize: "Pão", whatsapp: "43999990000" }] })).toThrow();
  expect(() => mergePartners(null, { ...emptySim(), offers: null })).toThrow();
});
