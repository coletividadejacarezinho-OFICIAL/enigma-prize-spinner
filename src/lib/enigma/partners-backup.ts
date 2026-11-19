import { emptySim, type PartnerSim } from "./partners";
import { stableJson } from "./restore";

/** Merge the rehearsal records by ID, rejecting conflicting copies. */
export function mergePartners(localRaw: string | null, incoming: unknown): PartnerSim {
  const check = (value: unknown): PartnerSim => {
    if (!value || typeof value !== "object") throw new Error("Dados dos parceiros inválidos.");
    const sim = value as PartnerSim;
    for (const key of ["invites", "accounts", "offers", "notices"] as const) {
      if (!Array.isArray(sim[key]) || sim[key].some((r) => !r || typeof r.id !== "string"))
        throw new Error("Dados dos parceiros inválidos.");
      if (new Set(sim[key].map((r) => r.id)).size !== sim[key].length)
        throw new Error("Há registros repetidos nos parceiros.");
    }
    if (sim.accounts.some((a) => typeof a.email !== "string") ||
        sim.offers.some((o) => typeof o.name !== "string" || typeof o.prize !== "string" ||
          typeof o.whatsapp !== "string" || !sim.accounts.some((a) => a.id === o.accountId)))
      throw new Error("Há ofertas ou contas inválidas na cópia dos parceiros.");
    return sim;
  };
  const mine = localRaw ? check(JSON.parse(localRaw)) : emptySim();
  const theirs = check(incoming);
  const merge = <T extends { id: string }>(local: T[], other: T[]): T[] => {
    const result = [...local];
    for (const record of other) {
      const found = result.find((r) => r.id === record.id);
      if (found && stableJson(found) !== stableJson(record))
        throw new Error("Um registro dos parceiros já existe com outros dados. Confira a cópia.");
      if (!found) result.push(record);
    }
    return result;
  };
  return {
    ...mine,
    invites: merge(mine.invites, theirs.invites),
    accounts: merge(mine.accounts, theirs.accounts),
    offers: merge(mine.offers, theirs.offers),
    notices: merge(mine.notices, theirs.notices),
  };
}
