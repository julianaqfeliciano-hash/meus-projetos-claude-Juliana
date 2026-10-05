"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio que pede confirmação antes (para excluir, bloquear etc.). */
export function ConfirmButton({
  message,
  children,
  className = "btn-danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "Aguarde..." : children}
    </button>
  );
}
