// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantForm } from "@/components/enigma/MerchantForm";
import { WhatsappInput } from "@/components/enigma/WhatsappInput";
import { formatDescription, formatPersonName, formatShopName } from "@/lib/enigma/input-format";
import { parsePastedList } from "@/lib/enigma/logic";
import { cleanWhatsapp, maskWhatsapp } from "@/lib/enigma/partners";

afterEach(cleanup);

function PhoneField() {
  const [value, setValue] = useState("");
  return <WhatsappInput value={value} onValueChange={setValue} />;
}

describe("formatação dos campos", () => {
  it("normaliza nomes digitados ou colados mantendo acentos e formatos próprios", () => {
    expect(formatPersonName("  MARIA    das  DORES ")).toBe("Maria das Dores");
    expect(formatPersonName("ana-clara McDonald (vila rosa)")).toBe(
      "Ana-Clara McDonald (Vila Rosa)",
    );
    expect(parsePastedList("1. ana costa\r\n\r\n2) JOÃO DE SÁ").map(formatPersonName)).toEqual([
      "Ana Costa",
      "João de Sá",
    ]);
  });

  it("mantém siglas e marcas e preserva os parágrafos de uma cortesia", () => {
    expect(formatShopName("  iFood   B2B ")).toBe("iFood B2B");
    expect(formatShopName("padaria   do bairro")).toBe("Padaria do Bairro");
    expect(formatDescription("  uma   cortesia!\r\n\r\n  Somente às sextas.  ")).toBe(
      "Uma cortesia!\n\nSomente às sextas.",
    );
    expect(formatDescription("iPhone com capa")).toBe("iPhone com capa");
  });

  it("formata o comércio ao enviar o formulário sem depender de sair do campo", () => {
    const save = vi.fn();
    render(<MerchantForm onSave={save} />);
    const name = screen.getByRole<HTMLInputElement>("textbox", { name: "Nome do comércio" });
    fireEvent.change(name, { target: { value: "padaria   do bairro" } });
    fireEvent.submit(name.form!);
    expect(save).toHaveBeenCalledWith({ name: "Padaria do Bairro", logo: undefined });
  });

  it("valida o telefone opcional e salva o endereço comercial padronizado", () => {
    const save = vi.fn();
    render(<MerchantForm initial={{ name: "Padaria", logo: undefined }} onSave={save} />);
    const phone = screen.getByRole<HTMLInputElement>("textbox", { name: /Telefone ou WhatsApp/ });
    const address = screen.getByRole<HTMLInputElement>("textbox", { name: /Endereço comercial/ });
    fireEvent.input(phone, { target: { value: "439" } });
    fireEvent.submit(phone.form!);
    expect(save).not.toHaveBeenCalled();
    fireEvent.input(phone, { target: { value: "4333330000" }, inputType: "insertFromPaste" });
    fireEvent.change(address, { target: { value: "  rua   Paraná,  100 — Centro " } });
    fireEvent.submit(phone.form!);
    expect(save).toHaveBeenCalledWith({
      name: "Padaria",
      logo: undefined,
      whatsapp: "4333330000",
      address: "Rua Paraná, 100 — Centro",
    });
  });

  it("máscara de WhatsApp aceita telefone fixo, celular, DDD 55 e números do Brasil com +55", () => {
    for (const [raw, visible, saved] of [
      ["4333330000", "(43) 3333-0000", "4333330000"],
      ["43999990000", "(43) 99999-0000", "43999990000"],
      ["55999990000", "(55) 99999-0000", "55999990000"],
      ["+5543999990000", "+55 (43) 99999-0000", "43999990000"],
      ["554333330000", "+55 (43) 3333-0000", "4333330000"],
    ]) {
      expect(maskWhatsapp(raw!)).toBe(visible);
      expect(cleanWhatsapp(visible!)).toBe(saved);
    }
    expect(cleanWhatsapp(maskWhatsapp("+1 202 555 0110"))).toBeNull();
    expect(cleanWhatsapp(maskWhatsapp("(55) 9999900000"))).toBeNull();
  });

  it("formata ao digitar ou colar e permite apagar através do hífen", () => {
    render(<PhoneField />);
    const phone = screen.getByRole<HTMLInputElement>("textbox");
    fireEvent.input(phone, { target: { value: "439" }, inputType: "insertText" });
    expect(phone.value).toBe("(43) 9");
    fireEvent.input(phone, { target: { value: "4333330000" }, inputType: "insertFromPaste" });
    expect(phone.value).toBe("(43) 3333-0000");
    fireEvent.input(phone, {
      target: { value: "(43) 33330000", selectionStart: 9, selectionEnd: 9 },
      inputType: "deleteContentBackward",
    });
    expect(phone.value).toBe("(43) 3330-000");
  });

  it("distingue DDD 55 e código do Brasil quando o número é digitado aos poucos", () => {
    render(<PhoneField />);
    const phone = screen.getByRole<HTMLInputElement>("textbox");
    const type = (value: string) => {
      for (const digit of value) {
        fireEvent.input(phone, { target: { value: phone.value + digit }, inputType: "insertText" });
      }
    };
    type("55999990000");
    expect(phone.value).toBe("(55) 99999-0000");
    fireEvent.input(phone, { target: { value: "" }, inputType: "deleteContentBackward" });
    type("5543999990000");
    expect(phone.value).toBe("+55 (43) 99999-0000");
    expect(cleanWhatsapp(phone.value)).toBe("43999990000");
  });

  it("mantém o DDD explícito entre parênteses ao editar um número colado", () => {
    render(<PhoneField />);
    const phone = screen.getByRole<HTMLInputElement>("textbox");
    fireEvent.input(phone, { target: { value: "(55) 99999-0000" }, inputType: "insertFromPaste" });
    fireEvent.input(phone, { target: { value: phone.value + "1" }, inputType: "insertText" });
    expect(phone.value).toBe("(55) 99999-00001");
    expect(cleanWhatsapp(phone.value)).toBeNull();
  });
});
