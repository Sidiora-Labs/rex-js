import { unsafeHtml } from "@sidioralabs/rex/client";
import { typographyVariants } from "./ui/typography.tsx";
import { cn } from "./ui/utils.ts";

const PROSE_ELEMENTS = [
  "min-w-0 max-w-[75ch] break-words",
  "[&_h2]:mt-2 [&_h2]:mb-6 [&_h2]:scroll-mt-20 [&_h2]:text-[clamp(2rem,4vw,2.75rem)] [&_h2]:leading-[1.08] [&_h2]:font-normal [&_h2]:tracking-[-0.03em]",
  "[&_h3]:mt-12 [&_h3]:mb-4 [&_h3]:scroll-mt-20 [&_h3]:text-[1.75rem] [&_h3]:leading-[1.15] [&_h3]:font-normal [&_h3]:tracking-[-0.02em]",
  "[&_h4]:mt-8 [&_h4]:mb-3 [&_h4]:scroll-mt-20 [&_h4]:text-xl [&_h4]:leading-tight [&_h4]:font-medium [&_h4]:tracking-[-0.015em]",
  "[&_h5]:mt-6 [&_h5]:mb-2 [&_h5]:scroll-mt-20 [&_h5]:text-lg [&_h5]:leading-snug [&_h5]:font-medium",
  "[&_h6]:mt-6 [&_h6]:mb-2 [&_h6]:scroll-mt-20 [&_h6]:text-base [&_h6]:font-medium",
  "[&_p]:my-4 [&_li]:my-1.5 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_a]:text-primary [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-4 [&_a:hover]:decoration-2",
  "[&_strong]:font-semibold [&_hr]:my-10 [&_hr]:border-border",
  "[&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-foreground [&_blockquote]:pl-5 [&_blockquote]:italic",
  "[&_:not(pre)>code]:rounded-xs [&_:not(pre)>code]:bg-container [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.88em]",
  "[&_pre]:my-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-outline-variant [&_pre]:bg-container [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-6",
  "[&_.shiki_span]:[color:light-dark(var(--shiki-light),var(--shiki-dark))]",
  "[&_table]:my-6 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-border-strong [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium",
  "[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
].join(" ");

export interface ProseProps {
  readonly html: string;
  readonly className?: string;
}

export default function Prose({ html, className }: ProseProps) {
  return unsafeHtml(html, {
    as: "article",
    className: cn(typographyVariants({ variant: "p" }), PROSE_ELEMENTS, className),
  });
}
