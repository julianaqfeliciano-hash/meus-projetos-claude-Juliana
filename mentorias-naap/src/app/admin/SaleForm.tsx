"use client";

import { useActionState, useEffect, useRef } from "react";
import { registerSale } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { FormMessage } from "@/components/FormMessage";
import { paymentMethods } from "@/lib/types";

type Option = { id: string; label: string };

export function SaleForm({
  students,
  studentId,
  modules,
  pendingApproval,
}: {
  students?: Option[];
  studentId?: string;
  modules: Option[];
  pendingApproval?: boolean;
}) {
  const [state, action] = useActionState(registerSale, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      {studentId ? (
        <input type="hidden" name="student_id" value={studentId} />
      ) : (
        <div>
          <label className="label" htmlFor="student_id">Aluno</label>
          <select className="input" id="student_id" name="student_id" required defaultValue="">
            <option value="" disabled>Selecione…</option>
            {students?.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}
      <fieldset>
        <legend className="label">Módulos comprados</legend>
        {modules.length === 0 ? (
          <p className="text-sm text-muted">Cadastre um módulo primeiro.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {modules.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="module_ids" value={m.id} /> {m.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="amount">Valor (R$)</label>
          <input className="input" id="amount" name="amount" type="number" min="0" step="0.01" required />
        </div>
        <div>
          <label className="label" htmlFor="payment_method">Pagamento</label>
          <select className="input" id="payment_method" name="payment_method" defaultValue="pix">
            {Object.entries(paymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sold_on">Data</label>
          <input className="input" id="sold_on" name="sold_on" type="date" defaultValue={today} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="notes">Observações</label>
        <input className="input" id="notes" name="notes" placeholder="Opcional" />
      </div>
      {(pendingApproval ?? !studentId) && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="approve" defaultChecked /> Aprovar o cadastro do aluno (envia e-mail de aprovação)
        </label>
      )}
      <FormMessage state={state} />
      <SubmitButton pendingText="Registrando...">Registrar venda e liberar módulos</SubmitButton>
    </form>
  );
}
