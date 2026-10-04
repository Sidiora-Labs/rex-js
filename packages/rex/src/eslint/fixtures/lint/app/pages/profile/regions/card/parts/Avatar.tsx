import { createRexServer } from "@sidioralabs/rex/server";

interface AvatarProps {
  readonly name: string;
}

export default function Avatar({ name }: AvatarProps) {
  return (
    <figure data-server={typeof createRexServer}>
      <img src="/avatar.png" width={48} height={48} />
      <figcaption>{name}</figcaption>
    </figure>
  );
}
