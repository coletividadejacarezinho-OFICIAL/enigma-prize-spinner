import { partnersRepo } from "@/lib/enigma/partners-repo";
import { SecondaryButton } from "./GoldButton";

export function PartnerRecovery() {
  return (
    <section className="rounded-2xl bg-card p-4" role="alert">
      <h2 className="text-xl font-bold">Confira os dados dos parceiros</h2>
      <p className="mt-2">Não foi possível abrir os registros neste aparelho. Tente novamente ou restaure uma cópia em Ajustes.</p>
      <SecondaryButton onClick={() => partnersRepo.reload()} className="mt-3">
        Tentar ler novamente
      </SecondaryButton>
    </section>
  );
}
