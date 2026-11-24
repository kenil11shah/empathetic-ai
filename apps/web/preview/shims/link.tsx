import type { AnchorHTMLAttributes, ReactNode } from "react";
import { navigate } from "./navigation";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean };

export default function Link({ href, onClick, children, prefetch, ...rest }: Props) {
  void prefetch;
  const internal = href.startsWith("/");
  return (
    <a
      href={internal ? `#${href.replace(/[^a-z0-9-]/gi, "-")}` : href}
      target={internal ? undefined : "_blank"}
      rel={internal ? undefined : "noreferrer"}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !internal) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
