import { BookUnitsPage } from "@/components/BookUnitsPage";
import { getAllBooks, getBookById, getUnitsForBook } from "@/src/lib/vocabulary-loader";
import { notFound } from "next/navigation";

type BookPageProps = {
  params: Promise<{
    bookId: string;
  }>;
};

export function generateStaticParams() {
  return getAllBooks().map((book) => ({
    bookId: book.id
  }));
}

export default async function BookPage({ params }: BookPageProps) {
  const { bookId } = await params;
  const book = getBookById(bookId);

  if (!book) {
    notFound();
  }

  return <BookUnitsPage book={book} units={getUnitsForBook(book.id)} />;
}
