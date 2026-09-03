export {};

declare global {
  interface Window {
    clinicaDor: {
      downloadGoogleSheet: (url: string) => Promise<number[]>;
      saveReportPdf: (payload: unknown) => Promise<string | null>;
    };
  }
}
