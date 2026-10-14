import { notFound } from "next/navigation";

import { NoticeView } from "@/components/messages/notice-view";
import { fetchPlatformNotice } from "@/lib/queries/platform-notices.server";

export default async function NoticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const noticeId = Number(id);
  if (!Number.isInteger(noticeId)) notFound();

  const notice = await fetchPlatformNotice(noticeId);
  // Missing, retracted and somebody else's all read as not found, so nothing
  // about a notice is disclosed to anyone it was not sent to.
  if (!notice) notFound();

  return <NoticeView key={notice.id} notice={notice} now={new Date().toISOString()} />;
}
