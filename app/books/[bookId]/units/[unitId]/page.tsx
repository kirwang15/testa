import { UnitLevelsPage } from "@/components/UnitLevelsPage";
import {
  getAllUnits,
  getBookById,
  getLevelsByUnitId,
  getUnitById
} from "@/lib/curriculum-index";
import { notFound } from "next/navigation";

type UnitPageProps = {
  params: Promise<{
    bookId: string;
    unitId: string;
  }>;
};

export function generateStaticParams() {
  return getAllUnits().map((unit) => ({
    bookId: unit.bookId,
    unitId: unit.id
  }));
}

export default async function UnitPage({ params }: UnitPageProps) {
  const { bookId, unitId } = await params;
  const book = getBookById(bookId);
  const unit = getUnitById(unitId);

  if (!book || !unit || unit.bookId !== book.id) {
    notFound();
  }

  return <UnitLevelsPage book={book} unit={unit} levels={getLevelsByUnitId(unit.id)} />;
}
