import { createFileRoute } from "@tanstack/react-router";
import { ChatViewer } from "@/components/ChatViewer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WhatsApp Chat Viewer — View exported chats locally" },
      { name: "description", content: "Upload your exported WhatsApp .txt or .zip and view it in a clean, searchable interface. 100% local and private." },
      { property: "og:title", content: "WhatsApp Chat Viewer" },
      { property: "og:description", content: "View exported WhatsApp chats in a clean interface. Search, filter by date, and see stats — all locally in your browser." },
    ],
  }),
  component: ChatViewer,
});
