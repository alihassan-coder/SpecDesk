import type { Metadata } from "next";
import { BookPage } from "@/components/booking/book-page";

export const metadata: Metadata = { title: "Book a call" };

export default function Page() {
  return <BookPage />;
}
