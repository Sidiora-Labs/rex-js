import { Img } from "@sidioralabs/rex/client/media";

export const MARK_WIDTH = 480;
export const MARK_HEIGHT = 200;
export const MARK_LIGHT_SRC = "/mark-light.png";
export const MARK_DARK_SRC = "/mark-dark.png";

export interface MarkProps {
  readonly className?: string;
  readonly priority?: boolean;
}

export default function Mark({ className = "h-9 w-auto", priority = false }: MarkProps) {
  return (
    <span data-site-mark="" className="inline-flex items-center">
      <Img
        src={MARK_LIGHT_SRC}
        alt="Rex"
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        priority={priority}
        data-site-mark-scheme="light"
        className={`${className} dark:hidden`}
      />
      <Img
        src={MARK_DARK_SRC}
        alt="Rex"
        width={MARK_WIDTH}
        height={MARK_HEIGHT}
        priority={priority}
        data-site-mark-scheme="dark"
        className={`${className} hidden dark:block`}
      />
    </span>
  );
}
