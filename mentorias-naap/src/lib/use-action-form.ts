"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { ActionState } from "@/lib/action-state";

/**
 * Envia um formulário para uma Server Action sem que o React limpe os campos.
 * (Com <form action={...}>, o React 19 apaga o que foi digitado após o envio,
 * inclusive quando a ação devolve um erro — o usuário teria de redigitar tudo.)
 */
export function useActionForm(action: (state: ActionState, form: FormData) => Promise<ActionState>) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }
  return { state, onSubmit, pending };
}
