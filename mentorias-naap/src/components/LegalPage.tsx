export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl card p-6 sm:p-10">
      <h1 className="text-2xl font-semibold text-primary-dark">{title}</h1>
      <p className="mt-1 text-sm text-muted">Última atualização: {updated}</p>
      <div className="mt-6 space-y-4 text-sm leading-relaxed [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary-dark [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}
