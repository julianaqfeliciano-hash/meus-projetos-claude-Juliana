import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Profile } from "@/lib/types";

export function Header({ profile }: { profile?: Profile | null }) {
  const isAdmin = profile?.role === "admin";
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Logo href={profile ? (isAdmin ? "/admin" : "/mentorias") : "/"} />
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {profile ? (
            <>
              {isAdmin ? (
                <>
                  <NavLink href="/admin">Relatórios</NavLink>
                  <NavLink href="/admin/alunos">Alunos</NavLink>
                  <NavLink href="/admin/modulos">Módulos</NavLink>
                  <NavLink href="/admin/vendas">Vendas</NavLink>
                </>
              ) : (
                <NavLink href="/mentorias">Minhas mentorias</NavLink>
              )}
              <NavLink href="/conta">Minha conta</NavLink>
              <form action="/sair" method="post">
                <button type="submit" className="btn-outline ml-1">Sair</button>
              </form>
            </>
          ) : (
            <>
              <NavLink href="/entrar">Entrar</NavLink>
              <Link href="/cadastro" className="btn-primary ml-1">Cadastre-se</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg px-3 py-2 text-foreground hover:bg-soft hover:text-primary">
      {children}
    </Link>
  );
}
