import type { ButtonHTMLAttributes } from "react";

export default function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}
