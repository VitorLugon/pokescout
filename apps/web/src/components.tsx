import type { ReactNode } from 'react';
import { publicLink } from './presentation';

export function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  const href = publicLink(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children} <span aria-hidden="true">↗</span></a> : <span>Link de origem não informado</span>;
}
export function Loading({ children }: { children: ReactNode }) { return <p role="status" className="notice">{children}</p>; }
export function Failure({ retry, children = 'Não foi possível consultar a API. Verifique se ela está em execução e tente novamente.' }: { retry: () => void; children?: ReactNode }) {
  return <div className="notice error" role="alert"><p>{children}</p><button onClick={retry}>Tentar novamente</button></div>;
}
