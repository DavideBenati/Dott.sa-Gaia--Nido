import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { fetchDocument, type SessionDocument } from "./session-documents";
export function useDocumentDownload() {
  const [downloading, setDownloading] = useState("");
  const [downloadMessage, setMessage] = useState("");
  const [downloadDocumentId, setDocumentId] = useState("");
  const mounted = useRef(true);
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    mounted.current = true;
    const activeUrls = urls.current;
    return () => {
      mounted.current = false;
      for (const [url, timer] of activeUrls) {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
      }
      activeUrls.clear();
    };
  }, []);
  async function download(doc: SessionDocument) {
    if (downloading) return;
    if (Platform.OS !== "web") {
      setMessage("Apri metimaia.com dal browser per scaricare il documento.");
      return;
    }
    setDocumentId(doc.id);
    setDownloading(doc.id);
    setMessage("");
    try {
      const blob = await fetchDocument(doc.id);
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob);
      const timer = setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.current.delete(url);
      }, 60000);
      urls.current.set(url, timer);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.file_name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setMessage(
        "Download preparato. Se il browser lo richiede, conferma il salvataggio sul dispositivo.",
      );
    } catch (e) {
      if (mounted.current)
        setMessage(e instanceof Error ? e.message : "Download non riuscito.");
    } finally {
      if (mounted.current) setDownloading("");
    }
  }
  return { downloading, downloadMessage, downloadDocumentId, download };
}
