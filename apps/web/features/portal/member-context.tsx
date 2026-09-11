'use client';
import { createContext,useContext,type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter,useSearchParams } from 'next/navigation';
import { api } from '@/lib/api/auth-api';
import { Panel,LoadState } from '@/features/product/ui';
export interface MemberLink {memberId:string;businessId:string;member:{fullName:string;memberNumber:string;status:string};business:{name:string;currency:string;timezone:string;logoUrl?:string|null}}
const Context=createContext<{current:MemberLink;links:MemberLink[];href:(path:string)=>string}|null>(null);
export function MemberProvider({children}:{children:ReactNode}){
 const params=useSearchParams(),router=useRouter();const query=useQuery({queryKey:['member-links'],queryFn:()=>api<MemberLink[]>('/member/links'),retry:false});const requested=params.get('memberId');const current=requested?query.data?.find(l=>l.memberId===requested):query.data?.[0];
 if(query.isPending || query.error)return <div className="mx-auto max-w-lg p-6"><LoadState pending={query.isPending} error={query.error} retry={query.refetch}/></div>;
 if(!current)return <div className="mx-auto max-w-lg p-6"><Panel title={requested?'Profile unavailable':'Connect your gym profile'}><p>{requested?'This profile is not linked to your account.':'Scan your gym’s branch registration QR, or ask staff to email a secure invitation for your existing member profile.'}</p>{requested && <button onClick={()=>router.replace('/member')}>My profiles</button>}<a className="text-blue-700" href="/member/sign-in">Member sign-in</a></Panel></div>;
 return <Context.Provider value={{current,links:query.data,href:path=>`${path}?memberId=${current.memberId}`}}>{children}</Context.Provider>;
}
export function useMemberContext(){const ctx=useContext(Context);if(!ctx)throw new Error('MemberProvider is required');return ctx;}
export function useMemberQuery<T>(path='',page=1){const {current}=useMemberContext();return useQuery({queryKey:['member-profile',current.memberId,path,page],queryFn:()=>api<T>(`/member/profiles/${current.memberId}${path?'/'+path:''}?page=${page}`),retry:false});}
