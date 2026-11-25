import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { StreamViewingRoom } from "@/components/stream-viewing-room";

export const dynamic = "force-dynamic";
export default async function LivestreamPage() {
  if (!(await currentUser())) redirect("/login");
  return <StreamViewingRoom locale={await getLocale()} />;
}
