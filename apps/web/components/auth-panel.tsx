import type { ReactNode } from 'react';
import Link from 'next/link';
export function AuthPanel({
  title,
  description,
  children,
  member=false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  member?:boolean;
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link className="brand" href="/">
          {member?'GYM / MEMBER':'GYM / OWNER'}
        </Link>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        {children}
      </div>
    </main>
  );
}
