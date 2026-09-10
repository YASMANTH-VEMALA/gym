import { Suspense,type ReactNode } from 'react';
import { MemberFrame } from '@/features/portal/member-shell';
export default function Layout({children}:{children:ReactNode}){return <Suspense fallback={<p className="p-6">Loading member account…</p>}><MemberFrame>{children}</MemberFrame></Suspense>;}
