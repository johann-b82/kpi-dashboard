import { useEffect, useState, useRef } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

export interface PdfPlayerProps {
  uri: string | null;
  autoFlipSeconds?: number;
}

export function PdfPlayer({ uri, autoFlipSeconds = 8 }: PdfPlayerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (numPages <= 1) return;
    const id = setInterval(() => {
      setPageNumber((p) => (p < numPages ? p + 1 : 1));
    }, Math.max(1000, autoFlipSeconds * 1000));
    return () => clearInterval(id);
  }, [numPages, autoFlipSeconds]);

  // Reset page when uri changes.
  useEffect(() => {
    setPageNumber(1);
  }, [uri]);

  if (!uri) return null;
  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <Document file={uri} onLoadSuccess={({ numPages: n }) => setNumPages(n)}>
        <Page
          pageNumber={pageNumber}
          width={containerWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>
    </div>
  );
}
