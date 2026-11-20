import { useState } from "react";

import { GoldButton } from "./GoldButton";
import { LogoPicker } from "./LogoPicker";
import { fieldClass } from "./fields";
import { formatDescription, formatShopName } from "@/lib/enigma/input-format";
import { cleanWhatsapp, maskWhatsapp } from "@/lib/enigma/partners";
import { WhatsappInput } from "./WhatsappInput";

export type MerchantFormValues = {
  name: string;
  logo: string | undefined;
  whatsapp?: string;
  address?: string;
};

const formatAddress = (text: string) => formatDescription(text.replace(/\s+/g, " "));

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
  const [phone, setPhone] = useState(() => maskWhatsapp(initial?.whatsapp ?? ""));
  const [address, setAddress] = useState(initial?.address ?? "");
  const [tried, setTried] = useState(false);
  const whatsapp = cleanWhatsapp(phone);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        const formatted = formatShopName(name);
        if (!formatted || (phone && !whatsapp)) return;
        const formattedAddress = formatAddress(address);
        onSave({
          name: formatted,
          logo,
          ...(whatsapp ? { whatsapp } : {}),
          ...(formattedAddress ? { address: formattedAddress } : {}),
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-base font-bold">Nome do comércio</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => setName(formatShopName(e.target.value))}
          autoCapitalize="words"
          placeholder="Ex.: Burguer 7"
          className={fieldClass}
          autoComplete="off"
        />
        {tried && !formatShopName(name) && (
          <span className="mt-1 block text-sm font-semibold text-destructive">
            Escreva o nome do comércio.
          </span>
        )}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-base font-bold">Telefone ou WhatsApp (opcional)</span>
        <WhatsappInput value={phone} onValueChange={setPhone} />
        {tried && phone && !whatsapp && (
          <span className="mt-1 block text-sm font-semibold text-destructive">
            Informe um número brasileiro com DDD.
          </span>
        )}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-base font-bold">Endereço comercial (opcional)</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onBlur={(e) => setAddress(formatAddress(e.target.value))}
          autoCapitalize="sentences"
          autoComplete="street-address"
          placeholder="Ex.: Rua Paraná, 100 — Centro"
          className={fieldClass}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        O telefone e o endereço informados aparecem no card de oferecimento da roleta.
      </p>
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
