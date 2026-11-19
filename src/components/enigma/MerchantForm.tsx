import { useState } from "react";

import { GoldButton } from "./GoldButton";
import { LogoPicker } from "./LogoPicker";
import { fieldClass } from "./fields";
import { cleanName } from "@/lib/enigma/logic";

export type MerchantFormValues = { name: string; logo: string | undefined };

/** Only the shop name is required; the logo is optional. */
export function MerchantForm({
  initial,
  onSave,
}: {
  initial?: MerchantFormValues;
  onSave: (values: MerchantFormValues) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [logo, setLogo] = useState<string | undefined>(initial?.logo);
  const [tried, setTried] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!cleanName(name)) return;
        onSave({ name: cleanName(name), logo });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-base font-bold">Nome do comércio</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Burguer 7"
          className={fieldClass}
          autoComplete="off"
        />
        {tried && !cleanName(name) && (
          <span className="mt-1 block text-sm font-semibold text-destructive">
            Escreva o nome do comércio.
          </span>
        )}
      </label>
      <div>
        <span className="mb-1.5 block text-base font-bold">
          Logo <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <LogoPicker value={logo} onChange={setLogo} />
      </div>
      <GoldButton type="submit">Salvar comércio</GoldButton>
    </form>
  );
}
