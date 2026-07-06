import { UnitLevelsPage } from "@/components/UnitLevelsPage";
import { getLevelsByUnitId } from "@/lib/levelLoader";
import { getAllUnits, getBookById, getUnitByGlobalId } from "@/src/lib/vocabulary-loader";
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
  const unit = getUnitByGlobalId(unitId);

  if (!book || !unit || unit.bookId !== book.id) {
    notFound();
  }

  return <UnitLevelsPage book={book} unit={unit} levels={getLevelsByUnitId(unit.id)} />;
}
