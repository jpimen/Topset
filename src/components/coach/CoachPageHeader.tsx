export function CoachPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="coach-page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="coach-header-actions">{actions}</div>}</header>;
}
