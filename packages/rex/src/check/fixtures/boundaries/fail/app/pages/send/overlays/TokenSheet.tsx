import { useQuery } from "@tanstack/react-query";
import Button from "../../../components/Button.tsx";

export default function TokenSheet() {
  const query = useQuery({ queryKey: ["tokens"], queryFn: () => [] });
  return <Button>{query.status}</Button>;
}
